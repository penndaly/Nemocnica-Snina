/**
 * Omron Connect adapter (blood pressure). One BP measurement expands to three
 * device_readings rows — systolic (8480-6), diastolic (8462-4), pulse (8867-4) —
 * sharing one recorded_at, so each metric is threshold-evaluated independently.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { TokenCryptoService } from '../../token-crypto.service';
import { WearablesConfigError } from '../../platform-catalog';
import { getJson, postForm } from '../oauth-http';

const AUTHORIZE = 'https://oauth.omronconnect.com/oauth2/authorize';
const TOKEN = 'https://oauth.omronconnect.com/oauth2/token';
const REVOKE = 'https://oauth.omronconnect.com/oauth2/revoke';
const BP = 'https://api.omronconnect.com/measurement/v1/bloodpressure';

interface OmronBp {
  systolic: number;
  diastolic: number;
  pulse: number;
  measured_at: string;
}

@Injectable()
export class OmronAdapter implements WearablePlatformAdapter {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectBase: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly crypto: TokenCryptoService,
  ) {
    this.clientId = cfg.get<string>('OMRON_CLIENT_ID') ?? '';
    this.clientSecret = cfg.get<string>('OMRON_CLIENT_SECRET') ?? '';
    this.redirectBase = cfg.get<string>('WEARABLES_OAUTH_REDIRECT_BASE') ?? 'http://localhost:4000';
  }

  mapBloodPressure(records: OmronBp[]): RawReading[] {
    const out: RawReading[] = [];
    for (const r of records) {
      const recordedAt = new Date(r.measured_at);
      out.push(
        { metricType: '8480-6', metricLabel: { sk: 'Systolický TK', en: 'Systolic BP' }, valueNumeric: r.systolic, unit: 'mmHg', recordedAt },
        { metricType: '8462-4', metricLabel: { sk: 'Diastolický TK', en: 'Diastolic BP' }, valueNumeric: r.diastolic, unit: 'mmHg', recordedAt },
        { metricType: '8867-4', metricLabel: { sk: 'Tep', en: 'Heart rate' }, valueNumeric: r.pulse, unit: 'bpm', recordedAt },
      );
    }
    return out;
  }

  getAuthUrl(_patientId: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'bloodpressure',
      redirect_uri: `${this.redirectBase}/api/wearables/callback/omron`,
      state,
    });
    return `${AUTHORIZE}?${params.toString()}`;
  }

  async exchangeCode(code: string, _state: string): Promise<TokenSet> {
    const body = await postForm<{ access_token: string; refresh_token?: string; expires_in?: number }>(TOKEN, {
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: `${this.redirectBase}/api/wearables/callback/omron`,
    });
    return this.toTokenSet(body);
  }

  async syncReadings(device: WearableDevice, from: Date): Promise<RawReading[]> {
    if (!device.oauthAccessTokenEnc) return [];
    const accessToken = this.crypto.decryptToken(device.oauthAccessTokenEnc);
    const data = await getJson<{ measurements?: OmronBp[] }>(`${BP}?since=${from.toISOString()}`, accessToken);
    return this.mapBloodPressure(data.measurements ?? []);
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
    await postForm(REVOKE, { token: accessToken, client_id: this.clientId });
  }

  private toTokenSet(b: { access_token: string; refresh_token?: string; expires_in?: number }): TokenSet {
    return {
      accessToken: b.access_token,
      refreshToken: b.refresh_token,
      expiresAt: b.expires_in ? new Date(Date.now() + b.expires_in * 1000) : undefined,
    };
  }
}
