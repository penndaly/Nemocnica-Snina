import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import type { HisEvent } from './his-queue.service';
import { AuditService } from '../audit/audit.service';
import { SmsService } from '../sms/sms.service';
import { PrismaService } from '../prisma/prisma.service';

const QUEUE          = 'ns.his.events';
const DLQ            = 'ns.his.events.dlq';
const EXCHANGE       = 'ns.his';
const EZDRAVIA_EXCH  = 'ns.nczi';
const EZDRAVIA_DLQ   = 'ns.nczi.ezdravia.dlq';
const MAX_RETRIES    = 5;

@Injectable()
export class HisSyncConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HisSyncConsumer.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly mock: boolean;
  private readonly fhirBase: string;
  private readonly ezdraviaEndpoint: string;
  private readonly ezdraviaKey: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
    private readonly sms: SmsService,
    private readonly prisma: PrismaService,
  ) {
    this.mock              = cfg.get<string>('HIS_MOCK_ENABLED') === 'true';
    this.fhirBase          = cfg.get<string>('HIS_FHIR_BASE_URL') ?? 'https://his-sandbox.local/fhir';
    this.ezdraviaEndpoint  = cfg.get<string>('NCZI_EDOHODY_ENDPOINT') ?? 'https://api.nczi.sk/ezdravia';
    this.ezdraviaKey       = cfg.get<string>('NCZI_API_KEY') ?? '';
  }

  async onModuleInit() { await this.startConsuming(); }

  async onModuleDestroy() {
    try { await this.channel?.close(); } catch { /* ignore */ }
    try { await this.connection?.close(); } catch { /* ignore */ }
  }

  private async startConsuming() {
    const url = this.cfg.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';
    try {
      this.connection = await amqp.connect(url);
      this.channel    = await this.connection.createChannel();

      this.channel.on('error', (err) => {
        this.logger.warn(`RabbitMQ channel error: ${String(err)}`);
      });

      // NCZI eZdravie DLQ — failures dead-letter here without blocking HIS events
      await this.channel.assertExchange(EZDRAVIA_EXCH, 'direct', { durable: true });
      await this.channel.assertQueue(EZDRAVIA_DLQ, { durable: true });
      await this.channel.bindQueue(EZDRAVIA_DLQ, EZDRAVIA_EXCH, EZDRAVIA_DLQ);

      // Mirror publisher topology exactly — assertQueue args must match
      await this.channel.assertExchange(`${EXCHANGE}.dlx`, 'direct', { durable: true });
      await this.channel.assertQueue(DLQ, { durable: true });
      await this.channel.bindQueue(DLQ, `${EXCHANGE}.dlx`, QUEUE);
      await this.channel.assertExchange(EXCHANGE, 'direct', { durable: true });
      await this.channel.assertQueue(QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange':     `${EXCHANGE}.dlx`,
          'x-dead-letter-routing-key':  QUEUE,
          'x-message-ttl':              7 * 24 * 60 * 60 * 1000, // 7 days
        },
      });

      await this.channel.prefetch(1);

      this.channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        let event: HisEvent;
        try {
          event = JSON.parse(msg.content.toString()) as HisEvent;
        } catch {
          this.channel?.nack(msg, false, false);
          return;
        }
        const success = await this.processWithRetry(event);
        if (success) {
          this.channel?.ack(msg);
        } else {
          this.channel?.nack(msg, false, false);
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

      case 'medication.prescribed': {
        const p = event.payload as Record<string, string>;
        const medRequest = this.buildFhirMedRequest(p);
        const fhirId = await this.postFhirReturnId('MedicationRequest', medRequest, fhirToken);

        // eZdravie submission is non-blocking: failure dead-letters separately
        // and MUST NOT prevent the MedicationRequest from being created in HIS.
        try {
          const prescCode = await this.submitToEzdravia(p, event.idempotencyKey);

          await this.patchFhir(`MedicationRequest/${fhirId}`, {
            identifier: [{ system: 'urn:oid:nczi.ezdravia', value: prescCode }],
          }, fhirToken);

          if (p['patientPhone']) {
            await this.sms.sendRaw(
              p['patientPhone'],
              `Nemocnica Snina — Váš elektronický recept bol vystavený. ` +
              `Kód predpisu NCZI eZdravie: ${prescCode}. ` +
              `Predložte ho v lekárni.`,
            );
          }

          await this.audit.log({
            actorEmail: 'system:his-sync',
            actorRole: 'system',
            action: 'ezdravia_prescription_registered',
            resource: 'MedicationRequest',
            resourceId: fhirId,
            detail: { prescCode, idempotencyKey: event.idempotencyKey },
          });
        } catch (err) {
          this.logger.error(`eZdravie submission failed for ${event.idempotencyKey}: ${String(err)}`);
          await this.audit.log({
            actorEmail: 'system:his-sync',
            actorRole: 'system',
            action: 'ezdravia_prescription_failed',
            resource: 'MedicationRequest',
            resourceId: event.idempotencyKey,
            detail: { error: String(err) },
          });
          // Publish to dedicated eZdravie DLQ — operator retries via admin
          this.publishEzdraviaDlq(event, String(err));
        }
        break;
      }

      case 'portal.refill.requested': {
        const p = event.payload as Record<string, string>;
        // Route refill request to physician HIS inbox via FHIR Task
        await this.postFhir('Task', {
          resourceType: 'Task',
          status: 'requested',
          intent: 'proposal',
          code: { coding: [{ system: 'https://nemocnicasnina.sk/task', code: 'refill-request' }] },
          for: { identifier: { system: 'https://nemocnicasnina.sk/patient', value: p['patientSub'] } },
          focus: { reference: `MedicationRequest/${p['medicationRequestId']}` },
          authoredOn: new Date().toISOString(),
          description: 'Patient-initiated medication refill request from portal',
        }, fhirToken);
        break;
      }

      case 'telehealth.session.ended': {
        await this.syncTelehealthSession(event, fhirToken);
        break;
      }
    }
  }

  private async syncTelehealthSession(event: HisEvent, fhirToken: string): Promise<void> {
    const p = event.payload as Record<string, unknown>;
    const sessionId = String(p['sessionId'] ?? event.idempotencyKey);

    // Idempotency guard — skip if already synced
    const session = await this.prisma.telehealthSession.findUnique({
      where: { id: sessionId },
      include: { summary: true },
    });

    if (!session) {
      this.logger.warn(`telehealth.session.ended: session ${sessionId} not found, skipping`);
      return;
    }

    if (session.hisSynced) {
      this.logger.log(`telehealth.session.ended: session ${sessionId} already synced, acking`);
      return;
    }

    if (this.mock) {
      // HIS sandbox mock — record synthetic IDs and mark synced
      const syntheticEncounterId = `MOCK-ENC-${sessionId.slice(0, 8).toUpperCase()}`;
      await this.markSessionSynced(sessionId, syntheticEncounterId);
      this.logger.log(`[HIS mock] telehealth.session.ended ${sessionId} → Encounter ${syntheticEncounterId}`);
      return;
    }

    // 1. Write FHIR R4 Encounter (class=VR — virtual consultation)
    const encounter = {
      resourceType: 'Encounter',
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'VR',
        display: 'virtual',
      },
      // EHDS-aligned SNOMED CT encounter type (Advisory A1)
      type: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: '448337001',
          display: 'Telemedicine consultation with patient (procedure)',
        }],
      }],
      identifier: [{ system: 'https://nemocnicasnina.sk/telehealth', value: sessionId }],
      period: {
        start: p['startedAt'] ?? p['scheduledAt'],
        end:   p['endedAt'],
      },
      participant: [{
        type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'PPRF' }] }],
        individual: { identifier: { system: 'https://nemocnicasnina.sk/physician', value: String(p['physicianId'] ?? '') } },
      }],
      subject: {
        // patient_token is opaque; not an RČ — GDPR data minimisation preserved
        identifier: { system: 'https://nemocnicasnina.sk/patient-token', value: String(p['patientToken'] ?? '') },
      },
      serviceProvider: { identifier: { system: 'https://nemocnicasnina.sk/clinic', value: String(p['clinicId'] ?? '') } },
      extension: [{
        url: 'https://nemocnicasnina.sk/fhir/StructureDefinition/telehealth-duration-seconds',
        valueInteger: typeof p['durationSeconds'] === 'number' ? p['durationSeconds'] : null,
      }],
    };

    const encounterId = await this.postFhirReturnId('Encounter', encounter, fhirToken);

    // 2. FHIR MedicationRequest + eZdravie if prescription was issued
    if (session.summary?.prescriptionIssued) {
      const medRequest = {
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        encounter: { reference: `Encounter/${encounterId}` },
        subject: {
          identifier: { system: 'https://nemocnicasnina.sk/patient-token', value: session.patientToken },
        },
        authoredOn: new Date().toISOString(),
        medicationCodeableConcept: {
          text: session.summary.prescriptionRef ?? 'Telehealth e-prescription',
        },
        dosageInstruction: [{
          text: session.summary.clinicalNote ?? '',
        }],
      };

      const medRequestId = await this.postFhirReturnId('MedicationRequest', medRequest, fhirToken);

      // Submit to NCZI eZdravie (B2 — Act 362/2011 legal requirement for telehealth)
      // Hospital IT must confirm eZdravie accepts VR encounter type (see TODO comment)
      // TODO: Confirm with Hospital IT that NCZI_EDOHODY_ENDPOINT accepts VR encounter type
      try {
        const prescCode = await this.submitToEzdravia(
          {
            medicationCode: session.summary.prescriptionRef ?? '',
            medicationName: 'Telehealth prescription',
            patientRcHash: session.patientToken, // opaque token; eZdravie uses doctorCode+hospitalIco to resolve patient
            doctorCode: session.physicianId,
            hospitalIco: '', // populated from Hospital singleton by HIS vendor
          },
          sessionId,
        );

        // Update FHIR MedicationRequest with eZdravie prescription code
        await this.patchFhir(`MedicationRequest/${medRequestId}`, {
          identifier: [{ system: 'urn:oid:nczi.ezdravia', value: prescCode }],
        }, fhirToken);

        // Store prescription code in our summary record
        await this.prisma.telehealthSummary.update({
          where: { sessionId },
          data: { prescriptionRef: prescCode },
        });

        await this.audit.log({
          actorEmail: 'system:his-sync',
          actorRole: 'system',
          action: 'ezdravia_telehealth_prescription_registered',
          resource: 'TelehealthSummary',
          resourceId: sessionId,
          detail: { prescCode, medRequestId },
        });
      } catch (err) {
        this.logger.error(`eZdravie telehealth submission failed for session ${sessionId}: ${String(err)}`);
        await this.audit.log({
          actorEmail: 'system:his-sync',
          actorRole: 'system',
          action: 'ezdravia_telehealth_prescription_failed',
          resource: 'TelehealthSummary',
          resourceId: sessionId,
          detail: { error: String(err) },
        });
        // Dead-letter eZdravie failure separately — does NOT roll back the Encounter creation
        this.publishEzdraviaDlq(event, String(err));
      }
    }

    // 3. Write proposed FHIR Appointment if follow-up recommended
    const followUp = session.summary?.followUpRecommendationSk ?? session.summary?.followUpRecommendationEn;
    if (followUp) {
      await this.postFhir('Appointment', {
        resourceType: 'Appointment',
        status: 'proposed',
        description: followUp,
        comment: `Follow-up from teleconsultation Encounter/${encounterId}`,
        participant: [{
          actor: { identifier: { system: 'https://nemocnicasnina.sk/patient-token', value: session.patientToken } },
          status: 'needs-action',
        }],
      }, fhirToken);
    }

    // 4. Mark session as synced and store Encounter ID
    await this.markSessionSynced(sessionId, encounterId);

    await this.audit.log({
      actorEmail: 'system:his-sync',
      actorRole: 'system',
      action: 'telehealth.his_sync.completed',
      resource: 'telehealth_session',
      resourceId: sessionId,
      detail: { encounterId, prescriptionSynced: session.summary?.prescriptionIssued ?? false },
    });
  }

  private async markSessionSynced(sessionId: string, encounterId: string): Promise<void> {
    await this.prisma.telehealthSession.update({
      where: { id: sessionId },
      data: { hisSynced: true },
    });

    // Update summary with the FHIR Encounter ID (enables portal display + purge guard)
    await this.prisma.telehealthSummary.updateMany({
      where: { sessionId },
      data: { hisEncounterId: encounterId },
    });
  }

  private buildFhirMedRequest(p: Record<string, string>): Record<string, unknown> {
    return {
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [{ system: 'urn:oid:2.16.840.1.113883.6.8', code: p['medicationCode'] ?? '' }],
        text: p['medicationName'] ?? '',
      },
      subject: { identifier: { system: 'https://nemocnicasnina.sk/patient', value: p['patientSub'] ?? '' } },
      authoredOn: new Date().toISOString(),
      dosageInstruction: [{ text: p['dosageText'] ?? '' }],
    };
  }

  private async postFhirReturnId(resource: string, body: unknown, token: string): Promise<string> {
    const res = await fetch(`${this.fhirBase}/${resource}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/fhir+json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`FHIR POST ${resource}: ${res.status}`);
    const data = await res.json() as { id?: string };
    return data.id ?? 'unknown';
  }

  private async submitToEzdravia(p: Record<string, string>, idempotencyKey: string): Promise<string> {
    if (this.mock) {
      this.logger.log(`[eZdravie mock] prescription registered: ${idempotencyKey}`);
      return `MOCK-${idempotencyKey.slice(0, 8).toUpperCase()}`;
    }
    const res = await fetch(`${this.ezdraviaEndpoint}/prescriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.ezdraviaKey,
      },
      body: JSON.stringify({
        idempotencyKey,
        medicationCode: p['medicationCode'],
        medicationName: p['medicationName'],
        patientRcHash:  p['patientRcHash'],
        doctorCode:     p['doctorCode'],
        hospitalIco:    p['hospitalIco'],
      }),
    });
    if (!res.ok) throw new Error(`NCZI eZdravie ${res.status}: ${await res.text()}`);
    const data = await res.json() as { prescriptionCode?: string };
    if (!data.prescriptionCode) throw new Error('eZdravie returned no prescriptionCode');
    return data.prescriptionCode;
  }

  private publishEzdraviaDlq(event: HisEvent, error: string): void {
    if (!this.channel) return;
    try {
      this.channel.publish(
        EZDRAVIA_EXCH,
        EZDRAVIA_DLQ,
        Buffer.from(JSON.stringify({ event, error, retriedAt: new Date().toISOString() })),
        { persistent: true, contentType: 'application/json' },
      );
    } catch (publishErr) {
      this.logger.error(`Failed to dead-letter eZdravie event: ${String(publishErr)}`);
    }
  }

  /**
   * UTC offset for Europe/Bratislava on a given date (CET +01:00 in winter,
   * CEST +02:00 in summer). Hardcoding +01:00 wrote every summer booking to the
   * HIS one hour off. Derived from Intl so DST transitions are always correct.
   */
  private bratislavaOffset(date: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Bratislava',
      timeZoneName: 'longOffset',
    }).formatToParts(new Date(`${date}T12:00:00Z`));
    const tz = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+01:00';
    return tz.replace('GMT', '') || '+01:00'; // e.g. "+02:00"
  }

  private buildFhirAppointment(event: HisEvent): Record<string, unknown> {
    const p = event.payload as Record<string, string>;
    return {
      resourceType: 'Appointment',
      status: 'booked',
      identifier: [{ system: 'https://nemocnicasnina.sk/booking', value: event.idempotencyKey }],
      serviceType: [{ coding: [{ code: p['clinicId'] }] }],
      start: `${p['date']}T${p['time']}:00${this.bratislavaOffset(String(p['date']))}`,
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