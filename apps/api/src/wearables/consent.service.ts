/**
 * GDPR consent engine for wearables.
 *
 * Non-negotiables:
 *   • Explicit per-device consent before any sync. Absence of a 'data_storage'
 *     consent row blocks all reads (checkConsent throws 403).
 *   • Consent withdrawal → immediate token revocation + reading soft-delete.
 *   • FHIR-synced readings (fhir_observation_id set) survive withdrawal — the
 *     authoritative copy lives in the HIS and must never be deleted here.
 *   • Every grant/withdrawal writes an append-only audit_log entry.
 */
import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WEARABLE_ADAPTER, type WearablePlatformAdapter } from './platform-adapter.interface';

export type ConsentType = 'data_storage' | 'physician_sharing' | 'his_export';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(WEARABLE_ADAPTER) private readonly adapter: WearablePlatformAdapter,
  ) {}

  /** Record one or more consent grants for a device. */
  async grantConsent(
    patientToken: string,
    deviceId: string,
    types: ConsentType[],
    ipHash: string,
  ): Promise<void> {
    await this.prisma.$transaction(
      types.map((consentType) =>
        this.prisma.deviceConsent.create({
          data: { patientToken, deviceId, consentType, granted: true, ipHash },
        }),
      ),
    );

    await this.audit.log({
      actorEmail: `patient:${patientToken.slice(0, 8)}`,
      actorRole: 'patient',
      action: 'wearable_consent_granted',
      resource: 'wearable_device',
      resourceId: deviceId,
      detail: { consentTypes: types },
    });
  }

  /**
   * Withdraw all consent for a device:
   *   1. revoke the provider OAuth token (mock no-op in W1),
   *   2. mark the device disconnected + revoked, clear encrypted tokens,
   *   3. soft-delete readings NOT yet exported to HIS (fhir_observation_id null);
   *      FHIR-synced readings are preserved untouched,
   *   4. stamp withdrawn_at on the consent rows,
   *   5. write an audit entry.
   */
  async withdrawConsent(patientToken: string, deviceId: string): Promise<void> {
    const device = await this.prisma.wearableDevice.findFirst({
      where: { id: deviceId, patientToken },
    });
    if (!device) {
      throw new ForbiddenException({ code: 'WEARABLES_CONSENT_REQUIRED', deviceId });
    }

    // 1. Revoke at the provider — never block withdrawal on a provider failure.
    try {
      await this.adapter.revokeToken(device);
    } catch (err) {
      this.logger.warn(`revokeToken failed for device ${deviceId}: ${String(err)}`);
    }

    // 2–4. Local state changes in one transaction.
    await this.prisma.$transaction([
      this.prisma.wearableDevice.update({
        where: { id: deviceId },
        data: {
          syncStatus: 'revoked',
          disconnectedAt: new Date(),
          oauthAccessTokenEnc: null,
          oauthRefreshTokenEnc: null,
          oauthExpiresAt: null,
        },
      }),
      // Soft-delete only readings that have NOT been exported to the HIS.
      this.prisma.deviceReading.deleteMany({
        where: { deviceId, fhirObservationId: null },
      }),
      this.prisma.deviceConsent.updateMany({
        where: { deviceId, withdrawnAt: null },
        data: { withdrawnAt: new Date(), granted: false },
      }),
    ]);

    await this.audit.log({
      actorEmail: `patient:${patientToken.slice(0, 8)}`,
      actorRole: 'patient',
      action: 'wearable_consent_withdrawn',
      resource: 'wearable_device',
      resourceId: deviceId,
    });
  }

  /**
   * Returns true if a non-withdrawn, granted consent of `type` exists for the
   * device. Throws 403 (WEARABLES_CONSENT_REQUIRED) otherwise.
   */
  async checkConsent(
    patientToken: string,
    deviceId: string,
    type: ConsentType = 'data_storage',
  ): Promise<boolean> {
    const consent = await this.prisma.deviceConsent.findFirst({
      where: {
        patientToken,
        deviceId,
        consentType: type,
        granted: true,
        withdrawnAt: null,
      },
    });
    if (!consent) {
      throw new ForbiddenException({ code: 'WEARABLES_CONSENT_REQUIRED', deviceId, consentType: type });
    }
    return true;
  }
}
