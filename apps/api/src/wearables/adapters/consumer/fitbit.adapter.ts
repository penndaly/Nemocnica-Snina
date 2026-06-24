/**
 * Fitbit Web API adapter — OAuth2 (Basic-auth token endpoint).
 *
 * Rate limit: 150 calls/hour/user. A sync uses 4 calls; back off at 140 (10-call
 * buffer) by returning [] and marking the device 'pending' — never throw, so the
 * sync job keeps processing other devices.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenCryptoService } from '../../token-crypto.service';
import { WearablesConfigError } from '../../platform-catalog';
import { basicAuth, getJson, postForm } from '../oauth-http';

const API = 'https://api.fitbit.com';
const CALLS_PER_SYNC = 4;
const HOURLY_BUDGET = 140; // 150 limit − 10 buffer

@Injectable()
export class FitbitAdapter implements WearablePlatformAdapter {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectBase: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly crypto: TokenCryptoService,
    private readonly prisma: PrismaService,
  ) {
    this.clientId = cfg.get<string>('FITBIT_CLIENT_ID') ?? '';
    this.clientSecret = cfg.get<string>('FITBIT_CLIENT_SECRET') ?? '';
    this.redirectBase = cfg.get<string>('WEARABLES_OAUTH_REDIRECT_BASE') ?? 'http://localhost:4000';
  }

  getAuthUrl(_patientId: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'heartrate activity sleep oxygen_saturation',
      redirect_uri: `${this.redirectBase}/api/wearables/callback/fitbit`,
      state,
    });
    return `https://www.fitbit.com/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, _state: string): Promise<TokenSet> {
    const body = await postForm<{ access_token: string; refresh_token?: string; expires_in?: number }>(
      `${API}/oauth2/token`,
      { grant_type: 'authorization_code', code, redirect_uri: `${this.redirectBase}/api/wearables/callback/fitbit` },
      { authorization: basicAuth(this.clientId, this.clientSecret) },
    );
    return this.toTokenSet(body);
  }

  async syncReadings(device: WearableDevice, _from: Date): Promise<RawReading[]> {
    if (!device.oauthAccessTokenEnc) return [];
    // Rate-limit backoff: count completed syncs in the last hour.
    const since = new Date(Date.now() - 3_600_000);
    const jobsLastHour = await this.prisma.deviceSyncJob.count({
      where: { deviceId: device.id, status: 'completed', createdAt: { gte: since } },
    });
    if (jobsLastHour * CALLS_PER_SYNC >= HOURLY_BUDGET) {
      await this.prisma.wearableDevice.update({
        where: { id: device.id },
        data: { syncStatus: 'pending', syncError: 'rate_limit_backoff' },
      });
      return []; // do not throw — let the sync job continue with other devices
    }

    const accessToken = this.crypto.decryptToken(device.oauthAccessTokenEnc);
    const today = new Date().toISOString().slice(0, 10);
    const [heart, steps, sleep, spo2] = await Promise.all([
      getJson<FitbitHeart>(`${API}/1/user/-/activities/heart/date/today/1d.json`, accessToken),
      getJson<FitbitSteps>(`${API}/1/user/-/activities/steps/date/today/1d.json`, accessToken),
      getJson<FitbitSleep>(`${API}/1.2/user/-/sleep/date/${today}.json`, accessToken),
      getJson<FitbitSpo2>(`${API}/1/user/-/spo2/date/today.json`, accessToken),
    ]);
    return this.map(heart, steps, sleep, spo2);
  }

  /** Pure mapping of the four Fitbit endpoints to readings. */
  map(heart?: FitbitHeart, steps?: FitbitSteps, sleep?: FitbitSleep, spo2?: FitbitSpo2): RawReading[] {
    const now = new Date();
    const out: RawReading[] = [];
    const resting = heart?.['activities-heart']?.[0]?.value?.restingHeartRate;
    if (typeof resting === 'number') {
      out.push({ metricType: '8867-4', metricLabel: { sk: 'Tep', en: 'Heart rate' }, valueNumeric: resting, unit: 'bpm', recordedAt: now });
    }
    const stepCount = Number(steps?.['activities-steps']?.[0]?.value);
    if (Number.isFinite(stepCount)) {
      out.push({ metricType: '55423-8', metricLabel: { sk: 'Kroky', en: 'Steps' }, valueNumeric: stepCount, unit: 'steps', recordedAt: now });
    }
    const minutesAsleep = sleep?.summary?.totalMinutesAsleep;
    if (typeof minutesAsleep === 'number') {
      out.push({ metricType: '93832-4', metricLabel: { sk: 'Spánok', en: 'Sleep' }, valueNumeric: minutesAsleep, unit: 'min', recordedAt: now });
    }
    const avgSpo2 = spo2?.value?.avg;
    if (typeof avgSpo2 === 'number') {
      out.push({ metricType: '59408-5', metricLabel: { sk: 'SpO2', en: 'SpO2' }, valueNumeric: avgSpo2, unit: '%', recordedAt: now });
    }
    return out;
  }

  async refreshToken(device: WearableDevice): Promise<TokenSet> {
    if (!device.oauthRefreshTokenEnc) throw new WearablesConfigError('No refresh token stored');
    const refresh = this.crypto.decryptToken(device.oauthRefreshTokenEnc);
    const body = await postForm<{ access_token: string; refresh_token?: string; expires_in?: number }>(
      `${API}/oauth2/token`,
      { grant_type: 'refresh_token', refresh_token: refresh },
      { authorization: basicAuth(this.clientId, this.clientSecret) },
    );
    return this.toTokenSet(body);
  }

  async revokeToken(device: WearableDevice): Promise<void> {
    if (!device.oauthAccessTokenEnc) return;
    const accessToken = this.crypto.decryptToken(device.oauthAccessTokenEnc);
    await postForm(`${API}/oauth2/revoke`, { token: accessToken }, { authorization: basicAuth(this.clientId, this.clientSecret) });
  }

  private toTokenSet(b: { access_token: string; refresh_token?: string; expires_in?: number }): TokenSet {
    return {
      accessToken: b.access_token,
      refreshToken: b.refresh_token,
      expiresAt: b.expires_in ? new Date(Date.now() + b.expires_in * 1000) : undefined,
    };
  }
}

interface FitbitHeart { 'activities-heart'?: Array<{ value?: { restingHeartRate?: number } }> }
interface FitbitSteps { 'activities-steps'?: Array<{ value?: string }> }
interface FitbitSleep { summary?: { totalMinutesAsleep?: number } }
interface FitbitSpo2 { value?: { avg?: number } }
