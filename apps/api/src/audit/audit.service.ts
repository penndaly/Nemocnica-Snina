/**
 * Immutable audit log — append-only, central writer (Sprint A3).
 *
 * Application layer: only INSERT. DB layer: infra/postgres/audit-immutability.sql
 * + migration 20260625000000 (REVOKE UPDATE/DELETE from ns_app + a BEFORE
 * UPDATE/DELETE trigger). The single exception is the GDPR meta-anonymisation
 * function (SECURITY DEFINER, meta-only).
 *
 * A3 routes every write through writeAuditEntry(), which:
 *   - validates `action` against ALLOWED_ACTIONS (rejects arbitrary strings)
 *   - strips PII from `meta` before persistence (RC/email hashed, patient_token
 *     truncated, passwords/tokens/secrets redacted)
 *
 * The legacy log() signature is kept as a thin adapter so existing callers
 * (auth, booking, onboarding, wearables, telehealth) keep working unchanged.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/** Actions permitted in the audit log. Spec set (A3 §A3.1) ∪ in-use legacy actions. */
export const ALLOWED_ACTIONS = new Set<string>([
  // ── Auth (A2/A3) ──
  'staff_login_attempt', 'staff_login_success', 'staff_mfa_failure', 'staff_logout',
  'mfa_setup_complete', 'mfa_reset_issued', 'invite_sent', 'invite_accepted',
  'password_reset_issued', 'password_reset_complete', 'sessions_revoked',
  // ── Staff accounts ──
  'staff_account_created', 'staff_account_updated', 'staff_account_deleted',
  'scopes_updated', 'role_changed',
  // ── CMS content ──
  'content_created', 'content_updated', 'content_deleted', 'content_published',
  'content_unpublished', 'content_export', 'content_import', 'content_reset',
  // ── Translation ──
  'translation_reviewed', 'translation_approved', 'translation_rejected',
  // ── GDPR ──
  'gdpr_export_requested', 'gdpr_export_downloaded', 'gdpr_erasure_requested',
  'gdpr_erasure_completed', 'gdpr_data_request_closed',
  'gdpr_staff_export', 'gdpr_staff_erasure',
  // ── Wearables ──
  'wearable_alert_critical', 'wearable_alert_batch', 'threshold_updated',
  'consent_granted', 'consent_withdrawn', 'wearable_consent_granted',
  'wearable_consent_withdrawn', 'wearable_device_connected', 'wearable_fhir_export',
  'wearable_manual_upload', 'wearables_queue_pending',
  // ── Telehealth ──
  'session_scheduled', 'session_cancelled', 'session_joined', 'session_ended',
  // ── Legacy (pre-A3, kept so existing callers validate) ──
  'login', 'login_failed', 'booking_confirm', 'booking_cancel',
  'onboarding_accept', 'onboarding_reject', 'fhir_read', 'granted', 'withdrawn',
  'his_event_published', 'his_queue_pending', 'his_sync_failure', 'his_sync_success',
  'lab_pdf_challenge_issued', 'lab_pdf_downloaded', 'lab_pdf_otp_failed',
  'payment_receipt_downloaded', 'portal_cancel_token_retrieved',
  'portal_receipts_listed', 'portal_refill_requested', 'webhook_received',
  'webhook_invalid_signature', 'test_immutability_check',
  'ezdravia_prescription_failed', 'ezdravia_prescription_registered',
  'ezdravia_telehealth_prescription_failed', 'ezdravia_telehealth_prescription_registered',
]);

export interface AuditEntryDto {
  actorId?: string;
  actorName?: string;   // denormalised — survives account deletion
  actorRole?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

const PII_KEYS = /^(password|passwd|token|secret|totp|recovery|jwt|refreshtoken|accesstoken|authorization)$/i;
const HASH_KEYS = /(email|^rc$|rodnecislo|patientrc|nationalid)/i;
const TOKEN_KEYS = /(patient_token|patienttoken)/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}

/**
 * Recursively strip PII from a meta object before it is written:
 *  - password/token/secret keys → '[redacted]'
 *  - email / RC / national-id keys (and email-shaped values) → SHA-256 hash
 *  - patient_token keys → first 8 chars + '…'
 */
export function stripPii(value: unknown, key = ''): unknown {
  if (PII_KEYS.test(key)) return '[redacted]';
  if (TOKEN_KEYS.test(key) && typeof value === 'string') {
    return value.length > 8 ? `${value.slice(0, 8)}…` : value;
  }
  if (HASH_KEYS.test(key) && typeof value === 'string') return `sha256:${sha256(value)}`;
  if (typeof value === 'string' && EMAIL_RE.test(value)) return `sha256:${sha256(value)}`;
  if (Array.isArray(value)) return value.map((v) => stripPii(v, key));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripPii(v, k);
    return out;
  }
  return value;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Central audit writer — validates the action and strips PII from meta. */
  async writeAuditEntry(entry: AuditEntryDto): Promise<void> {
    if (!ALLOWED_ACTIONS.has(entry.action)) {
      throw new BadRequestException(`Unknown audit action: ${entry.action}`);
    }
    const meta = entry.meta ? (stripPii(entry.meta) as Record<string, unknown>) : undefined;
    const detail = entry.userAgent ? { ...(meta ?? {}), userAgent: entry.userAgent } : meta;
    await this.prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorName ?? 'system',
        actorRole: entry.actorRole ?? 'system',
        action: entry.action,
        resource: entry.targetType ?? 'system',
        resourceId: entry.targetId ?? '',
        detail: (detail ?? null) as never,
        ip: entry.ipAddress ?? null,
      },
    });
  }

  // ── Read API (administrator | super_admin) ───────────────

  /** Paginated audit query, newest first. limit capped at 200. */
  async query(filter: {
    action?: string; actorId?: string; targetType?: string; targetId?: string;
    from?: string; to?: string; page?: number; limit?: number;
  }) {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(200, Math.max(1, filter.limit ?? 50));
    const where: Record<string, unknown> = {};
    if (filter.action) where.action = filter.action;
    if (filter.actorId) where.actorId = filter.actorId;
    if (filter.targetType) where.resource = filter.targetType;
    if (filter.targetId) where.resourceId = filter.targetId;
    if (filter.from || filter.to) {
      where.createdAt = {
        ...(filter.from ? { gte: new Date(filter.from) } : {}),
        ...(filter.to ? { lte: new Date(filter.to) } : {}),
      };
    }
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { rows, total, page, limit };
  }

  /** All entries for a staff member (last 500). */
  byStaff(staffId: string) {
    return this.prisma.auditLog.findMany({
      where: { actorId: staffId }, orderBy: { createdAt: 'desc' }, take: 500,
    });
  }

  /** Full change history for a content item. */
  byContent(targetType: string, targetId: string) {
    return this.prisma.auditLog.findMany({
      where: { resource: targetType, resourceId: targetId },
      orderBy: { createdAt: 'desc' }, take: 500,
    });
  }

  /** Legacy adapter — existing callers keep their signature; routed + PII-stripped. */
  async log(params: {
    actorEmail: string; actorRole: string; action: string; resource: string;
    resourceId: string; detail?: Record<string, unknown>; ip?: string; actorId?: string;
  }): Promise<void> {
    await this.writeAuditEntry({
      actorId: params.actorId,
      actorName: params.actorEmail,
      actorRole: params.actorRole,
      action: params.action,
      targetType: params.resource,
      targetId: params.resourceId,
      meta: params.detail,
      ipAddress: params.ip,
    });
  }
}
