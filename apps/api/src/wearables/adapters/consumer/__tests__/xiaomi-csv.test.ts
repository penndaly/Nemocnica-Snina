import { parseXiaomiCsv, isKnownXiaomiCsv, MAX_ROWS } from '../xiaomi-csv';

describe('Xiaomi CSV parser (W3)', () => {
  // G6 — valid rows imported
  it('G6: parses valid HEART_RATE.csv rows into readings', () => {
    const csv = 'date,time,heartRate\n2026-06-24,08:00:00,72\n2026-06-24,08:05:00,75\n2026-06-24,08:10:00,70';
    const res = parseXiaomiCsv('HEART_RATE.csv', csv);
    expect(res.readings).toHaveLength(3);
    expect(res.skipped).toBe(0);
    expect(res.errors).toEqual([]);
    expect(res.readings[0]).toMatchObject({ metricType: '8867-4', valueNumeric: 72, unit: 'bpm' });
  });

  // G7 — malformed row skipped gracefully (no throw)
  it('G7: skips a malformed row and keeps the valid ones', () => {
    const csv = 'date,time,heartRate\n2026-06-24,08:00:00,72\n2026-06-24,08:05:00,N/A\n2026-06-24,08:10:00,70';
    const res = parseXiaomiCsv('HEART_RATE.csv', csv);
    expect(res.readings).toHaveLength(2);
    expect(res.skipped).toBe(1);
    expect(res.errors).toEqual(['Row 3: invalid heartRate value "N/A"']);
  });

  it('maps ACTIVITY_STAGE.csv → steps (55423-8) and SLEEP_STAGE.csv → min (93832-4)', () => {
    const steps = parseXiaomiCsv('ACTIVITY_STAGE.csv', 'date,startTime,endTime,activityStage,steps\n2026-06-24,08:00:00,08:30:00,walk,1200');
    expect(steps.readings[0]).toMatchObject({ metricType: '55423-8', valueNumeric: 1200, unit: 'steps' });
    const sleep = parseXiaomiCsv('SLEEP_STAGE.csv', 'date,startTime,endTime,stage,duration_min\n2026-06-24,23:00:00,06:00:00,deep,420');
    expect(sleep.readings[0]).toMatchObject({ metricType: '93832-4', valueNumeric: 420, unit: 'min' });
  });

  it('ignores unknown CSV filenames', () => {
    expect(isKnownXiaomiCsv('RANDOM.csv')).toBe(false);
    expect(parseXiaomiCsv('RANDOM.csv', 'a,b\n1,2').readings).toEqual([]);
  });

  // G8 — the max-row guard constant (the 422 reject is enforced in the endpoint)
  it('G8: MAX_ROWS guard is 10,000', () => {
    expect(MAX_ROWS).toBe(10_000);
  });
});
