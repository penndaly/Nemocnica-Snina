/**
 * Wearables scheduled jobs (Sprint WL9 Part B flush + Part C retention).
 *
 *   • every minute — flush due batch-alert digest windows (Part B).
 *   • 02:00 daily  — purge readings whose data_storage consent was withdrawn,
 *                    that are past the retention window, and that are NOT
 *                    FHIR-linked. FHIR-linked readings are a legal hold under
 *                    Act 362/2011 and are never deleted (CLAUDE.md).
 *   • 03:00 daily  — suspend sync for devices connected > 13 months ago that
 *                    have never had a consent review (does NOT revoke tokens;
 *                    the patient re-activates by reviewing consent).
 *
 * Methods are public and side-effect-contained so they can be unit-tested
 * without the @nestjs/schedule timer firing.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WearablesDigestService } from './wearables-digest.service';
import { CronHeartbeatService } from '../health/cron-heartbeat.service';

@Injectable()
export class WearablesCronService {
  private readonly logger = new Logger(WearablesCronService.name);
  private readonly retentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly digest: WearablesDigestService,
    cfg: ConfigService,
    private readonly heartbeat: CronHeartbeatService,
  ) {
    this.retentionDays = Number(cfg.get<string>('WEARABLES_GDPR_RETENTION_DAYS') ?? 90);
  }

  // ── Part B — flush due digest windows ───────────────────
  @Cron('* * * * *')
  async flushAlertDigests(): Promise<void> {
    await this.heartbeat.track('wearables.sync', () => this.runFlushAlertDigests());
  }

  private async runFlushAlertDigests(): Promise<void> {
    try {
      const n = await this.digest.flushDue();
      if (n > 0) this.logger.log(`Flushed ${n} batch-alert digest window(s)`);
    } catch (err) {
      this.logger.error(`Digest flush failed: ${String(err)}`);
    }
  }

  // ── Part C — retention purge ────────────────────────────
  @Cron('0 2 * * *')
  async purgeExpiredReadings(): Promise<void> {
    await this.heartbeat.track('wearables.retention-purge', () => this.runPurgeExpiredReadings());
  }

  private async runPurgeExpiredReadings(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - this.retentionDays * 86_400_000);

      // Devices whose data_storage consent has been withdrawn.
      const withdrawn = await this.prisma.deviceConsent.findMany({
        where: { consentType: 'data_storage', granted: false },
        select: { deviceId: true },
      });
      const deviceIds = [...new Set(withdrawn.map((c) => c.deviceId))];
      if (deviceIds.length === 0) return;

      // Delete only non-FHIR-linked readings past retention. fhirObservationId:null
      // is the legal-hold guard — FHIR-linked rows are the HIS authoritative copy.
      const res = await this.prisma.deviceReading.deleteMany({
        where: {
          deviceId: { in: deviceIds },
          fhirObservationId: null,
          receivedAt: { lt: cutoff },
        },
      });

      if (res.count > 0) {
        this.logger.log(`Purged ${res.count} expired non-FHIR readings`);
        await this.audit.log({
          actorEmail: 'system',
          actorRole: 'system',
          action: 'wearable_readings_purged',
          resource: 'wearable_device',
          resourceId: 'batch',
          detail: { count: res.count, retentionDays: this.retentionDays },
        });
      }
    } catch (err) {
      this.logger.error(`Retention purge failed: ${String(err)}`);
    }
  }

  // ── Part C — consent-grace suspension ───────────────────
  @Cron('0 3 * * *')
  async suspendStaleConsent(): Promise<void> {
    await this.heartbeat.track('wearables.consent-grace', () => this.runSuspendStaleConsent());
  }

  private async runSuspendStaleConsent(): Promise<void> {
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 13);

      const stale = await this.prisma.wearableDevice.findMany({
        where: {
          connectedAt: { lt: cutoff },
          lastConsentReview: null,
          syncStatus: { not: 'suspended' },
          disconnectedAt: null,
        },
        select: { id: true, patientToken: true, platform: true },
      });

      for (const d of stale) {
        // Suspend sync only — do NOT revoke OAuth tokens; the patient can
        // re-activate by reviewing consent.
        await this.prisma.wearableDevice.update({
          where: { id: d.id },
          data: { syncStatus: 'suspended' },
        });
        await this.prisma.portalNotification.create({
          data: {
            patientToken: d.patientToken,
            type: 'consent_reconfirmation_required',
            severity: 'info',
            deviceId: d.id,
            message:
              'Synchronizácia zariadenia bola pozastavená. Skontrolujte nastavenia súhlasu pre jej obnovenie.',
          },
        });
        await this.audit.log({
          actorEmail: 'system',
          actorRole: 'system',
          action: 'consent_grace_suspended',
          resource: 'wearable_device',
          resourceId: d.id,
          detail: { platform: d.platform },
        });
      }

      if (stale.length > 0) this.logger.log(`Suspended ${stale.length} stale-consent device(s)`);
    } catch (err) {
      this.logger.error(`Consent-grace suspension failed: ${String(err)}`);
    }
  }
}
