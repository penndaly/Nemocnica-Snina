/**
 * Wearables monitoring & alert-log service (Sprint A4, Part C2).
 * administrator | super_admin.
 *
 * Aggregate device/consent/alert health, a filterable alert log (CSV-exportable),
 * and global default alert thresholds. The alert log never exposes patient identity
 * beyond an 8-char token preview, and never the raw reading stream — only the single
 * value that tripped the alert. Global thresholds are a fallback ONLY: physician
 * per-patient thresholds (device_alert_thresholds, W5) always take precedence.
 */
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { METRIC_CATALOG, resolveMetricKey } from './wearables-metrics';
import type { StaffActor } from '../booking/booking-admin.service';

/** Consent is treated as valid for 13 months (mirrors the WL9 consent-grace cron). */
const CONSENT_VALIDITY_DAYS = 395;
const ALERT_TYPE_PREFIX = 'wearable_alert';

export interface MonitoringSummary {
  totalConnected: number;
  byPlatform: Record<string, { connected: number; syncErrors: number }>;
  consentExpiringSoon: number;
  consentGracePending: number;
  pendingAlerts: number;
}

export interface AlertLogQuery {
  severity?: string;
  platformId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface WearableAlertLogDto {
  id: string;
  severity: string;
  metricType: string | null;
  platformId: string | null;
  patientTokenPreview: string;
  thresholdValue: number | null;
  readingValue: string | null;
  ts: string;
  acknowledged: boolean;
}

export interface GlobalThresholdDto {
  metricType: string; // LOINC code
  key: string;
  label: string;
  unit: string;
  criticalLow: number | null;
  highLow: number | null;
  highHigh: number | null;
  criticalHigh: number | null;
}

@Injectable()
export class WearablesMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Summary ──────────────────────────────────────────────────────────────────

  async summary(): Promise<MonitoringSummary> {
    const consentCutoff = new Date(Date.now() - (CONSENT_VALIDITY_DAYS - 30) * 24 * 60 * 60 * 1000);

    const [connectedByPlatform, errorByPlatform, totalConnected, consentExpiringSoon, consentGracePending, pendingAlerts] =
      await Promise.all([
        this.prisma.wearableDevice.groupBy({ by: ['platform'], where: { disconnectedAt: null }, _count: { _all: true } }),
        this.prisma.wearableDevice.groupBy({ by: ['platform'], where: { disconnectedAt: null, syncStatus: 'error' }, _count: { _all: true } }),
        this.prisma.wearableDevice.count({ where: { disconnectedAt: null } }),
        this.prisma.wearableDevice.count({
          where: { disconnectedAt: null, syncStatus: { not: 'suspended' }, lastConsentReview: { not: null, lte: consentCutoff } },
        }),
        this.prisma.wearableDevice.count({ where: { syncStatus: 'suspended' } }),
        this.prisma.portalNotification.count({ where: { type: { startsWith: ALERT_TYPE_PREFIX }, readAt: null } }),
      ]);

    const byPlatform: Record<string, { connected: number; syncErrors: number }> = {};
    for (const row of connectedByPlatform) byPlatform[row.platform] = { connected: row._count._all, syncErrors: 0 };
    for (const row of errorByPlatform) {
      byPlatform[row.platform] = { connected: byPlatform[row.platform]?.connected ?? 0, syncErrors: row._count._all };
    }

    return { totalConnected, byPlatform, consentExpiringSoon, consentGracePending, pendingAlerts };
  }

  // ── Alert log ────────────────────────────────────────────────────────────────

  async alerts(q: AlertLogQuery): Promise<{ items: WearableAlertLogDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(500, Math.max(1, q.limit ?? 100));
    const where = await this.alertWhere(q);

    const [rows, total] = await Promise.all([
      this.prisma.portalNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.portalNotification.count({ where }),
    ]);

    const items = await this.toAlertDtos(rows);
    return { items, total, page, limit };
  }

