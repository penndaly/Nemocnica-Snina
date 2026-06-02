/**
 * HIS sync agent — consumes events from the RabbitMQ queue and writes
 * them to the Hospital Information System via HL7 FHIR R4 REST.
 *
 * Requirements (COMPLETION_BRIEF C2):
 *   - Idempotent processing using existing idempotency keys
 *   - Retry with exponential backoff
 *   - Dead-letter handling: events that exceed max retries go to DLQ
 *   - Reconciliation: on HIS recovery, the agent re-queues DLQ messages
 *   - Every sync attempt and patient-record access logged to audit_log
 *
 * When HIS_MOCK_ENABLED=true (dev/CI) the agent logs events without
 * actually calling the HIS endpoint.
 */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import type { HisEvent } from './his-queue.service';
import { AuditService } from '../audit/audit.service';

const QUEUE = 'ns.his.events';
const DLQ   = 'ns.his.events.dlq';
const MAX_RETRIES = 5;

@Injectable()
export class HisSyncConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HisSyncConsumer.name);
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly mock: boolean;
  private readonly fhirBase: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.mock     = cfg.get<string>('HIS_MOCK_ENABLED') === 'true';
    this.fhirBase = cfg.get<string>('HIS_FHIR_BASE_URL') ?? 'https://his-sandbox.local/fhir';
  }

  async onModuleInit() { await this.startConsuming(); }
  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async startConsuming() {
    const url = this.cfg.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';
    try {
      this.connection = await amqp.connect(url);
      this.channel    = await this.connection.createChannel();
      await this.channel.prefetch(1);

      this.channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        let event: HisEvent;
        try {
          event = JSON.parse(msg.content.toString()) as HisEvent;
        } catch {
          this.channel?.nack(msg, false, false); // malformed — send to DLQ
          return;
        }

        const success = await this.processWithRetry(event);
        if (success) {
          this.channel?.ack(msg);
        } else {
          this.channel?.nack(msg, false, false); // exceeded retries → DLQ
        }
      });

      this.logger.log('HIS sync consumer started');
    } catch (err) {
      this.logger.warn(`HIS consumer failed to start: ${String(err)} — will retry in 30s`);
      setTimeout(() => void this.startConsuming(), 30_000);
    }
  }

  private async processWithRetry(event: HisEvent): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.syncToHis(event);
        await this.audit.log({
          actorEmail: 'system:his-sync',
          actorRole: 'system',
          action: 'his_sync_success',
          resource: event.type,
          resourceId: event.idempotencyKey,
          detail: { attempt },
        });
        return true;
      } catch (err) {
        this.logger.warn(`HIS sync attempt ${attempt}/${MAX_RETRIES} failed: ${String(err)}`);
        await this.audit.log({
          actorEmail: 'system:his-sync',
          actorRole: 'system',
          action: 'his_sync_failure',
          resource: event.type,
          resourceId: event.idempotencyKey,
          detail: { attempt, error: String(err) },
        });
        if (attempt < MAX_RETRIES) {
          await delay(Math.min(1000 * 2 ** attempt, 30_000));
        }
      }
    }
    return false;
  }

  private async syncToHis(event: HisEvent): Promise<void> {
    if (this.mock) {
      this.logger.log(`[HIS mock] ${event.type} ${event.idempotencyKey}`);
      return;
    }

    const fhirToken = await this.getFhirToken();

    switch (event.type) {
      case 'booking.confirmed':
        await this.postFhir('Appointment', this.buildFhirAppointment(event), fhirToken);
        break;
      case 'booking.cancelled':
        await this.patchFhir(
          `Appointment?identifier=${event.idempotencyKey}`,
          { status: 'cancelled' },
          fhirToken,
        );
        break;
      case 'onboarding.accepted':
        await this.postFhir('EpisodeOfCare', { status: 'planned', ...event.payload }, fhirToken);
        break;
    }
  }

  private buildFhirAppointment(event: HisEvent): Record<string, unknown> {
    const p = event.payload as Record<string, string>;
    return {
      resourceType: 'Appointment',
      status: 'booked',
      identifier: [{ system: 'https://nemocnicasnina.sk/booking', value: event.idempotencyKey }],
      serviceType: [{ coding: [{ code: p['clinicId'] }] }],
      start: `${p['date']}T${p['time']}:00+01:00`,
      participant: [{ actor: { display: p['patientName'] }, status: 'accepted' }],
    };
  }

  private async getFhirToken(): Promise<string> {
    const res = await fetch(`${this.fhirBase}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     this.cfg.get<string>('HIS_FHIR_CLIENT_ID') ?? '',
        client_secret: this.cfg.get<string>('HIS_FHIR_CLIENT_SECRET') ?? '',
        scope:         'system/*.write',
      }).toString(),
    });
    const data = await res.json() as { access_token: string };
    return data.access_token;
  }

  private async postFhir(resource: string, body: unknown, token: string): Promise<void> {
    const res = await fetch(`${this.fhirBase}/${resource}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/fhir+json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`FHIR POST ${resource}: ${res.status}`);
  }

  private async patchFhir(path: string, body: unknown, token: string): Promise<void> {
    const res = await fetch(`${this.fhirBase}/${path}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`FHIR PATCH ${path}: ${res.status}`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
