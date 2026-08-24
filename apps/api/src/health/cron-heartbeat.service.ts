/**
 * In-memory last-run registry for scheduled jobs (Sprint: Integration health).
 *
 * There is deliberately no job-state table — a heartbeat is operational
 * telemetry, not a record we must retain, and writing one row per minute per
 * job would pollute a DB whose audit surface is append-only. The trade-off is
 * that timestamps reset on restart; the dashboard renders an unseen job as
 * "no run since start", never as healthy.
 *
 * Scale-out note: with more than one API replica each holds its own view. A
 * shared Redis key is the fix if/when the API is horizontally scaled.
 */
import { Injectable } from '@nestjs/common';

export type CronJobName =
  | 'telehealth.no-show'
  | 'booking.reminders'
  | 'wearables.sync'
  | 'wearables.retention-purge'
  | 'wearables.consent-grace';

export interface CronRun {
  job: CronJobName;
  lastRunAt: string;
  lastOutcome: 'ok' | 'error';
  lastError?: string;
  durationMs: number;
  runs: number;
  errors: number;
}

/** Expected cadence in ms — used to flag a job that has gone quiet. */
export const CRON_INTERVAL_MS: Record<CronJobName, number> = {
  'telehealth.no-show': 5 * 60_000,
  'booking.reminders': 60 * 60_000,
  'wearables.sync': 60_000,
  'wearables.retention-purge': 24 * 60 * 60_000,
  'wearables.consent-grace': 24 * 60 * 60_000,
};

@Injectable()
export class CronHeartbeatService {
  private readonly runs = new Map<CronJobName, CronRun>();
  /** Process start — lets the dashboard distinguish "never ran" from "overdue". */
  readonly startedAt = new Date().toISOString();

  record(job: CronJobName, outcome: 'ok' | 'error', durationMs: number, error?: string): void {
    const prev = this.runs.get(job);
    this.runs.set(job, {
      job,
      lastRunAt: new Date().toISOString(),
      lastOutcome: outcome,
      ...(error ? { lastError: error } : {}),
      durationMs,
      runs: (prev?.runs ?? 0) + 1,
      errors: (prev?.errors ?? 0) + (outcome === 'error' ? 1 : 0),
    });
  }

  /** Times a job and records the outcome, re-throwing so callers still see failures. */
  async track<T>(job: CronJobName, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    try {
      const out = await fn();
      this.record(job, 'ok', Date.now() - t0);
      return out;
    } catch (e) {
      this.record(job, 'error', Date.now() - t0, e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  all(): CronRun[] {
    return [...this.runs.values()];
  }

  get(job: CronJobName): CronRun | undefined {
    return this.runs.get(job);
  }
}
