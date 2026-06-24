/**
 * Google Health Connect adapter — OAuth2 + PKCE. The readings endpoint is the
 * Google Cloud Healthcare FHIR store, so the response is FHIR R4 Observations
 * that map directly to device_readings (metric_type from the LOINC coding).
 *
 * PKCE verifier is derived statelessly from the OAuth state nonce + server key
 * (same pattern as Dexcom).
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { TokenCryptoService } from '../../token-crypto.service';
import { WearablesConfigError } from '../../platform-catalog';
import { getJson, postForm } from '../oauth-http';
import { deriveCodeVerifier, pkceChallenge } from '../pkce';

const AUTH = 'https://accounts.google.com/o/oauth2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const REVOKE = 'https://oauth2.googleapis.com/revoke';

interface FhirObservation {
  code?: { coding?: Array<{ code?: string }> };
  valueQuantity?: { value?: number; unit?: string };
  effectiveDateTime?: string;
}
interface FhirBundle {
  entry?: Array<{ resource?: FhirObservation }>;
}

@Injectable()
export class GoogleHealthAdapter implements WearablePlatformAdapter {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly key: string;
  private readonly redirectBase: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly crypto: TokenCryptoService,
  ) {
    this.clientId = cfg.get<string>('GOOGLE_HEALTH_CLIENT_ID') ?? '';
    this.clientSecret = cfg.get<string>('GOOGLE_HEALTH_CLIENT_SECRET') ?? '';
    this.key = cfg.get<string>('WEARABLES_TOKEN_KEY') ?? '0'.repeat(64);
    this.redirectBase = cfg.get<string>('WEARABLES_OAUTH_REDIRECT_BASE') ?? 'http://localhost:4000';
  }

  private nonceOf(state: string): string {
    return (state ?? '').split('.')[0] ?? '';
  }

  /** FHIR R4 Observations → device_readings. */
  mapObservations(bundle: FhirBundle): RawReading[] {
    const out: RawReading[] = [];
    for (const e of bundle.entry ?? []) {
      const obs = e.resource;
      const code = obs?.code?.coding?.[0]?.code;
      const value = obs?.valueQuantity?.value;
      if (!code || typeof value !== 'number' || !obs?.effectiveDateTime) continue;
      out.push({
        metricType: code,
        metricLabel: { sk: code, en: code },
        valueNumeric: value,
        unit: obs.valueQuantity?.unit ?? '',
        recordedAt: new Date(obs.effectiveDateTime),
      });
    }
    return out;
  }

  getAuthUrl(_patientId: string, state: string): string {
    const challenge = pkceChallenge(deriveCodeVerifier(this.nonceOf(state), this.key));
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/health.heart_rate.read',
        'https://www.googleapis.com/auth/health.blood_pressure.read',
        'https://www.googleapis.com/auth/health.blood_glucose.read',
        'https://www.googleapis.com/auth/health.oxygen_saturation.read',
      ].join(' '),
      redirect_uri: `${this.redirectBase}/api/wearables/callback/google_health`,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return `${AUTH}?${params.toString()}`;
  }

  async exchangeCode(code: string, state: string): Promise<TokenSet> {
    const body = await postForm<{ access_token: string; refresh_token?: string; expires_in?: number }>(TOKEN, {
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code_verifier: deriveCodeVerifier(this.nonceOf(state), this.key),
      redirect_uri: `${this.redirectBase}/api/wearables/callback/google_health`,
    });
    return this.toTokenSet(body);
  }

  async syncReadings(device: WearableDevice, from: Date): Promise<RawReading[]> {
    if (!device.oauthAccessTokenEnc) return [];
    const project = this.cfg.get<string>('GOOGLE_PROJECT_ID') ?? '';
    const dataset = this.cfg.get<string>('GOOGLE_FHIR_DATASET') ?? '';
    const store = this.cfg.get<string>('GOOGLE_FHIR_STORE') ?? '';
    const accessToken = this.crypto.decryptToken(device.oauthAccessTokenEnc);
    const url =
      `https://healthcare.googleapis.com/v1/projects/${project}/datasets/${dataset}/fhirStores/${store}` +
      `/fhir/Observation?date=gt${from.toISOString()}`;
    const bundle = await getJson<FhirBundle>(url, accessToken);
    return this.mapObservations(bundle);
  }

  async refreshToken(device: WearableDevice): Promise<TokenSet> {
    if (!device.oauthRefreshTokenEnc) throw new WearablesConfigError('No refresh token stored');
    const refresh = this.crypto.decryptToken(device.oauthRefreshTokenEnc);
    const body = await postForm<{ access_token: string; refresh_token?: string; expires_in?: number }>(TOKEN, {
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    return this.toTokenSet(body);
  }

  async revokeToken(device: WearableDevice): Promise<void> {
    if (!device.oauthAccessTokenEnc) return;
    const accessToken = this.crypto.decryptToken(device.oauthAccessTokenEnc);
    await postForm(REVOKE, { token: accessToken });
  }

  private toTokenSet(b: { access_token: string; refresh_token?: string; expires_in?: number }): TokenSet {
    return {
      accessToken: b.access_token,
      refreshToken: b.refresh_token,
      expiresAt: b.expires_in ? new Date(Date.now() + b.expires_in * 1000) : undefined,
    };
  }
}
