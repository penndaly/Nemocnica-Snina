/**
 * Wearable platform adapter contract.
 *
 * Each platform (Abbott Libre, Dexcom, Withings, Fitbit, …) implements this
 * interface in Sprints W2/W3. In W1 only the MockAdapter exists; it is selected
 * when WEARABLES_PROVIDER=mock (the dev/CI default).
 *
 * Partnership-gated platforms (Medtronic, Abbott Cardiac, Boston Scientific,
 * Meta) return a partnership_required error from getAuthUrl/exchangeCode until a
 * signed vendor agreement is in place.
 */
import type { WearableDevice } from '@prisma/client';

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface RawReading {
  metricType: string;                  // LOINC code, e.g. '14745-4'
  metricLabel: { sk: string; en: string } & Record<string, string>;
  valueNumeric?: number;
  valueText?: string;
  unit: string;
  flag?: 'normal' | 'high' | 'low' | 'critical' | 'info';
  recordedAt: Date;
}

export interface WearablePlatformAdapter {
  /** Build the provider OAuth authorize URL for this patient + signed state. */
  getAuthUrl(patientId: string, state: string): string;
  /** Exchange an authorization code for an encrypted-at-rest token set. */
  exchangeCode(code: string, state: string): Promise<TokenSet>;
  /** Fetch readings recorded since `from`. */
  syncReadings(device: WearableDevice, from: Date): Promise<RawReading[]>;
  /** Exchange the stored refresh token for a fresh token set (W6 rotation). */
  refreshToken(device: WearableDevice): Promise<TokenSet>;
  /** Revoke the provider token (called on consent withdrawal / disconnect). */
  revokeToken(device: WearableDevice): Promise<void>;
}

/** DI token for the active platform adapter (mock in W1). */
export const WEARABLE_ADAPTER = Symbol('WEARABLE_ADAPTER');
