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
