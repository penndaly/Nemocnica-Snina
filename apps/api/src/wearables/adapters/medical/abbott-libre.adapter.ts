/**
 * Abbott LibreLink Up adapter (CGM). EU-resident endpoint only — LIBRE_REGION
 * must equal 'eu' (validated at construction AND by the config validator).
 *
 * Patient must accept the connection invite from the hospital LibreView account
 * before syncReadings returns data.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { TokenCryptoService } from '../../token-crypto.service';
import { WearablesConfigError } from '../../platform-catalog';
import { getJson, postForm } from '../oauth-http';

const AUTH = 'https://api.libreview.io/auth';
const TOKEN = 'https://api.libreview.io/auth/token';
const GLUCOSE_DIVISOR = 18.0182; // mg/dL → mmol/l

interface LibreGraphPoint {
  Timestamp: string;
  ValueInMgPerDl: number;
}

@Injectable()
export class AbbottLibreAdapter implements WearablePlatformAdapter {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly region: string;
  private readonly redirectBase: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly crypto: TokenCryptoService,
  ) {
    this.clientId = cfg.get<string>('LIBRE_CLIENT_ID') ?? '';
    this.clientSecret = cfg.get<string>('LIBRE_CLIENT_SECRET') ?? '';
    this.region = cfg.get<string>('LIBRE_REGION') ?? 'eu';
    this.redirectBase = cfg.get<string>('WEARABLES_OAUTH_REDIRECT_BASE') ?? 'http://localhost:4000';
    // EU residency is a GDPR non-negotiable — fail at module init, not at runtime.
    if (this.region !== 'eu') {
      throw new WearablesConfigError(`LIBRE_REGION must be 'eu' (got '${this.region}')`);
    }
  }

  /** mg/dL → mmol/l, 2 decimal places. */
  mapGlucose(mgPerDl: number): number {
    return Math.round((mgPerDl / GLUCOSE_DIVISOR) * 100) / 100;
  }

  mapGraph(points: LibreGraphPoint[]): RawReading[] {
    return points.map((p) => ({
      metricType: '14745-4',
      metricLabel: { sk: 'Glukóza', en: 'Glucose' },
      valueNumeric: this.mapGlucose(p.ValueInMgPerDl),
      unit: 'mmol/l',
      recordedAt: new Date(p.Timestamp),
    }));
  }

  getAuthUrl(patientId: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      region: this.region,
      redirect_uri: `${this.redirectBase}/api/wearables/callback/abbott_libre`,
      state,
      login_hint: patientId,
    });
    return `${AUTH}?${params.toString()}`;
  }

  async exchangeCode(code: string, _state: string): Promise<TokenSet> {
    const body = await postForm<{ access_token: string; refresh_token?: string; expires_in?: number }>(TOKEN, {
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      region: this.region,
    });
    return this.toTokenSet(body);
  }

  async syncReadings(device: WearableDevice, _from: Date): Promise<RawReading[]> {
    if (!device.oauthAccessTokenEnc) return [];
    const accessToken = this.crypto.decryptToken(device.oauthAccessTokenEnc);
    // LIVE-MODE TODO: the LibreLinkUp connection id is provider-specific and is NOT
    // our device UUID. Before live enablement, resolve it from GET /llu/connections
    // after token exchange and persist it (needs a schema column). device.id is a
    // placeholder while WEARABLES_PROVIDER=mock.
    const data = await getJson<{ data?: { graphData?: LibreGraphPoint[] } }>(
      `https://api.libreview.io/llu/connections/${device.id}/graph`,
      accessToken,
    );
    return this.mapGraph(data.data?.graphData ?? []);
  }

  async refreshToken(device: WearableDevice): Promise<TokenSet> {
    if (!device.oauthRefreshTokenEnc) throw new WearablesConfigError('No refresh token stored');
    const refresh = this.crypto.decryptToken(device.oauthRefreshTokenEnc);
    const body = await postForm<{ access_token: string; refresh_token?: string; expires_in?: number }>(TOKEN, {
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      region: this.region,
    });
    return this.toTokenSet(body);
  }

  async revokeToken(device: WearableDevice): Promise<void> {
    if (!device.oauthAccessTokenEnc) return;
    // Best-effort — do not block consent withdrawal on a provider failure.
    const accessToken = this.crypto.decryptToken(device.oauthAccessTokenEnc);
    await fetch(TOKEN, { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` } });
  }

  private toTokenSet(b: { access_token: string; refresh_token?: string; expires_in?: number }): TokenSet {
    return {
      accessToken: b.access_token,
      refreshToken: b.refresh_token,
      expiresAt: b.expires_in ? new Date(Date.now() + b.expires_in * 1000) : undefined,
    };
  }
}
