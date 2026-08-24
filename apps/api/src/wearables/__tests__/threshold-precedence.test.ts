import { AlertService } from '../alert.service';

function makeService() {
  const prisma = {
    deviceAlertThreshold: { findUnique: jest.fn().mockResolvedValue(null) },
    wearableGlobalThreshold: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const queue = { publish: jest.fn().mockResolvedValue(undefined) };
  const svc = new AlertService(prisma as never, queue as never);
  return { svc, prisma };
}

describe('AlertService.thresholdsFor — precedence (A4)', () => {
  it('D-20 physician per-patient threshold wins; global default is not consulted', async () => {
    const { svc, prisma } = makeService();
    prisma.deviceAlertThreshold.findUnique.mockResolvedValue({
      thresholdHigh: 9, thresholdLow: 4, thresholdCriticalHigh: 14, thresholdCriticalLow: 3,
    });
    const t = await svc.thresholdsFor('PT-1', '14745-4');
    expect(t).toEqual({ high: 9, low: 4, criticalHigh: 14, criticalLow: 3 });
    expect(prisma.wearableGlobalThreshold.findUnique).not.toHaveBeenCalled();
  });

  it('D-21 with no physician threshold, the global default is applied', async () => {
    const { svc, prisma } = makeService();
    prisma.deviceAlertThreshold.findUnique.mockResolvedValue(null);
    prisma.wearableGlobalThreshold.findUnique.mockResolvedValue({
      highHigh: 11, highLow: 4.2, criticalHigh: 17, criticalLow: 3.1,
    });
    const t = await svc.thresholdsFor('PT-1', '14745-4');
    expect(t).toEqual({ high: 11, low: 4.2, criticalHigh: 17, criticalLow: 3.1 });
  });

  it('falls back to the hardcoded default when neither row exists', async () => {
    const { svc } = makeService();
    const t = await svc.thresholdsFor('PT-1', '59408-5'); // SpO2
    expect(t).toEqual({ high: null, low: 92, criticalHigh: null, criticalLow: 88 });
  });
});
