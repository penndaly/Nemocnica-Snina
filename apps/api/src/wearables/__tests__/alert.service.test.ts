import { AlertService } from '../alert.service';
import { classify, DEFAULT_THRESHOLDS } from '../alert-thresholds';
import { RK_ALERT_BATCH, RK_ALERT_CRITICAL } from '../wearables-queue.service';

describe('classify (pure threshold logic)', () => {
  const glucose = DEFAULT_THRESHOLDS['14745-4'];
  const spo2 = DEFAULT_THRESHOLDS['59408-5'];

  it('flags glucose 15.1 as critical (>= critical_high 15.0)', () => {
    expect(classify(15.1, glucose)).toEqual({ flag: 'critical', exceeded: 'critical_high' });
  });
  it('flags glucose 11.0 as high (>= high 10.0, < critical_high)', () => {
    expect(classify(11.0, glucose)).toEqual({ flag: 'high', exceeded: 'high' });
  });
  it('flags glucose 5.8 as normal', () => {
    expect(classify(5.8, glucose)).toEqual({ flag: 'normal', exceeded: null });
  });
  it('flags glucose 2.5 as critical low', () => {
    expect(classify(2.5, glucose)).toEqual({ flag: 'critical', exceeded: 'critical_low' });
  });
  it('flags SpO2 90 as low and SpO2 87 as critical (no high bound)', () => {
    expect(classify(90, spo2).flag).toBe('low');
    expect(classify(87, spo2).flag).toBe('critical');
    expect(classify(98, spo2).flag).toBe('normal');
  });
});

function makeAlertService(thresholdRow: unknown = null) {
  const prisma = {
    deviceAlertThreshold: { findUnique: jest.fn().mockResolvedValue(thresholdRow) },
  } as never;
  const queue = { publish: jest.fn().mockResolvedValue(undefined) } as never;
  return { svc: new AlertService(prisma, queue), queue };
}

const reading = (metricType: string, valueNumeric: number) => ({
  id: 'r1', deviceId: 'd1', patientToken: 'tok', metricType, metricLabel: {}, valueNumeric,
  valueText: null, unit: 'mmol/l', flag: 'normal', recordedAt: new Date(), receivedAt: new Date(),
  fhirObservationId: null, supersededBy: null, createdAt: new Date(),
}) as never;

const device = { id: 'd1', patientToken: 'tok', deviceLabel: 'Abbott Libre', shareWithPhysician: true } as never;

describe('AlertService.evaluateReading (with DB fallback)', () => {
  it('uses DEFAULT_THRESHOLDS when no patient row exists', async () => {
    const { svc } = makeAlertService(null);
    expect((await svc.evaluateReading({ metricType: '14745-4', valueNumeric: 16 as never }, 'tok')).flag).toBe('critical');
  });

  it('honours a patient-specific override (high 8.0) over the default (10.0)', async () => {
    const { svc } = makeAlertService({ thresholdHigh: 8.0, thresholdLow: null, thresholdCriticalHigh: null, thresholdCriticalLow: null });
    expect((await svc.evaluateReading({ metricType: '14745-4', valueNumeric: 8.5 as never }, 'tok')).flag).toBe('high');
  });

  it('treats non-numeric readings as normal', async () => {
    const { svc } = makeAlertService(null);
    expect((await svc.evaluateReading({ metricType: '11524-6', valueNumeric: null }, 'tok')).flag).toBe('normal');
  });
});

describe('AlertService.processReading (emission)', () => {
  it('publishes wearables.alert.critical for a critical reading', async () => {
    const { svc, queue } = makeAlertService(null);
    await svc.processReading(device, reading('14745-4', 16));
    expect((queue as unknown as { publish: jest.Mock }).publish).toHaveBeenCalledWith(RK_ALERT_CRITICAL, expect.objectContaining({ flag: 'critical' }));
  });

  it('publishes wearables.alert.batch for a high reading when shared with physician', async () => {
    const { svc, queue } = makeAlertService(null);
    await svc.processReading(device, reading('14745-4', 11));
    expect((queue as unknown as { publish: jest.Mock }).publish).toHaveBeenCalledWith(RK_ALERT_BATCH, expect.objectContaining({ flag: 'high' }));
  });

  it('emits nothing for a normal reading', async () => {
    const { svc, queue } = makeAlertService(null);
    await svc.processReading(device, reading('14745-4', 5.8));
    expect((queue as unknown as { publish: jest.Mock }).publish).not.toHaveBeenCalled();
  });

  it('does NOT batch high/low when not shared with physician', async () => {
    const { svc, queue } = makeAlertService(null);
    const notShared = { ...(device as object), shareWithPhysician: false } as never;
    await svc.processReading(notShared, reading('14745-4', 11));
    expect((queue as unknown as { publish: jest.Mock }).publish).not.toHaveBeenCalled();
  });
});
