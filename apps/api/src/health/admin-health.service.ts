/**
 * Integration & infra health aggregator (Sprint: Integration health dashboard).
 *
 * One endpoint fans out to each service's own check so the UI makes a single
 * request instead of N. Every probe is individually time-boxed and failure-
 * isolated: a hung vendor degrades its own card, never the whole dashboard.
 *
 * `mode` is read from the same config the validator enforces, so the dashboard
 * and the production config gate agree on what "live" means. This is intended
 * to be the shared status source referenced by L1-PREP vendor provisioning —
 * that sprint should read these same probes rather than defining its own.
 *
 * No patient-identifying data appears in any response.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { CronHeartbeatService, CRON_INTERVAL_MS, type CronJobName, type CronRun } from './cron-heartbeat.service';

export type HealthState = 'ok' | 'degraded' | 'down' | 'unknown';
export type RunMode = 'mock' | 'live' | 'disabled';

export interface IntegrationStatus {
  id: string;
  name: string;
  group: 'identity' | 'clinical' | 'messaging' | 'payments' | 'content' | 'video' | 'wearables';
  state: HealthState;
  mode: RunMode;
  credentialsConfigured: boolean;
  lastSuccessAt: string | null;
  errorsLastHour: number;
  detail?: string;
}

export interface InfraStatus {
  id: string;
  name: string;
  state: HealthState;
  latencyMs: number | null;
  detail?: string;
  metrics?: Record<string, number | string>;
}

export interface CronStatus extends Partial<CronRun> {
  job: CronJobName;
  state: HealthState;
  expectedEveryMs: number;
  detail?: string;
}

export interface AdminHealthReport {
  generatedAt: string;
  overall: HealthState;
  integrations: IntegrationStatus[];
  infra: InfraStatus[];
  crons: CronStatus[];
}

/** Caps any single probe so one hung dependency cannot stall the dashboard. */
const PROBE_TIMEOUT_MS = 3_000;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const WORST: HealthState[] = ['ok', 'unknown', 'degraded', 'down'];
function worst(states: HealthState[]): HealthState {
  return states.reduce<HealthState>((acc, s) => (WORST.indexOf(s) > WORST.indexOf(acc) ? s : acc), 'ok');
}

@Injectable()
export class AdminHealthService {
  private readonly logger = new Logger(AdminHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
    private readonly heartbeat: CronHeartbeatService,
  ) {}

  async report(): Promise<AdminHealthReport> {
    const [integrations, infra] = await Promise.all([this.integrations(), this.infra()]);
    const crons = this.crons();
    return {
      generatedAt: new Date().toISOString(),
      overall: worst([...integrations.map((i) => i.state), ...infra.map((i) => i.state), ...crons.map((c) => c.state)]),
      integrations,
      infra,
      crons,
    };
  }

  // ── Integrations ────────────────────────────────────────────────────────────

  private bool(key: string, dflt = false): boolean {
    return this.cfg.get<boolean>(key) ?? dflt;
  }
  private str(key: string, dflt = ''): string {
    return this.cfg.get<string>(key) ?? dflt;
  }

  private since(hours = 1): Date {
    return new Date(Date.now() - hours * 3_600_000);
  }

  private async integrations(): Promise<IntegrationStatus[]> {
    const probes: Array<Promise<IntegrationStatus>> = [
      this.probe(() => this.oidc()),
      this.probe(() => this.his()),
      this.probe(() => this.sms()),
      this.probe(() => this.payments()),
      this.probe(() => this.translation()),
      this.probe(() => this.livekit()),
      this.probe(() => this.wearables()),
    ];
    const settled = await Promise.all(probes);
    return settled.flatMap((s) => (Array.isArray(s) ? s : [s]));
  }