  private async alertWhere(q: AlertLogQuery): Promise<Prisma.PortalNotificationWhereInput> {
    const where: Prisma.PortalNotificationWhereInput = { type: { startsWith: ALERT_TYPE_PREFIX } };
    if (q.severity) where.severity = q.severity;
    if (q.from || q.to) {
      where.createdAt = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      };
    }
    if (q.platformId) {
      const devices = await this.prisma.wearableDevice.findMany({
        where: { platform: q.platformId as never },
        select: { id: true },
      });
      where.deviceId = { in: devices.map((d) => d.id) };
    }
    return where;
  }

  private async toAlertDtos(
    rows: Array<{ id: string; severity: string; metricType: string | null; deviceId: string | null; patientToken: string; value: string | null; createdAt: Date; readAt: Date | null }>,
  ): Promise<WearableAlertLogDto[]> {
    const deviceIds = [...new Set(rows.map((r) => r.deviceId).filter((d): d is string => !!d))];
    const devices = deviceIds.length
      ? await this.prisma.wearableDevice.findMany({ where: { id: { in: deviceIds } }, select: { id: true, platform: true } })
      : [];
    const platformOf = new Map(devices.map((d) => [d.id, d.platform as string]));

    return rows.map((r) => ({
      id: r.id,
      severity: r.severity,
      metricType: r.metricType,
      platformId: r.deviceId ? platformOf.get(r.deviceId) ?? null : null,
      patientTokenPreview: r.patientToken.slice(0, 8),
      thresholdValue: null, // threshold not persisted at alert time
      readingValue: r.value,
      ts: r.createdAt.toISOString(),
      acknowledged: r.readAt !== null,
    }));
  }

  /** All matching rows as a CSV string (no pagination). Writes an audit entry. */
  async exportCsv(actor: StaffActor, q: AlertLogQuery, ip?: string): Promise<string> {
    const where = await this.alertWhere(q);
    const rows = await this.prisma.portalNotification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10000 });
    const items = await this.toAlertDtos(rows);

    const header = ['id', 'severity', 'metricType', 'platformId', 'patientTokenPreview', 'thresholdValue', 'readingValue', 'ts', 'acknowledged'];
    const csv = [
      header.join(','),
      ...items.map((i) =>
        [i.id, i.severity, i.metricType ?? '', i.platformId ?? '', i.patientTokenPreview, i.thresholdValue ?? '', i.readingValue ?? '', i.ts, i.acknowledged]
          .map((v) => this.csvCell(String(v)))
          .join(','),
      ),
    ].join('\n');

    await this.audit.writeAuditEntry({
      // AuditLog.actorId has a hard FK to the legacy StaffUser table, not
      // StaffAccount (actor's type here) — omit it and keep the id in meta
      // instead. See staff-auth.service.ts's logEvent() for the original fix.
      actorName: actor.email,
      actorRole: actor.role,
      action: 'wearable_alert_log_exported',
      targetType: 'wearable_alert_log',
      targetId: 'export',
      meta: { filters: { severity: q.severity ?? null, platformId: q.platformId ?? null, from: q.from ?? null, to: q.to ?? null }, rowCount: items.length, staffAccountId: actor.staffId },
      ipAddress: ip,
    });

    return csv;
  }

  private csvCell(v: string): string {
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }

  // ── Global default thresholds ──────────────────────────────────────────────────

  async getDefaults(): Promise<GlobalThresholdDto[]> {
    const rows = await this.prisma.wearableGlobalThreshold.findMany();
    const byLoinc = new Map(rows.map((r) => [r.metricType, r]));
    return METRIC_CATALOG.map((m) => {
      const row = byLoinc.get(m.loinc);
      return {
        metricType: m.loinc,
        key: m.key,
        label: m.label,
        unit: m.unit,
        criticalLow: row?.criticalLow ?? null,
        highLow: row?.highLow ?? null,
        highHigh: row?.highHigh ?? null,
        criticalHigh: row?.criticalHigh ?? null,
      };
    });
  }

  async setDefault(
    actor: StaffActor,
    metricTypeInput: string,
    body: { criticalLow?: number | null; criticalHigh?: number | null; highLow?: number | null; highHigh?: number | null },
    ip?: string,
  ) {
    const metricType = resolveMetricKey(metricTypeInput);
    if (!metricType) throw new UnprocessableEntityException({ code: 'unknown_metric', metricType: metricTypeInput });

    this.validateRange(body);

    const previous = await this.prisma.wearableGlobalThreshold.findUnique({ where: { metricType } });
    const next = {
      criticalLow: body.criticalLow ?? null,
      criticalHigh: body.criticalHigh ?? null,
      highLow: body.highLow ?? null,
      highHigh: body.highHigh ?? null,
    };
    await this.prisma.wearableGlobalThreshold.upsert({
      where: { metricType },
      update: { ...next, updatedBy: actor.staffId },
      create: { metricType, ...next, updatedBy: actor.staffId },
    });

    await this.audit.writeAuditEntry({
      // AuditLog.actorId has a hard FK to the legacy StaffUser table, not
      // StaffAccount (actor's type here) — omit it and keep the id in meta
      // instead. See staff-auth.service.ts's logEvent() for the original fix.
      actorName: actor.email,
      actorRole: actor.role,
      action: 'threshold_updated',
      targetType: 'wearable_global_thresholds',
      targetId: metricType,
      meta: {
        metricType,
        scope: 'global',
        previous: previous ? { criticalLow: previous.criticalLow, criticalHigh: previous.criticalHigh, highLow: previous.highLow, highHigh: previous.highHigh } : null,
        next,
        staffAccountId: actor.staffId,
      },
      ipAddress: ip,
    });

    return { metricType, ...next };
  }

  /** Enforce criticalLow < highLow < highHigh < criticalHigh across provided bounds. */
  private validateRange(b: { criticalLow?: number | null; criticalHigh?: number | null; highLow?: number | null; highHigh?: number | null }): void {
    const ordered: Array<[string, number | null | undefined]> = [
      ['criticalLow', b.criticalLow],
      ['highLow', b.highLow],
      ['highHigh', b.highHigh],
      ['criticalHigh', b.criticalHigh],
    ];
    const present = ordered.filter(([, v]) => v !== null && v !== undefined) as Array<[string, number]>;
    for (let i = 1; i < present.length; i++) {
      if (present[i][1] <= present[i - 1][1]) {
        throw new UnprocessableEntityException({
          code: 'INVALID_THRESHOLD_RANGE',
          message: `${present[i - 1][0]} must be < ${present[i][0]}`,
        });
      }
    }
  }
}
