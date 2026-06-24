/**
 * Batch-alert digest (Sprint WL9 Part B).
 *
 * Non-critical (high/low) wearable alerts are coalesced per physician per
 * 15-minute window so the on-call escalation channel gets ONE summary instead
 * of a message per reading. (Critical alerts are never digested — they page
 * immediately via WearablesAlertConsumer.)
 *
 * The spec describes a BullMQ delayed job; BullMQ is not a dependency in this
 * repo (the codebase schedules with @nestjs/schedule + ioredis). Instead the
 * window state lives in Redis and WearablesCronService sweeps once a minute,
 * flushing windows whose 15-minute span has closed. This is restart-safe — an
 * in-process timer would lose pending digests on redeploy — and yields the same
 * guarantee: exactly one digest per physician per window.
 *
 *   window  = floor(now / 15min)
 *   member  = "{window}:{physicianId}"   (physicianId may be 'unassigned')
 *   a digest for window W is flushed once now ≥ (W+1) * 15min
 *
 * Routing still uses WEARABLES_ALERT_SMS_TO (single escalation number) until
 * staff accounts are wired to per-physician routing — see CLAUDE.md.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { SmsService } from '../sms/sms.service';
import { WEARABLES_KV, type WearablesKv } from './wearables-redis.service';

export const DIGEST_WINDOW_MS = 15 * 60 * 1000;
const DIGEST_GRACE_SEC = 5 * 60; // margin after window close for the sweep to run

export interface DigestAlert {
  patientToken: string;
  deviceId: string;
  deviceLabel: string;
  metricType: string;
  value: number | string | null;
  unit: string;
  flag: 'high' | 'low';
}

const METRIC_NAMES: Record<string, string> = {
  '14745-4': 'Glukóza', '8867-4': 'Tep', '8480-6': 'Systolický TK',
  '8462-4': 'Diastolický TK', '59408-5': 'SpO2',
};

@Injectable()
export class WearablesDigestService {
  private readonly logger = new Logger(WearablesDigestService.name);
  private readonly escalationPhone: string;

  constructor(
    @Inject(WEARABLES_KV) private readonly kv: WearablesKv,
    private readonly sms: SmsService,
    private readonly audit: AuditService,
    cfg: ConfigService,
  ) {
    this.escalationPhone = cfg.get<string>('WEARABLES_ALERT_SMS_TO') ?? '';
  }

  private windowFor(now: number): number {
    return Math.floor(now / DIGEST_WINDOW_MS);
  }

  private member(physicianId: string | null, window: number): string {
    return `${window}:${physicianId ?? 'unassigned'}`;
  }

  /**
   * Append a batch alert to the current physician/window digest. Best-effort:
   * if Redis is unavailable the digest is skipped (the per-patient portal
   * notification is created separately by the consumer and is the source of
   * truth the patient sees).
   */
  async append(physicianId: string | null, alert: DigestAlert): Promise<void> {
    if (!this.kv.available()) {
      this.logger.warn('Redis unavailable — batch alert not added to digest window');
      return;
    }
    const now = Date.now();
    const window = this.windowFor(now);
    const member = this.member(physicianId, window);
    // TTL runs until the window closes + grace, so a late cron tick can never let
    // the list expire before it is flushed. (Only the first append sets the TTL.)
    const ttlSec = Math.ceil(((window + 1) * DIGEST_WINDOW_MS - now) / 1000) + DIGEST_GRACE_SEC;
    await this.kv.digestAppend(member, JSON.stringify(alert), ttlSec);
  }

  /**
   * Flush every digest window whose 15-minute span has closed. Called by the
   * one-minute cron. Each flushed window sends exactly one digest.
   */
  async flushDue(now: number = Date.now()): Promise<number> {
    if (!this.kv.available()) return 0;
    const members = await this.kv.digestPendingMembers();
    let flushed = 0;
    for (const member of members) {
      const sep = member.indexOf(':');
      const window = Number(member.slice(0, sep));
      const physicianId = member.slice(sep + 1);
      if (!Number.isFinite(window)) {
        await this.kv.digestDrain(member); // malformed — drop it
        continue;
      }
      if (now < (window + 1) * DIGEST_WINDOW_MS) continue; // window still open

      const items = await this.kv.digestDrain(member);
      if (items.length === 0) continue;
      const alerts = items
        .map((s) => this.tryParse(s))
        .filter((a): a is DigestAlert => a !== null);
      if (alerts.length === 0) continue;
      await this.emit(physicianId, window, alerts);
      flushed++;
    }
    return flushed;
  }

  private tryParse(s: string): DigestAlert | null {
    try {
      return JSON.parse(s) as DigestAlert;
    } catch {
      return null;
    }
  }

  private async emit(physicianId: string, window: number, alerts: DigestAlert[]): Promise<void> {
    const lines = alerts
      .map((a) => `${a.deviceLabel}: ${METRIC_NAMES[a.metricType] ?? a.metricType} ${a.value ?? '—'}${a.unit} (${a.flag})`)
      .slice(0, 10);
    const extra = alerts.length > lines.length ? ` (+${alerts.length - lines.length})` : '';

    if (this.escalationPhone) {
      await this.sms.sendRaw(
        this.escalationPhone,
        `[Nemocnica Snina] Súhrn upozornení (15 min): ${alerts.length}. ${lines.join('; ')}${extra}`,
      );
    } else {
      this.logger.warn('WEARABLES_ALERT_SMS_TO unset — batch digest recorded without SMS');
    }

    await this.audit.log({
      actorEmail: 'system',
      actorRole: 'system',
      action: 'wearable_alert_batch_digest',
      resource: 'wearable_device',
      resourceId: physicianId,
      detail: {
        physicianId: physicianId === 'unassigned' ? null : physicianId,
        window,
        count: alerts.length,
        smsSent: !!this.escalationPhone,
      },
    });
  }
}