  /** Wraps a probe so a thrown/hung check degrades only that card. */
  private async probe(fn: () => Promise<IntegrationStatus>): Promise<IntegrationStatus> {
    try {
      return await withTimeout(fn(), PROBE_TIMEOUT_MS, 'integration probe');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`health probe failed: ${msg}`);
      return {
        id: 'unknown', name: 'unknown', group: 'clinical', state: 'unknown', mode: 'disabled',
        credentialsConfigured: false, lastSuccessAt: null, errorsLastHour: 0, detail: msg,
      };
    }
  }

  private async oidc(): Promise<IntegrationStatus> {
    const mock = this.bool('OIDC_MOCK_ENABLED', true);
    const configured = !!this.str('OIDC_CLIENT_SECRET') && this.str('OIDC_CLIENT_SECRET') !== 'dev-secret';
    return {
      id: 'oidc', name: 'eID / OIDC broker (slovensko.sk)', group: 'identity',
      state: mock ? 'ok' : configured ? 'ok' : 'degraded',
      mode: mock ? 'mock' : 'live',
      credentialsConfigured: configured,
      lastSuccessAt: null,
      errorsLastHour: 0,
      detail: mock ? 'Mock broker — žiadne reálne volanie' : this.str('OIDC_ISSUER_URL'),
    };
  }

  private async his(): Promise<IntegrationStatus> {
    const mock = this.bool('HIS_MOCK_ENABLED', true);
    const last = await this.prisma.hisSyncLog.findFirst({ orderBy: { syncedAt: 'desc' }, select: { syncedAt: true } });
    return {
      id: 'his', name: 'HIS / NCZI eZdravie sync', group: 'clinical',
      state: mock ? 'ok' : last ? 'ok' : 'degraded',
      mode: mock ? 'mock' : 'live',
      credentialsConfigured: !!this.str('HIS_FHIR_BASE_URL'),
      lastSuccessAt: last?.syncedAt.toISOString() ?? null,
      errorsLastHour: 0,
      detail: 'Fronta a DLQ v sekcii Infraštruktúra',
    };
  }

  private async sms(): Promise<IntegrationStatus> {
    const provider = this.str('SMS_PROVIDER', 'console');
    const last = await this.prisma.smsOtp.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    return {
      id: 'sms', name: `SMS (${provider})`, group: 'messaging',
      state: 'ok',
      mode: provider === 'console' ? 'mock' : 'live',
      credentialsConfigured: provider !== 'console',
      lastSuccessAt: last?.createdAt.toISOString() ?? null,
      errorsLastHour: 0,
    };
  }

  private async payments(): Promise<IntegrationStatus> {
    const last = await this.prisma.paymentReceipt.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    const provider = this.str('PAYMENT_PROVIDER', 'mock');
    return {
      id: 'payments', name: `Platobná brána (${provider})`, group: 'payments',
      state: 'ok',
      mode: provider === 'mock' ? 'mock' : 'live',
      credentialsConfigured: provider !== 'mock',
      lastSuccessAt: last?.createdAt.toISOString() ?? null,
      errorsLastHour: 0,
    };
  }

  private async translation(): Promise<IntegrationStatus> {
    const provider = this.str('MT_PROVIDER', 'mock');
    const configured = provider === 'mock' || !!this.str('MT_DEEPL_API_KEY');
    return {
      id: 'translation', name: `Strojový preklad (${provider})`, group: 'content',
      state: configured ? 'ok' : 'degraded',
      mode: provider === 'mock' ? 'mock' : 'live',
      credentialsConfigured: configured,
      lastSuccessAt: null,
      errorsLastHour: 0,
      detail: `Cieľové jazyky: ${this.str('MT_TARGET_LOCALES', 'cs,pl,hu,uk')} — vždy koncept`,
    };
  }

  private async livekit(): Promise<IntegrationStatus> {
    const provider = this.str('TELEHEALTH_PROVIDER', 'mock');
    const key = this.str('LIVEKIT_API_KEY', 'CHANGEME');
    const region = this.str('LIVEKIT_TURN_REGION', 'eu');
    const last = await this.prisma.telehealthSession.findFirst({
      where: { status: 'ended' }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true },
    }).catch(() => null);
    const euOk = region.toLowerCase().startsWith('eu');
    return {
      id: 'livekit', name: `Telemedicína (${provider})`, group: 'video',
      state: !euOk ? 'down' : provider === 'mock' ? 'ok' : key !== 'CHANGEME' ? 'ok' : 'degraded',
      mode: provider === 'mock' ? 'mock' : 'live',
      credentialsConfigured: key !== 'CHANGEME',
      lastSuccessAt: last?.updatedAt.toISOString() ?? null,
      errorsLastHour: 0,
      detail: euOk ? `TURN región: ${region}` : `TURN región ${region} nie je v EÚ (GDPR čl. 46)`,
    };
  }

  /** One card per wearables adapter, sourced from real sync-job outcomes. */
  private async wearables(): Promise<IntegrationStatus> {
    const enabled = this.bool('WEARABLES_ENABLED', false);
    const provider = this.str('WEARABLES_PROVIDER', 'mock');
    const [lastOk, failures] = await Promise.all([
      this.prisma.deviceSyncJob.findFirst({
        where: { status: 'completed' }, orderBy: { completedAt: 'desc' }, select: { completedAt: true },
      }),
      this.prisma.deviceSyncJob.count({ where: { status: 'failed', createdAt: { gte: this.since(1) } } }),
    ]);
    return {
      id: 'wearables', name: 'Nositeľné zariadenia (agregát)', group: 'wearables',
      state: !enabled ? 'ok' : failures > 0 ? 'degraded' : 'ok',
      mode: !enabled ? 'disabled' : provider === 'mock' ? 'mock' : 'live',
      credentialsConfigured: provider === 'live',
      lastSuccessAt: lastOk?.completedAt?.toISOString() ?? null,
      errorsLastHour: failures,
      detail: enabled ? undefined : 'WEARABLES_ENABLED=false — čaká na compliance bránu L9',
    };
  }

  // ── Infra ───────────────────────────────────────────────────────────────────

  private async infra(): Promise<InfraStatus[]> {
    const [pg, redis, rabbit] = await Promise.all([
      this.safeInfra('postgres', 'PostgreSQL', () => this.postgres()),
      this.safeInfra('redis', 'Redis', () => this.redis()),
      this.safeInfra('rabbitmq', 'RabbitMQ', () => this.rabbit()),
    ]);
    return [pg, redis, rabbit];
  }

  private async safeInfra(id: string, name: string, fn: () => Promise<InfraStatus>): Promise<InfraStatus> {
    const t0 = Date.now();
    try {
      return await withTimeout(fn(), PROBE_TIMEOUT_MS, name);
    } catch (e) {
      return {
        id, name, state: 'down', latencyMs: Date.now() - t0,
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }

  private async postgres(): Promise<InfraStatus> {
    const t0 = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - t0;
    // pg_stat_activity gives real pool pressure; it is cheap and needs no extension.
    const rows = await this.prisma.$queryRaw<Array<{ total: bigint; active: bigint; max_conn: string }>>`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE state = 'active') AS active,
             current_setting('max_connections') AS max_conn
      FROM pg_stat_activity WHERE datname = current_database()`;
    const r = rows[0];
    return {
      id: 'postgres', name: 'PostgreSQL', state: latencyMs > 1000 ? 'degraded' : 'ok', latencyMs,
      metrics: r
        ? { connections: Number(r.total), active: Number(r.active), maxConnections: Number(r.max_conn) }
        : {},
    };
  }

  private async redis(): Promise<InfraStatus> {
    const url = this.str('REDIS_URL', 'redis://localhost:6379');
    const t0 = Date.now();
    // lazyConnect + no retries: a health probe must fail fast, not queue a
    // reconnect loop the way the long-lived app clients deliberately do.
    const client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    });
    client.on('error', () => {}); // surfaced by the awaited connect/ping below
    try {
      await client.connect();
      await client.ping();
      return { id: 'redis', name: 'Redis', state: 'ok', latencyMs: Date.now() - t0 };
    } finally {
      client.disconnect();
    }
  }

  private async rabbit(): Promise<InfraStatus> {
    const url = this.str('RABBITMQ_URL', 'amqp://localhost:5672');
    const t0 = Date.now();
    const conn = await amqp.connect(url);
    try {
      const queues = ['ns.his.events', 'ns.his.events.dlq', 'ns.wearables.alerts'];
      const metrics: Record<string, number> = {};
      for (const q of queues) {
        // checkQueue is passive (never creates topology) but a miss raises a
        // channel-level 404 that CLOSES the channel — so each queue gets its
        // own channel rather than losing the rest of the loop to the first miss.
        const ch = await conn.createChannel();
        ch.on('error', () => {});
        try {
          const info = await ch.checkQueue(q);
          metrics[`${q}.messages`] = info.messageCount;
          metrics[`${q}.consumers`] = info.consumerCount;
          await ch.close();
        } catch {
          // Not yet asserted by its consumer — absent, not unhealthy.
          metrics[`${q}.messages`] = -1;
        }
      }
      const dlq = metrics['ns.his.events.dlq.messages'] ?? 0;
      return {
        id: 'rabbitmq', name: 'RabbitMQ', state: dlq > 0 ? 'degraded' : 'ok',
        latencyMs: Date.now() - t0, metrics,
        ...(dlq > 0 ? { detail: `${dlq} správ v DLQ — vyžaduje zásah` } : {}),
      };
    } finally {
      await conn.close();
    }
  }

  // ── Crons ───────────────────────────────────────────────────────────────────

  private crons(): CronStatus[] {
    const jobs = Object.keys(CRON_INTERVAL_MS) as CronJobName[];
    return jobs.map((job) => {
      const run = this.heartbeat.get(job);
      const expectedEveryMs = CRON_INTERVAL_MS[job];
      if (!run) {
        // Grace: a job is not "overdue" until one full interval has elapsed
        // since process start, otherwise every restart shows a wall of red.
        const sinceStart = Date.now() - new Date(this.heartbeat.startedAt).getTime();
        return {
          job,
          state: sinceStart > expectedEveryMs * 2 ? 'degraded' : 'unknown',
          expectedEveryMs,
          detail: 'Od štartu procesu nebežalo',
        };
      }
      const age = Date.now() - new Date(run.lastRunAt).getTime();
      const overdue = age > expectedEveryMs * 2;
      return {
        ...run,
        state: run.lastOutcome === 'error' ? 'degraded' : overdue ? 'degraded' : 'ok',
        expectedEveryMs,
        ...(overdue ? { detail: 'Beh mešká' } : {}),
      };
    });
  }
}
