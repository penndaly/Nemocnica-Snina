/**
 * Dexcom G7 adapter (CGM) — OAuth2 Authorization Code + PKCE (RFC 7636).
 *
 * The PKCE verifier is derived deterministically from the OAuth state nonce and
 * the server key, so getAuthUrl (builds the challenge) and exchangeCode (sends
 * the verifier) agree without storing the verifier separately. Sandbox vs prod
 * is switched by DEXCOM_SANDBOX.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { TokenCryptoService } from '../../token-crypto.service';
import { WearablesConfigError } from '../../platform-catalog';
import { getJson, postForm } from '../oauth-http';
import { deriveCodeVerifier, pkceChallenge } from '../pkce';

const GLUCOSE_DIVISOR = 18.0182;
const RATE_LIMIT_MS = 5 * 60_000; // Dexcom: 1 call / 5 min / user

interface DexcomEgv {
  systemTime: string;
  displayTime: string;
  value: number; // mg/dL
}

@Injectable()
export class DexcomAdapter implements WearablePlatformAdapter {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly sandbox: boolean;
  private readonly key: string;
  private readonly redirectBase: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly crypto: TokenCryptoService,
  ) {
    this.clientId = cfg.get<string>('DEXCOM_CLIENT_ID') ?? '';
    this.clientSecret = cfg.get<string>('DEXCOM_CLIENT_SECRET') ?? '';
    this.sandbox = cfg.get<boolean>('DEXCOM_SANDBOX') ?? true;
    this.key = cfg.get<string>('WEARABLES_TOKEN_KEY') ?? '0'.repeat(64);
    this.redirectBase = cfg.get<string>('WEARABLES_OAUTH_REDIRECT_BASE') ?? 'http://localhost:4000';
  }

  private get base(): string {
    return this.sandbox ? 'https://sandbox-api.dexcom.com' : 'https://api.dexcom.com';
  }

  private nonceOf(state: string): string {
    return (state ?? '').split('.')[0] ?? '';
  }

  mapGlucose(mgPerDl: number): number {
    return Math.round((mgPerDl / GLUCOSE_DIVISOR) * 100) / 100;
  }

  mapEgvs(egvs: DexcomEgv[]): RawReading[] {
    return egvs.map((e) => ({
      metricType: '14745-4',
      metricLabel: { sk: 'Glukóza', en: 'Glucose' },
      valueNumeric: this.mapGlucose(e.value),
      unit: 'mmol/l',
      recordedAt: new Date(e.systemTime),
    }));
  }

  getAuthUrl(_patientId: string, state: string): string {
    const challenge = pkceChallenge(deriveCodeVerifier(this.nonceOf(state), this.key));
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'offline_access',
      redirect_uri: `${this.redirectBase}/api/wearables/callback/dexcom`,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return `${this.base}/v2/oauth2/login?${params.toString()}`;
  }

  async exchangeCode(code: string, state: string): Promise<TokenSet> {
    const verifier = deriveCodeVerifier(this.nonceOf(state), this.key);
    const body = await postForm<{ access_token: string; refresh_token?: string; expires_in?: number }>(
      `${this.base}/v2/oauth2/token`,
      {
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code_verifier: verifier,
        redirect_uri: `${this.redirectBase}/api/wearables/callback/dexcom`,
      },
    );
    return this.toTokenSet(body);
  }

  async syncReadings(device: WearableDevice, from: Date): Promise<RawReading[]> {
    if (!device.oauthAccessTokenEnc) return [];
    // Respect the 1-call-per-5-min rate limit.
    if (device.lastSyncAt && Date.now() - device.lastSyncAt.getTime() < RATE_LIMIT_MS) return [];
    const accessToken = this.crypto.decryptToken(device.oauthAccessTokenEnc);
    const end = new Date();
    const url = `${this.base}/v3/users/self/egvs?startDate=${from.toISOString()}&endDate=${end.toISOString()}`;
    const data = await getJson<{ records?: DexcomEgv[] }>(url, accessToken);
    return this.mapEgvs(data.records ?? []);
  }

  async refreshToken(device: WearableDevice): Promise<TokenSet> {
    if (!device.oauthRefreshTokenEnc) throw new WearablesConfigError('No refresh token stored');
    const refresh = this.crypto.decryptToken(device.oauthRefreshTokenEnc);
    const body = await postForm<{ access_token: string; refresh_token?: string; expires_in?: number }>(
      `${this.base}/v2/oauth2/token`,
      {
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      },
    );
    return this.toTokenSet(body);
  }

  async revokeToken(device: WearableDevice): Promise<void> {
    if (!device.oauthAccessTokenEnc) return;
    const accessToken = this.crypto.decryptToken(device.oauthAccessTokenEnc);
    await postForm(`${this.base}/v2/oauth2/revoke`, { token: accessToken, client_id: this.clientId });
  }

  private toTokenSet(b: { access_token: string; refresh_token?: string; expires_in?: number }): TokenSet {
    return {
      accessToken: b.access_token,
      refreshToken: b.refresh_token,
      expiresAt: b.expires_in ? new Date(Date.now() + b.expires_in * 1000) : undefined,
    };
  }
}
