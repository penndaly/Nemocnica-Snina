/**
 * Wearables alert consumer (Sprint W5) — amqplib, mirroring HisSyncConsumer.
 *
 *   • wearables.alert.critical → resolve the patient's physician (via recent
 *     telehealth relationship), send an escalation SMS (device label + token
 *     prefix only — never RC or full token), create a critical portal
 *     notification, and audit. SMS fires within 60 s of the reading insertion.
 *   • wearables.alert.batch → create a high/low portal notification + audit,
 *     and append to the per-physician 15-minute digest window (WL9 Part B); the
 *     digest itself is flushed by WearablesCronService.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Channel, ChannelModel } from 'amqplib';
import * as amqp from 'amqplib';
import { AuditService } from '../audit/audit.service';
import { SmsService } from '../sms/sms.service';
import { PrismaService } from '../prisma/prisma.service';
import { WearablesDigestService } from './wearables-digest.service';
import {
  RK_ALERT_BATCH,
  RK_ALERT_CRITICAL,
  WEARABLES_EXCHANGE,
} from './wearables-queue.service';

interface AlertPayload {
  patientToken: string;
  deviceId: string;
  deviceLabel: string;
  metricType: string;
  value: number | string | null;
  unit: string;
  flag: 'high' | 'low' | 'critical';
}

const Q_CRITICAL = 'ns.wearables.alert.critical';
const Q_BATCH = 'ns.wearables.alert.batch';

const METRIC_NAMES: Record<string, string> = {
  '14745-4': 'Glukóza', '8867-4': 'Tep', '8480-6': 'Systolický TK',
  '8462-4': 'Diastolický TK', '59408-5': 'SpO2',
};

@Injectable()
export class WearablesAlertConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WearablesAlertConsumer.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly escalationPhone: string;
  private readonly accessWindowDays: number;

  constructor(
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
    private readonly sms: SmsService,
    private readonly prisma: PrismaService,
    private readonly digest: WearablesDigestService,
  ) {
    this.escalationPhone = cfg.get<string>('WEARABLES_ALERT_SMS_TO') ?? '';
    this.accessWindowDays = Number(cfg.get<string>('WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS') ?? 90);
  }

  async onModuleInit() { await this.start(); }

  async onModuleDestroy() {
    try { await this.channel?.close(); } catch { /* ignore */ }
    try { await this.connection?.close(); } catch { /* ignore */ }
  }

  private async start() {
    const url = this.cfg.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(WEARABLES_EXCHANGE, 'direct', { durable: true });

      await this.channel.assertQueue(Q_CRITICAL, { durable: true });
      await this.channel.bindQueue(Q_CRITICAL, WEARABLES_EXCHANGE, RK_ALERT_CRITICAL);
      await this.channel.assertQueue(Q_BATCH, { durable: true });
      await this.channel.bindQueue(Q_BATCH, WEARABLES_EXCHANGE, RK_ALERT_BATCH);

      await this.channel.prefetch(5);

      void this.channel.consume(Q_CRITICAL, (msg) => this.handle(msg, 'critical'));
      void this.channel.consume(Q_BATCH, (msg) => this.handle(msg, 'batch'));

      this.logger.log('Wearables alert consumer started');
    } catch (err) {
      this.logger.warn(`Alert consumer failed to start: ${String(err)} — retry in 30s`);
      setTimeout(() => void this.start(), 30_000);
    }
  }

  private async handle(msg: amqp.ConsumeMessage | null, kind: 'critical' | 'batch') {
    if (!msg) return;
    let payload: AlertPayload;
    try {
      payload = JSON.parse(msg.content.toString()) as AlertPayload;
    } catch {
      this.channel?.nack(msg, false, false);
      return;
    }
    try {
      if (kind === 'critical') await this.handleCritical(payload);
      else await this.handleBatch(payload);
      this.channel?.ack(msg);
    } catch (err) {
      this.logger.error(`Alert ${kind} failed: ${String(err)}`);
      this.channel?.nack(msg, false, false);
    }
  }

  /** Most-recent physician with a relationship to this patient (telehealth). */
  private async resolvePhysicianId(patientToken: string): Promise<string | null> {
    const since = new Date(Date.now() - this.accessWindowDays * 86_400_000);
    const session = await this.prisma.telehealthSession.findFirst({
      where: { patientToken, scheduledAt: { gte: since } },
      orderBy: { scheduledAt: 'desc' },
      select: { physicianId: true },
    });
    return session?.physicianId ?? null;
  }

  private async handleCritical(p: AlertPayload): Promise<void> {
    const physicianId = await this.resolvePhysicianId(p.patientToken);
    const metric = METRIC_NAMES[p.metricType] ?? p.metricType;

    if (this.escalationPhone) {
      await this.sms.sendRaw(
        this.escalationPhone,
        `[Nemocnica Snina] KRITICKÉ: ${p.deviceLabel} — ${metric} ${p.value ?? '—'}${p.unit}. ` +
          `Pacient: ${p.patientToken.slice(0, 8)}…`,
      );
    } else {
      this.logger.warn('WEARABLES_ALERT_SMS_TO unset — critical alert recorded without SMS');
    }

    await this.prisma.portalNotification.create({
      data: {
        patientToken: p.patientToken,
        type: 'wearable_alert',
        severity: 'critical',
        deviceId: p.deviceId,
        physicianId,
        metricType: p.metricType,
        value: String(p.value),
        flag: p.flag,
      },
    });

    await this.audit.log({
      actorEmail: 'system',
      actorRole: 'system',
      action: 'wearable_alert_critical',
      resource: 'wearable_device',
      resourceId: p.deviceId,
      detail: { metricType: p.metricType, value: p.value, flag: p.flag, smsSent: !!this.escalationPhone },
    });
  }

  private async handleBatch(p: AlertPayload): Promise<void> {
    const physicianId = await this.resolvePhysicianId(p.patientToken);
    await this.prisma.portalNotification.create({
      data: {
        patientToken: p.patientToken,
        type: 'wearable_alert',
        severity: p.flag,
        deviceId: p.deviceId,
        physicianId,
        metricType: p.metricType,
        value: String(p.value),
        flag: p.flag,
      },
    });
    await this.audit.log({
      actorEmail: 'system',
      actorRole: 'system',
      action: 'wearable_alert_batch',
      resource: 'wearable_device',
      resourceId: p.deviceId,
      detail: { metricType: p.metricType, value: p.value, flag: p.flag },
    });

    // WL9 Part B — coalesce into the physician's 15-min digest window. Best-effort:
    // the per-patient notification above is the source of truth, so a digest
    // failure must never nack/requeue the message (which would duplicate it).
    if (p.flag === 'high' || p.flag === 'low') {
      try {
        await this.digest.append(physicianId, {
          patientToken: p.patientToken,
          deviceId: p.deviceId,
          deviceLabel: p.deviceLabel,
          metricType: p.metricType,
          value: p.value,
          unit: p.unit,
          flag: p.flag,
        });
      } catch (err) {
        this.logger.warn(`Digest append failed (non-fatal): ${String(err)}`);
      }
    }
  }
}
