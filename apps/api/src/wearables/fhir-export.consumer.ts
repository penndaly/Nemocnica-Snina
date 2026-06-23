/**
 * Wearables → HIS FHIR Observation export (Sprint W5), amqplib consumer of
 * wearables.readings.synced.
 *
 * For each synced reading that is shared with the physician and not yet exported
 * (fhir_observation_id IS NULL), build a FHIR R4 Observation, POST it to the HIS
 * FHIR endpoint (same base/token as the telehealth HIS sync; mock-aware), and
 * store the returned id. Idempotent: a reading that already has an id is skipped
 * (no duplicate Observation). Export failures are retried then left for later —
 * a reading is NEVER deleted here (HIS holds the authoritative copy).
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Channel, ChannelModel } from 'amqplib';
import * as amqp from 'amqplib';
import type { DeviceReading, WearableDevice } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RK_READINGS_SYNCED, WEARABLES_EXCHANGE } from './wearables-queue.service';

interface SyncedPayload {
  deviceId: string;
  patientToken: string;
  readingIds: string[];
}

const QUEUE = 'ns.wearables.readings.synced';
const MAX_RETRIES = 3;

@Injectable()
export class WearablesFhirConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WearablesFhirConsumer.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly mock: boolean;
  private readonly fhirBase: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {
    this.mock = cfg.get<string>('HIS_MOCK_ENABLED') === 'true';
    this.fhirBase = cfg.get<string>('HIS_FHIR_BASE_URL') ?? 'https://his-sandbox.local/fhir';
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
      await this.channel.assertQueue(QUEUE, { durable: true });
      await this.channel.bindQueue(QUEUE, WEARABLES_EXCHANGE, RK_READINGS_SYNCED);
      await this.channel.prefetch(1);
      void this.channel.consume(QUEUE, (msg) => this.handle(msg));
      this.logger.log('Wearables FHIR export consumer started');
    } catch (err) {
      this.logger.warn(`FHIR export consumer failed to start: ${String(err)} — retry in 30s`);
      setTimeout(() => void this.start(), 30_000);
    }
  }

  private async handle(msg: amqp.ConsumeMessage | null) {
    if (!msg) return;
    let payload: SyncedPayload;
    try {
      payload = JSON.parse(msg.content.toString()) as SyncedPayload;
    } catch {
      this.channel?.nack(msg, false, false);
      return;
    }
    try {
      await this.exportReadings(payload);
      this.channel?.ack(msg);
    } catch (err) {
      this.logger.error(`FHIR export failed for device ${payload.deviceId}: ${String(err)}`);
      // Leave for redelivery; never delete the reading.
      this.channel?.nack(msg, false, false);
    }
  }

  async exportReadings(payload: SyncedPayload): Promise<number> {
    const device = await this.prisma.wearableDevice.findUnique({ where: { id: payload.deviceId } });
    if (!device || !device.shareWithPhysician) return 0;

    const readings = await this.prisma.deviceReading.findMany({
      where: { id: { in: payload.readingIds }, fhirObservationId: null },
    });

    let exported = 0;
    for (const reading of readings) {
      // Idempotency re-check (another worker may have exported it).
      const fresh = await this.prisma.deviceReading.findUnique({ where: { id: reading.id } });
      if (!fresh || fresh.fhirObservationId !== null) continue;

      const obsId = await this.postObservation(device, reading);
      await this.prisma.deviceReading.update({
        where: { id: reading.id },
        data: { fhirObservationId: obsId },
      });
      exported++;
    }

    if (exported > 0) {
      await this.audit.log({
        actorEmail: 'system:wearables-fhir',
        actorRole: 'system',
        action: 'wearable_fhir_export',
        resource: 'wearable_device',
        resourceId: device.id,
        detail: { exported },
      });
    }
    return exported;
  }

  private buildObservation(device: WearableDevice, reading: DeviceReading): Record<string, unknown> {
    const valueQuantity =
      reading.valueNumeric !== null
        ? { value: Number(reading.valueNumeric), unit: reading.unit, system: 'http://unitsofmeasure.org' }
        : undefined;
    return {
      resourceType: 'Observation',
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: device.category === 'medical' ? 'vital-signs' : 'activity',
        }],
      }],
      code: { coding: [{ system: 'http://loinc.org', code: reading.metricType }] },
      subject: {
        identifier: { system: 'https://nemocnicasnina.sk/patient-token', value: device.patientToken },
      },
      effectiveDateTime: reading.recordedAt.toISOString(),
      ...(valueQuantity ? { valueQuantity } : { valueString: reading.valueText ?? '' }),
      device: { display: device.deviceLabel },
    };
  }

  private async postObservation(device: WearableDevice, reading: DeviceReading): Promise<string> {
    if (this.mock) {
      return `MOCK-OBS-${reading.id.slice(0, 8).toUpperCase()}`;
    }
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const token = await this.getFhirToken();
        const res = await fetch(`${this.fhirBase}/Observation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/fhir+json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(this.buildObservation(device, reading)),
        });
        if (!res.ok) throw new Error(`FHIR POST Observation: ${res.status}`);
        const data = (await res.json()) as { id?: string };
        return data.id ?? `unknown-${reading.id.slice(0, 8)}`;
      } catch (err) {
        if (attempt === MAX_RETRIES) throw err;
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 8000)));
      }
    }
    throw new Error('unreachable');
  }

  private async getFhirToken(): Promise<string> {
    const res = await fetch(`${this.fhirBase}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.cfg.get<string>('HIS_FHIR_CLIENT_ID') ?? '',
        client_secret: this.cfg.get<string>('HIS_FHIR_CLIENT_SECRET') ?? '',
        scope: 'system/*.write',
      }).toString(),
    });
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }
}
