/**
 * FHIR R4 read client for the patient portal.
 *
 * Reads Condition, MedicationRequest, Observation, and Appointment
 * resources scoped to the authenticated patient's sub (subject identifier).
 *
 * Every access is logged to audit_log (who read which patient's records, when).
 * No patient data is cached or persisted on the web tier.
 *
 * When HIS_MOCK_ENABLED=true, returns the demo fixtures used by the portal.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';

export interface FhirResource { resourceType: string; id?: string; [k: string]: unknown }

@Injectable()
export class FhirReadService {
  private readonly logger = new Logger(FhirReadService.name);
  private readonly mock: boolean;
  private readonly fhirBase: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.mock     = cfg.get<string>('HIS_MOCK_ENABLED') === 'true';
    this.fhirBase = cfg.get<string>('HIS_FHIR_BASE_URL') ?? 'https://his-sandbox.local/fhir';
  }

  async getPatientRecord(patientSub: string, requestorEmail: string, ip: string) {
    await this.audit.log({
      actorEmail: requestorEmail,
      actorRole: 'patient',
      action: 'fhir_read',
      resource: 'patient_record',
      resourceId: patientSub,
      ip,
    });

    if (this.mock) return this.mockPatientRecord();

    const token = await this.getFhirToken();

    const [conditions, medications, observations, appointments] = await Promise.all([
      this.search('Condition', `patient.identifier=${patientSub}`, token),
      this.search('MedicationRequest', `patient.identifier=${patientSub}`, token),
      this.search('Observation', `patient.identifier=${patientSub}&category=laboratory`, token),
      this.search('Appointment', `actor.identifier=${patientSub}&status=booked`, token),
    ]);

    return { conditions, medications, observations, appointments };
  }

  private async search(resource: string, query: string, token: string): Promise<FhirResource[]> {
    const res = await fetch(`${this.fhirBase}/${resource}?${query}`, {
      headers: { Accept: 'application/fhir+json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      this.logger.warn(`FHIR ${resource} search failed: ${res.status}`);
      return [];
    }
    const bundle = await res.json() as { entry?: Array<{ resource: FhirResource }> };
    return bundle.entry?.map((e) => e.resource) ?? [];
  }

  private async getFhirToken(): Promise<string> {
    const res = await fetch(`${this.fhirBase}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     this.cfg.get<string>('HIS_FHIR_CLIENT_ID') ?? '',
        client_secret: this.cfg.get<string>('HIS_FHIR_CLIENT_SECRET') ?? '',
        scope:         'patient/*.read',
      }).toString(),
    });
    const data = await res.json() as { access_token: string };
    return data.access_token;
  }

  private mockPatientRecord() {
    return {
      conditions: [
        { resourceType: 'Condition', id: 'c1', code: { coding: [{ code: 'I10', display: 'Essential hypertension' }] }, clinicalStatus: { coding: [{ code: 'active' }] }, recordedDate: '2024-10-12' },
        { resourceType: 'Condition', id: 'c2', code: { coding: [{ code: 'E11', display: 'Type 2 diabetes mellitus' }] }, clinicalStatus: { coding: [{ code: 'active' }] }, recordedDate: '2022-04-05' },
      ],
      medications: [
        { resourceType: 'MedicationRequest', id: 'm1', status: 'active', medicationCodeableConcept: { text: 'Nebivolol 5 mg' }, dosageInstruction: [{ text: '1× daily (morning)' }] },
        { resourceType: 'MedicationRequest', id: 'm2', status: 'active', medicationCodeableConcept: { text: 'Metformín 850 mg' }, dosageInstruction: [{ text: '2× daily (with meals)' }] },
      ],
      observations: [
        { resourceType: 'Observation', id: 'l1', status: 'final', code: { text: 'Lipid panel' }, valueString: 'Cholesterol 5.8 mmol/l', interpretation: [{ coding: [{ code: 'H' }] }], effectiveDateTime: '2024-09-28' },
        { resourceType: 'Observation', id: 'l2', status: 'final', code: { text: 'HbA1c' }, valueString: '48 mmol/mol (6.5%)', interpretation: [{ coding: [{ code: 'N' }] }], effectiveDateTime: '2024-09-28' },
      ],
      appointments: [
        { resourceType: 'Appointment', id: 'a1', status: 'booked', start: '2024-11-15T09:30:00+01:00', serviceType: [{ text: 'Diabetology clinic' }] },
      ],
    };
  }
}
