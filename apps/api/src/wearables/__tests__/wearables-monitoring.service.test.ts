import { UnprocessableEntityException } from '@nestjs/common';
import { WearablesMonitoringService } from '../wearables-monitoring.service';
import type { StaffActor } from '../../booking/booking-admin.service';

const ADMIN: StaffActor = { staffId: 's1', email: 'admin@ns.sk', role: 'administrator', scopes: [] };

function makeService() {
  const prisma = {
    portalNotification: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    wearableDevice: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    wearableGlobalThreshold: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const audit = { writeAuditEntry: jest.fn().mockResolvedValue(undefined) };
  const svc = new WearablesMonitoringService(prisma as never, audit as never);
  return { svc, prisma, audit };
}

describe('WearablesMonitoringService.alerts', () => {
  it('D-17 filters by severity; tokenPreview is 8 chars; no raw reading stream', async () => {
    const { svc, prisma } = makeService();
    prisma.portalNotification.findMany.mockResolvedValue([
      { id: 'n1', severity: 'critical', metricType: '14745-4', deviceId: 'd1', patientToken: 'PT-84A2FF99-secret-tail', value: '18.2', createdAt: new Date('2026-06-24T14:32:00Z'), readAt: null },
    ]);
    prisma.wearableDevice.findMany.mockResolvedValue([{ id: 'd1', platform: 'dexcom' }]);

    const res = await svc.alerts({ severity: 'critical' });
    // severity propagated into the where clause
    expect(prisma.portalNotification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ severity: 'critical' }) }));
    const row = res.items[0];
    expect(row.patientTokenPreview).toBe('PT-84A2F'); // exactly 8 chars
    expect(row.patientTokenPreview.length).toBe(8);
    expect(row.platformId).toBe('dexcom');
    expect(row.readingValue).toBe('18.2');
    // full token never leaks
    expect(JSON.stringify(res.items)).not.toContain('secret-tail');
  });
});

describe('WearablesMonitoringService.setDefault', () => {
  it('D-18 valid range is saved with a global-scope audit entry', async () => {
    const { svc, prisma, audit } = makeService();
    await svc.setDefault(ADMIN, '14745-4', { criticalLow: 3.0, highLow: 3.9, highHigh: 10.0, criticalHigh: 16.7 });
    expect(prisma.wearableGlobalThreshold.upsert).toHaveBeenCalled();
    expect(audit.writeAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'threshold_updated', meta: expect.objectContaining({ scope: 'global' }) }),
    );
  });

  it('accepts the semantic metric key as well as the LOINC code', async () => {
    const { svc, prisma } = makeService();
    await svc.setDefault(ADMIN, 'heart_rate_bpm', { highHigh: 120, criticalHigh: 150 });
    expect(prisma.wearableGlobalThreshold.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { metricType: '8867-4' } }));
  });

  it('D-19 criticalLow > highLow → 422 validation error', async () => {
    const { svc } = makeService();
    await expect(svc.setDefault(ADMIN, '14745-4', { criticalLow: 5.0, highLow: 3.9 })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects an unknown metric → 422', async () => {
    const { svc } = makeService();
    await expect(svc.setDefault(ADMIN, 'not_a_metric', { highHigh: 1 })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

describe('WearablesMonitoringService.getDefaults', () => {
  it('overlays stored rows on the metric catalogue', async () => {
    const { svc, prisma } = makeService();
    prisma.wearableGlobalThreshold.findMany.mockResolvedValue([
      { metricType: '59408-5', criticalLow: 88, criticalHigh: null, highLow: 92, highHigh: null },
    ]);
    const defaults = await svc.getDefaults();
    const spo2 = defaults.find((d) => d.metricType === '59408-5')!;
    expect(spo2.criticalLow).toBe(88);
    expect(spo2.highLow).toBe(92);
    expect(defaults).toHaveLength(5);
  });
});

describe('WearablesMonitoringService.summary', () => {
  it('aggregates connected counts, sync errors and pending alerts', async () => {
    const { svc, prisma } = makeService();
    prisma.wearableDevice.groupBy
      .mockResolvedValueOnce([{ platform: 'fitbit', _count: { _all: 10 } }]) // connected
      .mockResolvedValueOnce([{ platform: 'fitbit', _count: { _all: 2 } }]); // errors
    prisma.wearableDevice.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    prisma.portalNotification.count.mockResolvedValueOnce(5);
    const s = await svc.summary();
    expect(s.totalConnected).toBe(10);
    expect(s.byPlatform.fitbit).toEqual({ connected: 10, syncErrors: 2 });
    expect(s.pendingAlerts).toBe(5);
  });
});
