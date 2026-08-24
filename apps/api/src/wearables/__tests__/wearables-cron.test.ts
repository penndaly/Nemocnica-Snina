import { WearablesCronService } from '../wearables-cron.service';
import { CronHeartbeatService } from '../../health/cron-heartbeat.service';

function make(prismaOver: Record<string, unknown>) {
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as never;
  const digest = { flushDue: jest.fn().mockResolvedValue(0) } as never;
  const cfg = { get: () => '90' } as never;
  const prisma = prismaOver as never;
  return { svc: new WearablesCronService(prisma, audit, digest, cfg, new CronHeartbeatService()), audit };
}

describe('WearablesCronService.purgeExpiredReadings (WL9 Part C)', () => {
  it('deletes only withdrawn-consent, past-retention, non-FHIR readings and audits the count', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 3 });
    const { svc, audit } = make({
      deviceConsent: { findMany: jest.fn().mockResolvedValue([{ deviceId: 'd1' }, { deviceId: 'd1' }, { deviceId: 'd2' }]) },
      deviceReading: { deleteMany },
    });

    await svc.purgeExpiredReadings();

    const where = deleteMany.mock.calls[0][0].where;
    expect(where.deviceId).toEqual({ in: ['d1', 'd2'] });   // deduped device ids
    expect(where.fhirObservationId).toBeNull();             // FHIR-linked rows are spared (legal hold)
    expect(where.receivedAt.lt).toBeInstanceOf(Date);
    expect((audit as { log: jest.Mock }).log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'wearable_readings_purged', detail: expect.objectContaining({ count: 3 }) }),
    );
  });

  it('does nothing when no consent has been withdrawn', async () => {
    const deleteMany = jest.fn();
    const { svc, audit } = make({
      deviceConsent: { findMany: jest.fn().mockResolvedValue([]) },
      deviceReading: { deleteMany },
    });
    await svc.purgeExpiredReadings();
    expect(deleteMany).not.toHaveBeenCalled();
    expect((audit as { log: jest.Mock }).log).not.toHaveBeenCalled();
  });
});

describe('WearablesCronService.suspendStaleConsent (WL9 Part C)', () => {
  it('suspends stale devices, notifies the patient, audits, and does NOT revoke tokens', async () => {
    const update = jest.fn().mockResolvedValue({});
    const create = jest.fn().mockResolvedValue({});
    const { svc, audit } = make({
      wearableDevice: {
        findMany: jest.fn().mockResolvedValue([{ id: 'd1', patientToken: 'tok-1', platform: 'fitbit' }]),
        update,
      },
      portalNotification: { create },
    });

    await svc.suspendStaleConsent();

    expect(update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { syncStatus: 'suspended' } });
    // No token columns touched → tokens preserved.
    expect(update.mock.calls[0][0].data).not.toHaveProperty('oauthAccessTokenEnc');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'consent_reconfirmation_required', deviceId: 'd1' }) }),
    );
    expect((audit as { log: jest.Mock }).log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'consent_grace_suspended', resourceId: 'd1' }),
    );
  });
});
