/**
 * Wearables RabbitMQ publisher — exchange `ns.wearables` (mirrors the HIS queue
 * pattern). Routing keys:
 *   • wearables.alert.critical   — immediate, per-reading critical alert
 *   • wearables.alert.batch      — 15-min aggregated high/low digest
 *   • wearables.readings.synced  — drives idempotent FHIR Observation export
 *
 * Degrades gracefully: if the broker is down the event is recorded to the audit
 * log for reconciliation (same contract as HisQueueService).
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Channel, ChannelModel } from 'amqplib';
import * as amqp from 'amqplib';
import { AuditService } from '../audit/audit.service';

export const WEARABLES_EXCHANGE = 'ns.wearables';
export const RK_ALERT_CRITICAL = 'wearables.alert.critical';
export const RK_ALERT_BATCH = 'wearables.alert.batch';
export const RK_READINGS_SYNCED = 'wearables.readings.synced';

@Injectable()
export class WearablesQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WearablesQueueService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() { await this.connect(); }

  async onModuleDestroy() {
    try { await this.channel?.close(); } catch { /* ignore */ }
    try { await this.connection?.close(); } catch { /* ignore */ }
  }

  private async connect() {
    const url = this.cfg.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(WEARABLES_EXCHANGE, 'direct', { durable: true });
      this.logger.log('Connected to RabbitMQ ns.wearables exchange');
    } catch (err) {
      this.logger.warn(`RabbitMQ unavailable — wearables events will reconcile: ${String(err)}`);
      setTimeout(() => void this.connect(), 30_000);
    }
  }

  async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    const body = Buffer.from(JSON.stringify(payload));
    if (!this.channel) {
      this.logger.warn(`ns.wearables down, event pending: ${routingKey}`);
      await this.audit.log({
        actorEmail: 'system',
        actorRole: 'system',
        action: 'wearables_queue_pending',
        resource: routingKey,
        resourceId: String(payload['deviceId'] ?? payload['readingId'] ?? 'unknown'),
        detail: payload,
      });
      return;
    }
    this.channel.publish(WEARABLES_EXCHANGE, routingKey, body, {
      persistent: true,
      contentType: 'application/json',
    });
  }
}
