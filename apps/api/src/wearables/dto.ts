/**
 * Wearables DTO shapes returned by the controller. Shapes mirror the portal
 * prototype (assets/wearables-demo-data.js) so the W4 portal wiring is a drop-in.
 */

export interface WearableReadingDto {
  id: string;
  metricType: string;
  metricLabel: { sk: string; en: string } & Record<string, string>;
  value: string;            // formatted value (numeric or text)
  unit: string;
  flag: 'normal' | 'high' | 'low' | 'critical' | 'info';
  recordedAt: string;       // ISO
  inHis: boolean;           // fhir_observation_id set
}

export interface WearableDeviceDto {
  id: string;
  platform: string;
  brand: string;
  model: string;
  category: 'medical' | 'consumer';
  deviceType: string;
  status: 'ok' | 'error' | 'pending' | 'revoked';
  shareWithPhysician: boolean;
  partnershipRequired: boolean;
  lastSyncAt: string | null;
  readings: WearableReadingDto[];
}

export interface AvailablePlatformDto {
  platform: string;
  brand: string;
  model: string;
  category: 'medical' | 'consumer';
  deviceType: string;
  partnershipRequired: boolean;
  manualUploadOnly: boolean;
  iosAppRequired: boolean;
}

export interface WearablesResponseDto {
  devices: WearableDeviceDto[];
  available: AvailablePlatformDto[];
}

export interface ConsentDto {
  deviceId: string;
  shareWithPhysician: boolean;
  consents: { consentType: string; granted: boolean; grantedAt: string; withdrawnAt: string | null }[];
}

export interface PhysicianWearableViewDto {
  patientToken: string;
  devices: WearableDeviceDto[];
}

/** One row of the consent audit trail (GDPR Art. 5(2), append-only). */
export interface ConsentAuditEntryDto {
  id: string;
  deviceId: string;
  deviceLabel: string;
  consentType: string;
  action: 'granted' | 'withdrawn';
  ts: string;        // ISO
  ipHash: string;
}

/** PUT /api/wearables/devices/:deviceId/consent body. */
export interface ConsentUpdatePayload {
  type: 'physician_sharing' | 'his_export';
  granted: boolean;
}

/** Result of POST /api/wearables/connect/:platform. */
export interface ConnectResultDto {
  authUrl: string;
}

/** A sync job, returned by POST /sync and polled via GET /sync/:jobId. */
export interface SyncJobDto {
  jobId: string;
  status: string;            // 'pending' | 'running' | 'completed' | 'failed'
  readingsFetched: number;
  error: string | null;
}

export interface UploadResultDto {
  deviceId: string;
  readingsImported: number;
}
