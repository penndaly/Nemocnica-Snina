import { WearablesFhirConsumer } from '../fhir-export.consumer';

function makeConsumer(opts: { device?: unknown; pending?: unknown[]; recheck?: unknown }) {
  const update = jest.fn().mockResolvedValue({});
  const prisma = {
    wearableDevice: { findUnique: jest.fn().mockResolvedValue(opts.device ?? { id: 'd1', patientToken: 'tok', category: 'medical', deviceLabel: 'Abbott Libre', shareWithPhysician: true }) },
    deviceReading: {
      findMany: jest.fn().mockResolvedValue(opts.pending ?? []),
      findUnique: jest.fn().mockResolvedValue(opts.recheck ?? null),
      update,
    },
  } as never;
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as never;
  const cfg = { get: jest.fn((k: string) => (k === 'HIS_MOCK_ENABLED' ? 'true' : undefined)) } as never;
  const svc = new WearablesFhirConsumer(cfg, audit, prisma);
  return { svc, update };
}

const reading = (over: Record<string, unknown> = {}) => ({
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', deviceId: 'd1', patientToken: 'tok',
  metricType: '14745-4', valueNumeric: 5.8, valueText: null, unit: 'mmol/l',
  flag: 'normal', recordedAt: new Date(), fhirObservationId: null, ...over,
});

describe('WearablesFhirConsumer.exportReadings', () => {
  it('exports a reading without an Observation id and stores the returned id', async () => {
    const r = reading();
    const { svc, update } = makeConsumer({ pending: [r], recheck: r });
    const exported = await svc.exportReadings({ deviceId: 'd1', patientToken: 'tok', readingIds: [r.id] });
    expect(exported).toBe(1);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fhirObservationId: expect.stringContaining('MOCK-OBS-') }),
    }));
  });

  it('is idempotent — a reading already exported is skipped (no second POST/update)', async () => {
    const r = reading({ fhirObservationId: 'OBS-123' });
    // findMany filters on fhirObservationId null, so an exported reading is not returned.
    const { svc, update } = makeConsumer({ pending: [], recheck: r });
    const exported = await svc.exportReadings({ deviceId: 'd1', patientToken: 'tok', readingIds: [r.id] });
    expect(exported).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('skips export entirely when the device is not shared with the physician', async () => {
    const { svc, update } = makeConsumer({ device: { id: 'd1', patientToken: 'tok', shareWithPhysician: false }, pending: [reading()] });
    const exported = await svc.exportReadings({ deviceId: 'd1', patientToken: 'tok', readingIds: ['x'] });
    expect(exported).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('does not re-export when a concurrent worker already set the id (recheck guard)', async () => {
    const r = reading();
    const { svc, update } = makeConsumer({ pending: [r], recheck: { ...r, fhirObservationId: 'OBS-RACE' } });
    const exported = await svc.exportReadings({ deviceId: 'd1', patientToken: 'tok', readingIds: [r.id] });
    expect(exported).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
