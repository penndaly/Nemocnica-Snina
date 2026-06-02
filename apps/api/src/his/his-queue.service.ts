/**
 * HIS integration via async RabbitMQ queue.
 * Rule: NO direct web→HIS DB writes.
 * Web API → RabbitMQ → sync agent → HIS via HL7/FHIR.
 *
 * Bookings/onboarding events survive an HIS outage and reconcile on recovery.
 * Every message is idempotent (idempotency key = booking/application ID).
 */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { AuditService } from '../audit/audit.service';

export type HisEventType =
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'onboarding.accepted';

export interface HisEvent {
  type: HisEventType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

const EXCHANGE = 'ns.his';
const QUEUE    = 'ns.his.events';
const DLQ      = 'ns.his.events.dlq';

@Injectable()
export class HisQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HisQueueService.name);
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  constructor(
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async connect() {
    const url = this.cfg.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      // Dead-letter exchange for failed messages
      await this.channel.assertExchange(`${EXCHANGE}.dlx`, 'direct', { durable: true });
      await this.channel.assertQueue(DLQ, { durable: true });
      await this.channel.bindQueue(DLQ, `${EXCHANGE}.dlx`, QUEUE);

      await this.channel.assertExchange(EXCHANGE, 'direct', { durable: true });
      await this.channel.assertQueue(QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': `${EXCHANGE}.dlx`,
          'x-dead-letter-routing-key': QUEUE,
          'x-message-ttl': 7 * 24 * 60 * 60 * 1000, // 7 days
        },
      });
      await this.channel.bindQueue(QUEUE, EXCHANGE, QUEUE);

      this.logger.log('Connected to RabbitMQ HIS queue');
    } catch (err) {
      this.logger.warn(`RabbitMQ unavailable — HIS events will be retried: ${String(err)}`);
      // Retry in 30s — bookings in our DB are the source of truth
      setTimeout(() => void this.connect(), 30_000);
    }
  }

  async publish(event: HisEvent): Promise<void> {
    const body = Buffer.from(JSON.stringify(event));
    const options: amqp.Options.Publish = {
      persistent: true,
      messageId: event.idempotencyKey,
      timestamp: Date.now(),
      contentType: 'application/json',
      headers: { eventType: event.type },
    };

    if (!this.channel) {
      // Queue not available — log to audit for reconciliation
      this.logger.warn(`HIS queue down, event will reconcile: ${event.idempotencyKey}`);
      await this.audit.log({
        actorEmail: 'system',
        actorRole: 'system',
        action: 'his_queue_pending',
        resource: event.type,
        resourceId: event.idempotencyKey,
        detail: event.payload,
      });
      return;
    }

    this.channel.publish(EXCHANGE, QUEUE, body, options);

    await this.audit.log({
      actorEmail: 'system',
      actorRole: 'system',
      action: 'his_event_published',
      resource: event.type,
      resourceId: event.idempotencyKey,
    });
  }
}
