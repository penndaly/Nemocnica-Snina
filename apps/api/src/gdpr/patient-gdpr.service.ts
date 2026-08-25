/**
 * Patient GDPR data tools — web-tier, patient_token-keyed (Sprint A3, Part B).
 *
 * Scope (per architecture decision): clinical records (conditions, meds, labs,
 * appointments) live in the hospital HIS as FHIR R4 — NOT in this DB. We act
 * only on web-tier patient_token data: device_readings, device_consent,
 * portal_notifications, telehealth_sessions metadata, and audit_log meta.
 *
 *  - Export (Art. 15): encrypted JSON bundle + signed URL; notes HIS-side records.
 *  - Erasure (Art. 17): super_admin only + MFA re-verify. FHIR-linked
 *    device_readings are PRESERVED (Act 362/2011 legal hold); others deleted.
 *    audit_log rows are never deleted — meta PII is anonymised via the
 *    SECURITY DEFINER DB function. Returns an encrypted receipt.
 */
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from './storage.service';
import { StaffAuthService } from '../auth/staff-auth.service';

interface Actor { staffId: string; email: string; role: string }

const HIS_NOTE =
  'Clinical records (conditions, medications, lab results, appointments) are held in ' +
  'the hospital HIS as FHIR R4 resources. Contact the hospital data controller for ' +
  'clinical record access.';

@Injectable()
export class PatientGdprService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  /** Art. 15 — export all web-tier data for a patient_token. */
  async exportPatient(patientToken: string, requestReference: string, actor: Actor, ip?: string) {
    const [readings, consents, notifications, sessions] = await Promise.all([
      this.prisma.deviceReading.findMany({ where: { patientToken } }),
      this.prisma.deviceConsent.findMany({ where: { patientToken } }),
      this.prisma.portalNotification.findMany({ where: { patientToken } }),
      this.prisma.telehealthSession.findMany({
        where: { patientToken },
        select: { id: true, status: true, scheduledAt: true, startedAt: true, endedAt: true },
      }).catch(() => []),
    ]);
    if (!readings.length && !consents.length && !notifications.length && !sessions.length) {
      throw new NotFoundException('No web-tier data found for this patient token');
    }

    const auditEntries = await this.prisma.auditLog.findMany({
      where: { detail: { path: ['patient_token'], equals: patientToken } },
    }).catch(() => []);

    const bundle = {
      _note: HIS_NOTE,
      _format: 'GDPR Art. 20 portability (machine-readable JSON)',
      requestReference,
      exportedAt: new Date().toISOString(),
      patientTokenPrefix: `${patientToken.slice(0, 8)}…`,
      deviceReadings: readings,
      deviceConsents: consents,
      portalNotifications: notifications,
      telehealthSessions: sessions,
      auditEntries,
    };

    const signed = await this.storage.putEncryptedJson(bundle, {
      filename: `gdpr-export-${requestReference}.json`,
      downloadPath: '/api/gdpr/download',
    });
    // AuditLog.actorId has a hard FK to the legacy StaffUser table, not
    // StaffAccount (actor's type here) — omit it and keep the id in meta
    // instead. See staff-auth.service.ts's logEvent() for the original fix.
    await this.audit.writeAuditEntry({
      actorName: actor.email, actorRole: actor.role,
      action: 'gdpr_export_requested',
      targetType: 'patient', targetId: `${patientToken.slice(0, 8)}…`,
      meta: { requestReference, patient_token: patientToken, staffAccountId: actor.staffId }, ipAddress: ip,
    });
    return { downloadUrl: signed.downloadUrl, expiresAt: signed.expiresAt };
  }

  /** Art. 17 — erase web-tier data. super_admin only + MFA re-verify. */
  async erasePatient(
    patientToken: string,
    reason: string,
    requestReference: string,
    totpCode: string,
    actor: Actor,
    ip?: string,
  ) {
    if (actor.role !== 'super_admin') throw new ForbiddenException('Erasure is super_admin only');
    const mfaOk = await this.staffAuth.verifyTotpForStaff(actor.staffId, totpCode);
    if (!mfaOk) throw new ForbiddenException('MFA re-verification failed');

    // Abort if there is an active/scheduled telehealth session.
    const activeSessions = await this.prisma.telehealthSession.count({
      where: { patientToken, status: { in: ['scheduled', 'active'] as never } },
    }).catch(() => 0);
    if (activeSessions > 0) {
      throw new ConflictException('Active or scheduled telehealth session exists — resolve before erasure');
    }

    // FHIR-linked readings are preserved (legal hold); others deleted.
    const fhirLinked = await this.prisma.deviceReading.findMany({
      where: { patientToken, fhirObservationId: { not: null } },
      select: { fhirObservationId: true },
    });
    const preservedFhir = fhirLinked.map((r) => r.fhirObservationId).filter(Boolean) as string[];

    const erased: Record<string, number> = {};
    const delReadings = await this.prisma.deviceReading.deleteMany({ where: { patientToken, fhirObservationId: null } });
    erased.device_readings = delReadings.count;
    erased.device_consent = (await this.prisma.deviceConsent.deleteMany({ where: { patientToken } })).count;
    erased.portal_notifications = (await this.prisma.portalNotification.deleteMany({ where: { patientToken } })).count;

    // Anonymise (not delete) telehealth session patient_token references.
    const anonToken = `erased-${patientToken.slice(0, 8)}`;
    erased.telehealth_sessions_anonymised = (
      await this.prisma.telehealthSession.updateMany({ where: { patientToken }, data: { patientToken: anonToken } }).catch(() => ({ count: 0 }))
    ).count;

    // Anonymise audit_log meta PII via the SECURITY DEFINER function (rows preserved).
    let auditAnonymised = 0;
    try {
      const rows = await this.prisma.$queryRaw<{ audit_log_anonymise_patient: number }[]>`
        SELECT audit_log_anonymise_patient(${patientToken}) AS audit_log_anonymise_patient`;
      auditAnonymised = Number(rows?.[0]?.audit_log_anonymise_patient ?? 0);
    } catch {
      auditAnonymised = -1; // function not present (e.g. migration not applied in this env)
    }

    const receipt = {
      timestamp: new Date().toISOString(),
      requestReference,
      reason,
      erasedTables: erased,
      preservedFhirObservations: preservedFhir,
      auditMetaAnonymised: auditAnonymised,
      note: HIS_NOTE,
    };
    const signed = await this.storage.putEncryptedJson(receipt, {
      filename: `gdpr-erasure-receipt-${requestReference}.json`,
      downloadPath: '/api/gdpr/download',
    });

    // AuditLog.actorId has a hard FK to the legacy StaffUser table, not
    // StaffAccount (actor's type here) — omit it and keep the id in meta
    // instead. See staff-auth.service.ts's logEvent() for the original fix.
    await this.audit.writeAuditEntry({
      actorName: actor.email, actorRole: actor.role,
      action: 'gdpr_erasure_completed',
      targetType: 'patient', targetId: `${patientToken.slice(0, 8)}…`,
      meta: { requestReference, preservedCount: preservedFhir.length, staffAccountId: actor.staffId }, ipAddress: ip,
    });
    return { receipt: { ...receipt }, downloadUrl: signed.downloadUrl, expiresAt: signed.expiresAt };
  }
}
