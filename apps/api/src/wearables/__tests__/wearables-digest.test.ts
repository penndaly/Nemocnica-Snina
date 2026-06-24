import { DIGEST_WINDOW_MS, WearablesDigestService, type DigestAlert } from '../wearables-digest.service';
import { InMemoryWearablesKv } from '../wearables-redis.service';

const alert = (over: Partial<DigestAlert> = {}): DigestAlert => ({
  patientToken: 'tok-1', deviceId: 'dev-1', deviceLabel: 'Abbott Libre',
  metricType: '14745-4', value: 12, unit: 'mmol/l', flag: 'high', ...over,
});

function make() {
  const kv = new InMemoryWearablesKv();
  const sendRaw = jest.fn().mockResolvedValue(undefined);
  const log = jest.fn().mockResolvedValue(undefined);
  const cfg = { get: () => '+421900000000' } as never;
  const svc = new WearablesDigestService(kv, { sendRaw } as never, { log } as never, cfg);
  return { svc, kv, sendRaw, log };
}

describe('WearablesDigestService — 15-min batch digest windows (WL9 Part B)', () => {
  it('coalesces multiple alerts in one window into a single digest', async () => {
    jest.useFakeTimers();
    const base = 100 * DIGEST_WINDOW_MS; // align to a window boundary
    jest.setSystemTime(base);

    const { svc, kv, sendRaw, log } = make();
    await svc.append('phys-1', alert());
    await svc.append('phys-1', alert({ value: 13 })); // same physician + window

    // One pending window, accumulating both alerts.
    expect(await kv.digestPendingMembers()).toHaveLength(1);

    // Before the window closes → nothing sent.
    await svc.flushDue(base + 5 * 60 * 1000);
    expect(sendRaw).not.toHaveBeenCalled();

    // After the window closes → exactly one digest SMS + one audit entry.
    const flushed = await svc.flushDue(base + DIGEST_WINDOW_MS + 1000);
    expect(flushed).toBe(1);
    expect(sendRaw).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'wearable_alert_batch_digest', detail: expect.objectContaining({ count: 2 }) }),
    );

    // Window is drained — a second flush does nothing.
    expect(await svc.flushDue(base + 2 * DIGEST_WINDOW_MS)).toBe(0);
    jest.useRealTimers();
  });

  it('keeps separate physicians in separate digests', async () => {
    jest.useFakeTimers();
    const base = 200 * DIGEST_WINDOW_MS;
    jest.setSystemTime(base);

    const { svc, kv, sendRaw } = make();
    await svc.append('phys-1', alert());
    await svc.append('phys-2', alert());
    expect(await kv.digestPendingMembers()).toHaveLength(2);

    const flushed = await svc.flushDue(base + DIGEST_WINDOW_MS + 1000);
    expect(flushed).toBe(2);
    expect(sendRaw).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
