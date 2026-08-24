import { CronHeartbeatService, CRON_INTERVAL_MS } from '../cron-heartbeat.service';

describe('CronHeartbeatService', () => {
  it('records a successful run with a duration and counters', async () => {
    const hb = new CronHeartbeatService();
    await hb.track('booking.reminders', async () => 'done');

    const run = hb.get('booking.reminders');
    expect(run).toBeDefined();
    expect(run!.lastOutcome).toBe('ok');
    expect(run!.runs).toBe(1);
    expect(run!.errors).toBe(0);
    expect(run!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records an error AND re-throws, so job failure behaviour is unchanged', async () => {
    const hb = new CronHeartbeatService();
    await expect(
      hb.track('wearables.sync', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const run = hb.get('wearables.sync');
    expect(run!.lastOutcome).toBe('error');
    expect(run!.lastError).toBe('boom');
    expect(run!.errors).toBe(1);
  });

  it('accumulates counters across runs', async () => {
    const hb = new CronHeartbeatService();
    await hb.track('wearables.sync', async () => undefined);
    await expect(hb.track('wearables.sync', async () => { throw new Error('x'); })).rejects.toThrow();
    await hb.track('wearables.sync', async () => undefined);

    const run = hb.get('wearables.sync')!;
    expect(run.runs).toBe(3);
    expect(run.errors).toBe(1);
    expect(run.lastOutcome).toBe('ok');
  });

  it('reports nothing for a job that has never run', () => {
    const hb = new CronHeartbeatService();
    expect(hb.get('telehealth.no-show')).toBeUndefined();
    expect(hb.all()).toEqual([]);
  });

  it('declares an expected interval for every known job', () => {
    const hb = new CronHeartbeatService();
    for (const job of Object.keys(CRON_INTERVAL_MS)) {
      expect(CRON_INTERVAL_MS[job as keyof typeof CRON_INTERVAL_MS]).toBeGreaterThan(0);
    }
    expect(new Date(hb.startedAt).toString()).not.toBe('Invalid Date');
  });
});
