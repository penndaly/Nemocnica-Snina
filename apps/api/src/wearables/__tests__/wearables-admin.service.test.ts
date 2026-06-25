import { UnprocessableEntityException } from '@nestjs/common';
import { WearablesAdminService } from '../wearables-admin.service';
import type { StaffActor } from '../../booking/booking-admin.service';

const SUPER: StaffActor = { staffId: 's0', email: 'root@ns.sk', role: 'super_admin', scopes: [] };

function makeService(env: Record<string, string> = {}) {
  const prisma = {
    wearablePlatformOverride: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    wearableDevice: {
      groupBy: jest.fn().mockResolvedValue([
        { platform: 'fitbit', _count: { _all: 512 }, _max: { lastSyncAt: new Date('2026-06-20') } },
      ]),
    },
  };
  const cfg = { get: jest.fn((k: string) => env[k]) };
  const audit = { writeAuditEntry: jest.fn().mockResolvedValue(undefined) };
  const svc = new WearablesAdminService(prisma as never, cfg as never, audit as never);
  return { svc, prisma, audit };
}

describe('WearablesAdminService.getPlatforms', () => {
  it('D-10 credentialsConfigured=false when env vars are missing', async () => {
    const { svc } = makeService({});
    const list = await svc.getPlatforms();
    const dexcom = list.find((p) => p.id === 'dexcom')!;
    expect(dexcom.credentialsConfigured).toBe(false);
  });

  it('D-11 credentialsConfigured=true when set; raw values never returned', async () => {
    const { svc } = makeService({ DEXCOM_CLIENT_ID: 'abc', DEXCOM_CLIENT_SECRET: 'shh-secret' });
    const list = await svc.getPlatforms();
    const dexcom = list.find((p) => p.id === 'dexcom')!;
    expect(dexcom.credentialsConfigured).toBe(true);
    expect(JSON.stringify(list)).not.toContain('shh-secret');
    expect(JSON.stringify(list)).not.toContain('abc');
  });

  it('reports connected device counts + last sync per platform', async () => {
    const { svc } = makeService({});
    const fitbit = (await svc.getPlatforms()).find((p) => p.id === 'fitbit')!;
    expect(fitbit.connectedDeviceCount).toBe(512);
    expect(fitbit.lastSyncAt).toEqual(new Date('2026-06-20'));
  });

  it('exposes no connectionTestUrl for partnership/blocked platforms', async () => {
    const { svc } = makeService({});
    const list = await svc.getPlatforms();
    expect(list.find((p) => p.id === 'medtronic_cardiac')!.connectionTestUrl).toBeNull();
    expect(list.find((p) => p.id === 'huawei')!.connectionTestUrl).toBeNull();
  });
});

describe('WearablesAdminService.togglePlatform', () => {
  it('D-12 super_admin toggling a non-partnership platform writes override + audit', async () => {
    const { svc, prisma, audit } = makeService({ FITBIT_CLIENT_ID: 'x', FITBIT_CLIENT_SECRET: 'y' });
    const res = await svc.togglePlatform(SUPER, 'fitbit', false);
    expect(res).toEqual({ platformId: 'fitbit', enabled: false });
    expect(prisma.wearablePlatformOverride.upsert).toHaveBeenCalled();
    expect(audit.writeAuditEntry).toHaveBeenCalledWith(expect.objectContaining({ action: 'wearable_platform_toggled' }));
  });

  it('D-14 enabling a partnership_required platform → 422 partnership_required', async () => {
    const { svc } = makeService();
    await expect(svc.togglePlatform(SUPER, 'medtronic_cardiac', true)).rejects.toMatchObject({
      response: { code: 'partnership_required' },
    });
  });

  it('D-15 enabling Huawei → 422 eu_adequacy_blocked', async () => {
    const { svc } = makeService();
    await expect(svc.togglePlatform(SUPER, 'huawei', true)).rejects.toMatchObject({
      response: { code: 'eu_adequacy_blocked' },
    });
  });

  it('allows disabling a partnership platform (only enabling is blocked)', async () => {
    const { svc, prisma } = makeService();
    await expect(svc.togglePlatform(SUPER, 'medtronic_cardiac', false)).resolves.toEqual({ platformId: 'medtronic_cardiac', enabled: false });
    expect(prisma.wearablePlatformOverride.upsert).toHaveBeenCalled();
  });
});

describe('WearablesAdminService.testConnection', () => {
  it('D-16 configured platform returns { ok, latencyMs }', async () => {
    const { svc } = makeService();
    jest.spyOn(svc as never as { probe: () => Promise<unknown> }, 'probe').mockResolvedValue({ ok: true, latencyMs: 142, httpStatus: 200 });
    const res = await svc.testConnection('dexcom');
    expect(typeof res.ok).toBe('boolean');
    expect(typeof res.latencyMs).toBe('number');
  });

  it('returns no_test_endpoint for a non-connectable platform', async () => {
    const { svc } = makeService();
    const res = await svc.testConnection('medtronic_cardiac');
    expect(res).toEqual({ ok: false, latencyMs: 0, error: 'no_test_endpoint' });
  });
});
