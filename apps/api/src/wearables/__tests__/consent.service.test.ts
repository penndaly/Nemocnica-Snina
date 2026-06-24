/**
 * ConsentService — GDPR consent engine (Sprint W1, Part C + E).
 *
 * Prisma is mocked; these are pure unit tests (no DB). They cover the W1
 * Done-when assertions:
 *   • consent absent → 403
 *   • withdrawal triggers adapter.revokeToken() + reading soft-delete
 *   • readings WITH fhir_observation_id are never deleted on withdrawal
 */
import { ForbiddenException } from '@nestjs/common';
import { ConsentService } from '../consent.service';
import type { AuditService } from '../../audit/audit.service';
import type { WearablePlatformAdapter } from '../platform-adapter.interface';

function buildPrismaMock() {
  return {
    deviceConsent: {
      findFirst:   jest.fn(),
      create:      jest.fn().mockResolvedValue({}),
      updateMany:  jest.fn().mockResolvedValue({ count: 1 }),
    },
    wearableDevice: {
      findFirst: jest.fn(),
      update:    jest.fn().mockResolvedValue({}),
    },
    deviceReading: {
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    // $transaction just awaits the array of operation promises.
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function build(prisma = buildPrismaMock()) {
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const adapter = {
    getAuthUrl:   jest.fn(),
    exchangeCode: jest.fn(),
    syncReadings: jest.fn(),
    revokeToken:  jest.fn().mockResolvedValue(undefined),
  } as unknown as WearablePlatformAdapter;
  const registry = { getAdapter: jest.fn(() => adapter) } as never;

  const svc = new ConsentService(prisma as never, audit, registry);
  return { svc, prisma, audit, adapter };
}

describe('ConsentService.checkConsent', () => {
  it('throws 403 WEARABLES_CONSENT_REQUIRED when no consent row exists', async () => {
    const { svc, prisma } = build();
    prisma.deviceConsent.findFirst.mockResolvedValue(null);

    await expect(svc.checkConsent('tok-1', 'dev-1', 'data_storage')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    try {
      await svc.checkConsent('tok-1', 'dev-1', 'data_storage');
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        code: 'WEARABLES_CONSENT_REQUIRED',
        deviceId: 'dev-1',
      });
    }
  });

  it('returns true when a granted, non-withdrawn consent exists', async () => {
    const { svc, prisma } = build();
    prisma.deviceConsent.findFirst.mockResolvedValue({ id: 'c1', granted: true });
    await expect(svc.checkConsent('tok-1', 'dev-1', 'data_storage')).resolves.toBe(true);
  });
});

describe('ConsentService.withdrawConsent', () => {
  it('revokes the provider token and soft-deletes only un-synced readings', async () => {
    const { svc, prisma, adapter } = build();
    prisma.wearableDevice.findFirst.mockResolvedValue({ id: 'dev-1', patientToken: 'tok-1' });

    await svc.withdrawConsent('tok-1', 'dev-1');

    // 1. provider token revoked
    expect(adapter.revokeToken).toHaveBeenCalledTimes(1);

    // 2. readings soft-deleted — but ONLY where fhir_observation_id is null.
    //    Rows already exported to the HIS are preserved (immutable copy).
    expect(prisma.deviceReading.deleteMany).toHaveBeenCalledWith({
      where: { deviceId: 'dev-1', fhirObservationId: null },
    });

    // 3. device marked revoked + tokens cleared
    expect(prisma.wearableDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dev-1' },
        data: expect.objectContaining({
          syncStatus: 'revoked',
          oauthAccessTokenEnc: null,
          oauthRefreshTokenEnc: null,
        }),
      }),
    );

    // 4. consent rows stamped withdrawn
    expect(prisma.deviceConsent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ granted: false }) }),
    );
  });

  it('throws 403 when the device does not belong to the patient', async () => {
    const { svc, prisma, adapter } = build();
    prisma.wearableDevice.findFirst.mockResolvedValue(null);

    await expect(svc.withdrawConsent('tok-x', 'dev-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(adapter.revokeToken).not.toHaveBeenCalled();
    expect(prisma.deviceReading.deleteMany).not.toHaveBeenCalled();
  });

  it('still completes local withdrawal if the provider revoke fails', async () => {
    const { svc, prisma, adapter } = build();
    prisma.wearableDevice.findFirst.mockResolvedValue({ id: 'dev-1', patientToken: 'tok-1' });
    (adapter.revokeToken as jest.Mock).mockRejectedValue(new Error('provider down'));

    await expect(svc.withdrawConsent('tok-1', 'dev-1')).resolves.toBeUndefined();
    expect(prisma.deviceReading.deleteMany).toHaveBeenCalled();
  });
});

describe('ConsentService.grantConsent', () => {
  it('creates one consent row per type and writes an audit entry', async () => {
    const { svc, prisma, audit } = build();
    await svc.grantConsent('tok-1', 'dev-1', ['data_storage', 'physician_sharing'], 'ip-hash');

    expect(prisma.deviceConsent.create).toHaveBeenCalledTimes(2);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'wearable_consent_granted', resourceId: 'dev-1' }),
    );
  });
});
