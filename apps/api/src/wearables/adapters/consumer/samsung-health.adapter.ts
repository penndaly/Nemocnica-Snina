/**
 * Samsung Health adapter — OAuth2 (Samsung Developer APIs).
 *
 * Samsung Health REST API requires developer-account approval
 * (developer.samsung.com/health). Allow 2–4 weeks; the API is in limited beta as
 * of 2026. partnershipRequired stays false in the catalog (no signed agreement,
 * just account approval).
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { TokenCryptoService } from '../../token-crypto.service';
import { WearablesConfigError } from '../../platform-catalog';
import { getJson, postForm } from '../oauth-http';

const BASE = 'https://us.health.samsung.com';

interface SamsungDaily {
  date?: string;
  count?: number;
  value?: number;
  duration_min?: number;
}

@Injectable()
export class SamsungHealthAdapter implements WearablePlatformAdapter {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectBase: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly crypto: TokenCryptoService,
  ) {
    this.clientId = cfg.get<string>('SAMSUNG_HEALTH_CLIENT_ID') ?? '';
    this.clientSecret = cfg.get<string>('SAMSUNG_HEALTH_CLIENT_SECRET') ?? '';
    this.redirectBase = cfg.get<string>('WEARABLES_OAUTH_REDIRECT_BASE') ?? 'http://localhost:4000';
  }

  mapDaily(steps?: SamsungDaily, heart?: SamsungDaily, sleep?: SamsungDaily): RawReading[] {
    const now = new Date();
    const out: RawReading[] = [];
    if (typeof steps?.count === 'number') {
      out.push({ metricType: '55423-8', metricLabel: { sk: 'Kroky', en: 'Steps' }, valueNumeric: steps.count, unit: 'steps', recordedAt: now });
    }
    if (typeof heart?.value === 'number') {
      out.push({ metricType: '8867-4', metricLabel: { sk: 'Tep', en: 'Heart rate' }, valueNumeric: heart.value, unit: 'bpm', recordedAt: now });
    }
    if (typeof sleep?.duration_min === 'number') {
      out.push({ metricType: '93832-4', metricLabel: { sk: 'Spánok', en: 'Sleep' }, valueNumeric: sleep.duration_min, unit: 'min', recordedAt: now });
    }
    return out;
  }

  getAuthUrl(_patientId: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'step_count heart_rate sleep',
      redirect_uri: `${this.redirectBase}/api/wearables/callback/samsung_health`,
      state,
    });
    return `${BASE}/auth/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, _state: string): Promise<TokenSet> {
    const body = await postForm<{ access_token: string; refresh_token?: string; expires_in?: number }>(`${BASE}/auth/token`, {
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: `${this.redirectBase}/api/wearables/callback/samsung_health`,
    });
    return this.toTokenSet(body);
  }

  async syncReadings(device: WearableDevice, _from: Date): Promise<RawReading[]> {
    if (!device.oauthAccessTokenEnc) return [];
    const accessToken = this.crypto.decryptToken(device.oauthAccessTokenEnc);
    const [steps, heart, sleep] = await Promise.all([
      getJson<SamsungDaily>(`${BASE}/v1/user/data/daily_step_count`, accessToken),
      getJson<SamsungDaily>(`${BASE}/v1/user/data/heart_rate`, accessToken),
      getJson<SamsungDaily>(`${BASE}/v1/user/data/sleep`, accessToken),
    ]);
    return this.mapDaily(steps, heart, sleep);
  }

  async refreshToken(device: WearableDevice): Promise<TokenSet> {
    if (!device.oauthRefreshTokenEnc) throw new WearablesConfigError('No refresh token stored');
    const refresh = this.crypto.decryptToken(device.oauthRefreshTokenEnc);
    const body = await postForm<{ access_token: string; refresh_token?: string; expires_in?: number }>(`${BASE}/auth/token`, {
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
    await postForm(`${BASE}/auth/revoke`, { token: accessToken });
  }

  private toTokenSet(b: { access_token: string; refresh_token?: string; expires_in?: number }): TokenSet {
    return {
      accessToken: b.access_token,
      refreshToken: b.refresh_token,
      expiresAt: b.expires_in ? new Date(Date.now() + b.expires_in * 1000) : undefined,
    };
  }
}
