/**
 * Static catalogue of supported wearable platforms — the source of truth for the
 * "Connect a device" panel (Sprint W4) and for the connect/callback flows.
 *
 * Mirrors the prototype's `available` list (assets/wearables-demo-data.js) and the
 * wearables non-negotiables:
 *   • Cardiac implant platforms (Medtronic MyCareLink, Abbott Merlin.net, Boston
 *     Scientific Latitude) + Meta require signed vendor agreements →
 *     partnershipRequired=true (connect is blocked until agreements are signed).
 *   • Huawei is blocked until an EU adequacy decision / SCCs → partnershipRequired.
 *   • AliveCor + Xiaomi have no live OAuth API → manualUploadOnly=true.
 *   • Apple HealthKit needs a native iOS companion app → iosAppRequired=true.
 */
import { BadRequestException } from '@nestjs/common';
import type { WearableCategory, WearableDeviceType, WearablePlatform } from '@prisma/client';

// ── Typed platform-gate errors (mapped to HTTP by the controller) ──────────────
// Live in the catalogue so adapters (W2/W3) can throw the canonical gate error
// without importing wearables.service (which would be a circular dependency).

/** Connect blocked: platform needs a signed vendor agreement (cardiac, Meta, …). */
export class BadRequestPartnership extends BadRequestException {
  constructor(platform: string) {
    super({ code: 'partnership_required', platform });
  }
}
/** Connect blocked: platform has no live OAuth API — manual upload only (AliveCor, Xiaomi). */
export class BadRequestUploadOnly extends BadRequestException {
  constructor(platform: string) {
    super({ code: 'manual_upload_only', platform });
  }
}
/** Connect blocked: platform needs the native iOS companion app (Apple Health). */
export class BadRequestIosApp extends BadRequestException {
  constructor(platform: string) {
    super({ code: 'IOS_APP_REQUIRED', platform });
  }
}

/** Misconfigured adapter (e.g. LIBRE_REGION ≠ 'eu'). Thrown at construction. */
export class WearablesConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WearablesConfigError';
  }
}

/** A manual-upload / not-yet-wired adapter path. Carries a stable error code. */
export class WearablesStubError extends BadRequestException {
  constructor(detail: { error: string; platform?: string; note?: string }) {
    super(detail);
  }
}

export interface PlatformCatalogEntry {
  platform: WearablePlatform;
  brand: string;
  model: string;
  category: WearableCategory;
  deviceType: WearableDeviceType;
  partnershipRequired: boolean;
  manualUploadOnly: boolean;
  iosAppRequired: boolean;
}

export const PLATFORM_CATALOG: Record<WearablePlatform, PlatformCatalogEntry> = {
  // ── Medical-grade ───────────────────────────────────────────────────────────
  abbott_libre:      { platform: 'abbott_libre',      brand: 'Abbott',            model: 'FreeStyle Libre 3 / 2+', category: 'medical',  deviceType: 'cgm',        partnershipRequired: false, manualUploadOnly: false, iosAppRequired: false },
  dexcom:            { platform: 'dexcom',            brand: 'Dexcom',            model: 'G7 / ONE+',              category: 'medical',  deviceType: 'cgm',        partnershipRequired: false, manualUploadOnly: false, iosAppRequired: false },
  medtronic_cgm:     { platform: 'medtronic_cgm',     brand: 'Medtronic',         model: 'Guardian 4 CGM',         category: 'medical',  deviceType: 'cgm',        partnershipRequired: false, manualUploadOnly: false, iosAppRequired: false },
  medtronic_cardiac: { platform: 'medtronic_cardiac', brand: 'Medtronic',         model: 'MyCareLink (pacemaker)', category: 'medical',  deviceType: 'pacemaker',  partnershipRequired: true,  manualUploadOnly: false, iosAppRequired: false },
  abbott_cardiac:    { platform: 'abbott_cardiac',    brand: 'Abbott',            model: 'Merlin.net (ICD / PM)',  category: 'medical',  deviceType: 'pacemaker',  partnershipRequired: true,  manualUploadOnly: false, iosAppRequired: false },
  boston_scientific: { platform: 'boston_scientific', brand: 'Boston Scientific', model: 'Latitude NXT',           category: 'medical',  deviceType: 'pacemaker',  partnershipRequired: true,  manualUploadOnly: false, iosAppRequired: false },
  alivecor:          { platform: 'alivecor',          brand: 'AliveCor',          model: 'KardiaMobile 6L',        category: 'medical',  deviceType: 'ecg',        partnershipRequired: false, manualUploadOnly: true,  iosAppRequired: false },
  omron:             { platform: 'omron',             brand: 'Omron',             model: 'Evolv / Complete',       category: 'medical',  deviceType: 'bp',         partnershipRequired: false, manualUploadOnly: false, iosAppRequired: false },

  // ── Consumer / fitness ──────────────────────────────────────────────────────
  withings:          { platform: 'withings',          brand: 'Withings',          model: 'ScanWatch 2 / BPM',      category: 'consumer', deviceType: 'hybrid',     partnershipRequired: false, manualUploadOnly: false, iosAppRequired: false },
  apple_health:      { platform: 'apple_health',      brand: 'Apple',             model: 'Watch (watchOS Health)', category: 'consumer', deviceType: 'smartwatch', partnershipRequired: false, manualUploadOnly: false, iosAppRequired: true  },
  samsung_health:    { platform: 'samsung_health',    brand: 'Samsung',           model: 'Galaxy Watch',           category: 'consumer', deviceType: 'smartwatch', partnershipRequired: false, manualUploadOnly: false, iosAppRequired: false },
  google_health:     { platform: 'google_health',     brand: 'Google',            model: 'Pixel Watch',            category: 'consumer', deviceType: 'smartwatch', partnershipRequired: false, manualUploadOnly: false, iosAppRequired: false },
  fitbit:            { platform: 'fitbit',            brand: 'Fitbit',            model: 'Sense / Charge',         category: 'consumer', deviceType: 'fitness',    partnershipRequired: false, manualUploadOnly: false, iosAppRequired: false },
  garmin:            { platform: 'garmin',            brand: 'Garmin',            model: 'Health Sync (Connect)',  category: 'consumer', deviceType: 'fitness',    partnershipRequired: false, manualUploadOnly: false, iosAppRequired: false },
  huawei:            { platform: 'huawei',            brand: 'Huawei',            model: 'Watch GT / Band',        category: 'consumer', deviceType: 'smartwatch', partnershipRequired: true,  manualUploadOnly: false, iosAppRequired: false },
  xiaomi:            { platform: 'xiaomi',            brand: 'Xiaomi',            model: 'Smart Band / Watch',     category: 'consumer', deviceType: 'fitness',    partnershipRequired: false, manualUploadOnly: true,  iosAppRequired: false },
  meta:              { platform: 'meta',              brand: 'Meta',              model: 'Ray-Ban Smart Glasses',  category: 'consumer', deviceType: 'other',      partnershipRequired: true,  manualUploadOnly: false, iosAppRequired: false },
};

export function getPlatformEntry(platform: string): PlatformCatalogEntry | undefined {
  return PLATFORM_CATALOG[platform as WearablePlatform];
}

export function isWearablePlatform(platform: string): platform is WearablePlatform {
  return platform in PLATFORM_CATALOG;
}

/** The list rendered in the "Connect a device" panel, in catalogue order. */
export function availablePlatforms(): PlatformCatalogEntry[] {
  return Object.values(PLATFORM_CATALOG);
}
