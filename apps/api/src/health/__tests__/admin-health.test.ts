/**
 * Integration-health aggregator (Sprint: Integration health dashboard).
 * Infra probes (Postgres/Redis/RabbitMQ) open real sockets, so these tests
 * exercise the integration + cron classification logic directly instead of
 * report(), which would need live infra.
 */
import { AdminHealthService, type IntegrationStatus, type CronStatus } from '../admin-health.service';
import { CronHeartbeatService, CRON_INTERVAL_MS } from '../cron-heartbeat.service';

type Cfg = Record<string, unknown>;

function build(cfgValues: Cfg = {}, prismaOverrides: Record<string, unknown> = {}) {
  const heartbeat = new CronHeartbeatService();
  const cfg = { get: <T,>(k: string): T | undefined => cfgValues[k] as T | undefined };
  const prisma = {
    hisSyncLog: { findFirst: jest.fn().mockResolvedValue(null) },
    smsOtp: { findFirst: jest.fn().mockResolvedValue(null) },
    paymentReceipt: { findFirst: jest.fn().mockResolvedValue(null) },
    telehealthSession: { findFirst: jest.fn().mockResolvedValue(null) },
    deviceSyncJob: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
    ...prismaOverrides,
  };
  const svc = new AdminHealthService(prisma as never, cfg as never, heartbeat);
  return { svc, heartbeat, prisma };
}

/** Private-probe access — these are deliberately not part of the public API. */
const call = <T,>(svc: AdminHealthService, name: string): Promise<T> =>
  (svc as unknown as Record<string, () => Promise<T>>)[name]!.call(svc);

describe('AdminHealthService — integrations', () => {
  it('reports mock mode when the mock flags are on (dev/staging default)', async () => {
    const { svc } = build({ OIDC_MOCK_ENABLED: true, HIS_MOCK_ENABLED: true });
    const oidc = await call<IntegrationStatus>(svc, 'oidc');
    const his = await call<IntegrationStatus>(svc, 'his');

    expect(oidc.mode).toBe('mock');
    expect(oidc.state).toBe('ok');
    expect(his.mode).toBe('mock');
    expect(his.state).toBe('ok');
  });

  it('flags a live OIDC broker still holding the dev secret as degraded', async () => {
    const { svc } = build({ OIDC_MOCK_ENABLED: false, OIDC_CLIENT_SECRET: 'dev-secret' });
    const oidc = await call<IntegrationStatus>(svc, 'oidc');

    expect(oidc.mode).toBe('live');
    expect(oidc.state).toBe('degraded');
    expect(oidc.credentialsConfigured).toBe(false);
  });

  it('marks telemedicine DOWN when the TURN region is outside the EU (GDPR Art. 46)', async () => {
    const { svc } = build({ TELEHEALTH_PROVIDER: 'livekit', LIVEKIT_API_KEY: 'real', LIVEKIT_TURN_REGION: 'us-east' });
    const lk = await call<IntegrationStatus>(svc, 'livekit');

    expect(lk.state).toBe('down');
    expect(lk.detail).toMatch(/GDPR/);
  });

  it('accepts an EU TURN region', async () => {
    const { svc } = build({ TELEHEALTH_PROVIDER: 'livekit', LIVEKIT_API_KEY: 'real', LIVEKIT_TURN_REGION: 'eu-central' });
    expect((await call<IntegrationStatus>(svc, 'livekit')).state).toBe('ok');
  });

  it('shows wearables as disabled until the L9 gate, not as broken', async () => {
    const { svc } = build({ WEARABLES_ENABLED: false });
    const w = await call<IntegrationStatus>(svc, 'wearables');

    expect(w.mode).toBe('disabled');
    expect(w.state).toBe('ok');
    expect(w.detail).toMatch(/L9/);
  });

  it('degrades wearables when sync jobs failed in the last hour', async () => {
    const { svc } = build(
      { WEARABLES_ENABLED: true, WEARABLES_PROVIDER: 'mock' },
      { deviceSyncJob: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(4) } },
    );
    const w = await call<IntegrationStatus>(svc, 'wearables');

    expect(w.errorsLastHour).toBe(4);
    expect(w.state).toBe('degraded');
  });

  it('surfaces the last successful HIS sync timestamp', async () => {
    const when = new Date('2026-08-24T09:00:00.000Z');
    const { svc } = build(
      { HIS_MOCK_ENABLED: true },
      { hisSyncLog: { findFirst: jest.fn().mockResolvedValue({ syncedAt: when }) } },
    );
    expect((await call<IntegrationStatus>(svc, 'his')).lastSuccessAt).toBe(when.toISOString());
  });

  it('never leaks a secret value into the report', async () => {
    const { svc } = build({ OIDC_MOCK_ENABLED: false, OIDC_CLIENT_SECRET: 'super-secret-value' });
    expect(JSON.stringify(await call<IntegrationStatus>(svc, 'oidc'))).not.toContain('super-secret-value');
  });
});

describe('AdminHealthService — crons', () => {
  const crons = (svc: AdminHealthService): CronStatus[] =>
    (svc as unknown as { crons: () => CronStatus[] }).crons();

  it('is "unknown", not failing, immediately after process start', () => {
    const { svc } = build();
    const noShow = crons(svc).find((c) => c.job === 'telehealth.no-show')!;

    expect(noShow.state).toBe('unknown');
    expect(noShow.detail).toMatch(/nebežalo/);
  });

  it('is ok right after a successful run', async () => {
    const { svc, heartbeat } = build();
    await heartbeat.track('wearables.sync', async () => undefined);

    expect(crons(svc).find((c) => c.job === 'wearables.sync')!.state).toBe('ok');
  });

  it('degrades when the last run errored', async () => {
    const { svc, heartbeat } = build();
    await expect(heartbeat.track('wearables.sync', async () => { throw new Error('nope'); })).rejects.toThrow();

    expect(crons(svc).find((c) => c.job === 'wearables.sync')!.state).toBe('degraded');
  });

  it('degrades a job that has gone quiet past twice its interval', () => {
    const { svc, heartbeat } = build();
    const stale = Date.now() - CRON_INTERVAL_MS['wearables.sync'] * 3;
    // Job-aware: returning one run for EVERY job would make the other rows
    // masquerade as this one and the assertion below would match the wrong row.
    jest.spyOn(heartbeat, 'get').mockImplementation((job) =>
      job === 'wearables.sync'
        ? { job, lastRunAt: new Date(stale).toISOString(), lastOutcome: 'ok', durationMs: 5, runs: 1, errors: 0 }
        : undefined,
    );

    const row = crons(svc).find((c) => c.job === 'wearables.sync')!;
    expect(row.state).toBe('degraded');
    expect(row.detail).toMatch(/mešká/);
  });

  it('covers every declared job', () => {
    const { svc } = build();
    expect(crons(svc).map((c) => c.job).sort()).toEqual(Object.keys(CRON_INTERVAL_MS).sort());
  });
});
