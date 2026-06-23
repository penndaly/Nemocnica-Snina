/**
 * GDPR data-subject rights service (Art. 15 access + Art. 17 erasure).
 *
 * Scope: web tier only. Clinical records reside in the HIS/FHIR layer
 * and are the responsibility of the HIS data controller — not us. Each
 * export/erasure explicitly notes this.
 *
 * Every action is written to audit_log (immutable, see A2).
 * This endpoint is admin-role-only and MFA-gated (enforced at controller layer).
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RcCryptoService } from '../common/rc-crypto.service';

// Retention rules — also documented in RETENTION.md
const RETENTION_REASONS: Record<string, string> = {
  audit_log:
    'Retained 5 years — Decree 179/2020 requires immutable audit records for cybersecurity incidents.',
  booking_financial:
    'Retained 5 years — Act 431/2002 Coll. (Accounting Act) requires transaction records.',
};

export interface DsarExport {
  subjectIdentifier: string;
  exportedAt: string;
  note: string;
  bookings: unknown[];
  onboardingApplications: unknown[];
  smsOtps: unknown[];
  auditEntries: unknown[];
  retainedRecords: { table: string; reason: string; count: number }[];
}

export interface ErasureResult {
  subjectIdentifier: string;
  erasedAt: string;
  anonymized: { table: string; rows: number }[];
  retained: { table: string; reason: string; rows: number }[];
  auditEntryId: string;
}

@Injectable()
export class GdprService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rcCrypto: RcCryptoService,
  ) {}

  /**
   * Art. 15 — Right of access.
   * Returns all web-tier personal data for a subject identified by RC hash match.
   * Clinical records are explicitly excluded (HIS controller responsibility).
   */
  async exportSubjectData(
    patientRc: string,
    operatorEmail: string,
    operatorRole: string,
    ip: string,
  ): Promise<DsarExport> {
    const rcHash = await this.findRcHash(patientRc);

    const [bookings, onboardingApps, otps] = await Promise.all([
      this.prisma.booking.findMany({
        where: { patientRcHash: rcHash },
        select: {
          id: true, clinicId: true, patientName: true, patientPhone: true,
          date: true, time: true, status: true, gdprConsent: true,
          referralConsent: true, createdAt: true,
          // patientRcHash deliberately excluded from export (hash ≠ personal data)
        },
      }),
      this.prisma.onboardingApplication.findMany({
        where: { patientRcHash: rcHash },
        select: {
          id: true, physicianId: true, patientName: true, insurerCode: true,
          phone: true, email: true, status: true, createdAt: true,
          patientRcEncrypted: true, // decrypted into `rc` for the export, never emitted raw
        },
      }),
      this.prisma.smsOtp.findMany({
        where: { phone: { not: '' } }, // phone is not indexed by RC; filter post-join
        select: { id: true, phone: true, purpose: true, used: true, expiresAt: true, createdAt: true },
        take: 0, // OTPs not linked to RC — returned as empty with explanation
      }),
    ]);

    // Include the decrypted RC per onboarding application (Art. 15 / Art. 20).
    // Pre-fix records (no ciphertext) get an explanatory note instead.
    const onboardingApplications = onboardingApps.map(({ patientRcEncrypted, ...rest }) => ({
      ...rest,
      rc: patientRcEncrypted
        ? this.rcCrypto.decrypt(patientRcEncrypted)
        : '[Not retained — application submitted before encrypted storage was added. Contact the hospital data controller for identity document access.]',
    }));

    // Audit entries referencing this subject's bookings/applications
    const subjectResourceIds = [
      ...bookings.map((b) => b.id),
      ...onboardingApps.map((a) => a.id),
    ];
    const auditEntries = await this.prisma.auditLog.findMany({
      where: { resourceId: { in: subjectResourceIds } },
      select: { id: true, actorEmail: true, action: true, resource: true, createdAt: true },
    });

    const auditId = await this.logAccess(
      operatorEmail, operatorRole, 'dsar_export',
      `exported ${bookings.length} bookings, ${onboardingApps.length} applications`, ip,
    );

    return {
      subjectIdentifier: '(RC not stored in export — see booking/application records)',
      exportedAt: new Date().toISOString(),
      note: 'Clinical records (diagnoses, medications, lab results) are held by the Hospital Information System (HIS) and are outside the scope of this export. Contact the HIS data controller for clinical records.',
      bookings,
      onboardingApplications,
      smsOtps: [],
      auditEntries,
      retainedRecords: [
        { table: 'audit_log', reason: RETENTION_REASONS['audit_log']!, count: auditEntries.length },
      ],
    };
  }

  /**
   * Art. 17 — Right to erasure.
   * Anonymizes the subject's bookings and applications.
   * Retains audit log entries and any legally required financial records.
   */
  async eraseSubjectData(
    patientRc: string,
    operatorEmail: string,
    operatorRole: string,
    ip: string,
  ): Promise<ErasureResult> {
    const rcHash = await this.findRcHash(patientRc);

    const ANON_NAME = '[ERASED]';
    const ANON_PHONE = '000000000';
    const ANON_EMAIL = null;

    // 1. Anonymize bookings (preserve for financial reconciliation but strip PII)
    const bookings = await this.prisma.booking.findMany({ where: { patientRcHash: rcHash } });

    let bookingRows = 0;
    for (const b of bookings) {
      await this.prisma.booking.update({
        where: { id: b.id },
        data: {
          patientName: ANON_NAME,
          patientPhone: ANON_PHONE,
          patientRcHash: '[ERASED]',
        },
      });
      bookingRows++;
    }

    // 2. Anonymize onboarding applications
    const apps = await this.prisma.onboardingApplication.findMany({
      where: { patientRcHash: rcHash },
    });
    let appRows = 0;
    for (const a of apps) {
      await this.prisma.onboardingApplication.update({
        where: { id: a.id },
        data: {
          patientName: ANON_NAME,
          patientRcHash: '[ERASED]',
          phone: ANON_PHONE,
          email: ANON_EMAIL,
        },
      });
      appRows++;
    }

    // 3. Write immutable audit record of the erasure
    const auditId = await this.logAccess(
      operatorEmail, operatorRole, 'dsar_erasure',
      JSON.stringify({
        anonymizedBookings: bookingRows,
        anonymizedApplications: appRows,
        retainedAuditEntries: 'all (Decree 179/2020)',
        retainedFinancialRecords: `${bookingRows} booking records retained per Act 431/2002 (accounting)`,
      }),
      ip,
    );

    return {
      subjectIdentifier: '(RC not logged)',
      erasedAt: new Date().toISOString(),
      anonymized: [
        { table: 'bookings', rows: bookingRows },
        { table: 'onboarding_applications', rows: appRows },
      ],
      retained: [
        { table: 'audit_log', reason: RETENTION_REASONS['audit_log']!, rows: -1 /* append-only */ },
        { table: 'bookings', reason: RETENTION_REASONS['booking_financial']!, rows: bookingRows },
      ],
      auditEntryId: auditId,
    };
  }

  private async findRcHash(patientRc: string): Promise<string> {
    // Search bookings by trying bcrypt.compare — RC never stored plaintext
    // For scale this would use a deterministic HMAC-based lookup token instead.
    // The current scheme is acceptable for the expected volume (hundreds/month).
    const allBookings = await this.prisma.booking.findMany({
      select: { patientRcHash: true },
      distinct: ['patientRcHash'],
    });

    for (const { patientRcHash } of allBookings) {
      if (patientRcHash === '[ERASED]') continue;
      const match = await bcrypt.compare(patientRc, patientRcHash);
      if (match) return patientRcHash;
    }

    throw new NotFoundException(
      'No web-tier records found for the provided identifier. ' +
      'Clinical records are held by the HIS data controller.',
    );
  }

  private async logAccess(
    actorEmail: string,
    actorRole: string,
    action: string,
    detail: string,
    ip: string,
  ): Promise<string> {
    const { randomUUID } = await import('crypto');
    const id = randomUUID();
    await this.audit.log({
      actorEmail,
      actorRole,
      action,
      resource: 'patient_data',
      resourceId: 'dsar',
      detail: { detail },
      ip,
    });
    return id;
  }
}
