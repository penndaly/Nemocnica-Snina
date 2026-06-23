/**
 * Wearables API client (browser → Next proxy → NestJS).
 *
 * All calls go through /api/portal/wearables/* which forwards the httpOnly
 * patient session. Shapes mirror apps/api/src/wearables/dto.ts so the portal
 * components map 1:1 onto the live API (the prototype demo shim is gone).
 */

export type WearableFlag = 'normal' | 'high' | 'low' | 'critical' | 'info';
export type WearableStatus = 'ok' | 'error' | 'pending' | 'revoked';
export type WearableCategory = 'medical' | 'consumer';

export interface WearableReading {
  id: string;
  metricType: string;
  metricLabel: { sk: string; en: string } & Record<string, string>;
  value: string;
  unit: string;
  flag: WearableFlag;
  recordedAt: string;
  inHis: boolean;
}

export interface WearableDevice {
  id: string;
  platform: string;
  brand: string;
  model: string;
  category: WearableCategory;
  deviceType: string;
  status: WearableStatus;
  shareWithPhysician: boolean;
  partnershipRequired: boolean;
  lastSyncAt: string | null;
  readings: WearableReading[];
}

export interface AvailablePlatform {
  platform: string;
  brand: string;
  model: string;
  category: WearableCategory;
  deviceType: string;
  partnershipRequired: boolean;
  manualUploadOnly: boolean;
  iosAppRequired: boolean;
}

export interface WearablesResponse {
  devices: WearableDevice[];
  available: AvailablePlatform[];
}

export interface ConsentRow {
  consentType: string;
  granted: boolean;
  grantedAt: string;
  withdrawnAt: string | null;
}

export interface ConsentDto {
  deviceId: string;
  shareWithPhysician: boolean;
  consents: ConsentRow[];
}

export interface ConsentAuditEntry {
  id: string;
  deviceId: string;
  deviceLabel: string;
  consentType: string;
  action: 'granted' | 'withdrawn';
  ts: string;
  ipHash: string;
}

export interface SyncJob {
  jobId: string;
  status: string;
  readingsFetched: number;
  error: string | null;
}

export interface ConsentUpdatePayload {
  type: 'physician_sharing' | 'his_export';
  granted: boolean;
}

const BASE = '/api/portal/wearables';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Wearables API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function getWearables(): Promise<WearablesResponse> {
  return jsonOrThrow(await fetch(BASE, { cache: 'no-store' }));
}

export async function connectDevice(platform: string): Promise<{ authUrl: string }> {
  return jsonOrThrow(await fetch(`${BASE}/connect/${platform}`, { method: 'POST' }));
}

export async function disconnectDevice(deviceId: string): Promise<void> {
  await jsonOrThrow(await fetch(`${BASE}/devices/${deviceId}`, { method: 'DELETE' }));
}

export async function getReadings(deviceId: string, limit = 50): Promise<WearableReading[]> {
  return jsonOrThrow(await fetch(`${BASE}/devices/${deviceId}/readings?limit=${limit}`, { cache: 'no-store' }));
}

export async function syncDevice(deviceId: string): Promise<SyncJob> {
  return jsonOrThrow(await fetch(`${BASE}/devices/${deviceId}/sync`, { method: 'POST' }));
}

export async function getSyncJob(deviceId: string, jobId: string): Promise<SyncJob> {
  return jsonOrThrow(await fetch(`${BASE}/devices/${deviceId}/sync/${jobId}`, { cache: 'no-store' }));
}

export async function updateConsent(deviceId: string, payload: ConsentUpdatePayload): Promise<ConsentDto> {
  return jsonOrThrow(
    await fetch(`${BASE}/devices/${deviceId}/consent`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
}

export async function getConsents(deviceId: string): Promise<ConsentDto> {
  return jsonOrThrow(await fetch(`${BASE}/devices/${deviceId}/consents`, { cache: 'no-store' }));
}

export async function getConsentAuditLog(deviceId?: string): Promise<ConsentAuditEntry[]> {
  const q = deviceId ? `?deviceId=${deviceId}` : '';
  return jsonOrThrow(await fetch(`${BASE}/consents/audit${q}`, { cache: 'no-store' }));
}

export interface WearableNotification {
  id: string;
  type: string;
  severity: string;
  deviceId: string | null;
  metricType: string | null;
  value: string | null;
  flag: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function getNotifications(type = 'wearable_alert'): Promise<WearableNotification[]> {
  return jsonOrThrow(await fetch(`${BASE}/notifications?type=${type}`, { cache: 'no-store' }));
}

export async function getUnreadCount(type = 'wearable_alert'): Promise<number> {
  const r = await jsonOrThrow<{ count: number }>(await fetch(`${BASE}/notifications/unread-count?type=${type}`, { cache: 'no-store' }));
  return r.count;
}

export async function markNotificationsRead(type = 'wearable_alert'): Promise<void> {
  await jsonOrThrow(await fetch(`${BASE}/notifications/read-all?type=${type}`, { method: 'PATCH' }));
}

export async function uploadDeviceData(
  platform: string,
  file: { filename: string; size: number },
): Promise<{ deviceId: string; readingsImported: number }> {
  return jsonOrThrow(
    await fetch(`${BASE}/${platform}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(file),
    }),
  );
}
