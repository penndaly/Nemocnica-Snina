/**
 * Withings Health API adapter — shared by medical-grade (BPM Connect Pro) and
 * consumer (ScanWatch, Body+) devices (re-exported for W3's ConsumerAdaptersModule).
 *
 * One getmeas response can carry a BP pair (meastype 9 + 10) at the same
 * timestamp; these MUST become two separate device_readings rows so
 * alert.service.ts can evaluate systolic and diastolic thresholds independently.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WearableDevice } from '@prisma/client';
import type { RawReading, TokenSet, WearablePlatformAdapter } from '../../platform-adapter.interface';
import { TokenCryptoService } from '../../token-crypto.service';
import { WearablesConfigError } from '../../platform-catalog';
import { postForm } from '../oauth-http';

const AUTHORIZE = 'https://account.withings.com/oauth2_user/authorize2';
const OAUTH = 'https://wbsapi.withings.net/v2/oauth2';
const MEASURE = 'https://wbsapi.withings.net/measure?action=getmeas';

interface WithingsMeasure {
  type: number;
  value: number;
  unit?: number;
}
interface WithingsGroup {
  date: number; // epoch seconds
  measures: WithingsMeasure[];
}

// Withings getmeas meastype → reading. (Per the Withings Measure API:
// 1=weight, 9=diastolic, 10=systolic, 11=heart pulse, 54=SpO2, 88=bone mass.)
const MEASTYPE: Record<number, { metricType: string; unit: string; sk: string; en: string }> = {
  1: { metricType: '29463-7', unit: 'kg', sk: 'Hmotnosť', en: 'Weight' },
  9: { metricType: '8462-4', unit: 'mmHg', sk: 'Diastolický TK', en: 'Diastolic BP' },
  10: { metricType: '8480-6', unit: 'mmHg', sk: 'Systolický TK', en: 'Systolic BP' },
  11: { metricType: '8867-4', unit: 'bpm', sk: 'Tep', en: 'Heart rate' },
  54: { metricType: '59408-5', unit: '%', sk: 'SpO2', en: 'SpO2' },
};

@Injectable()
export class WithingsAdapter implements WearablePlatformAdapter {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectBase: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly crypto: TokenCryptoService,
  ) {
    this.clientId = cfg.get<string>('WITHINGS_CLIENT_ID') ?? '';
    this.clientSecret = cfg.get<string>('WITHINGS_CLIENT_SECRET') ?? '';
    this.redirectBase = cfg.get<string>('WEARABLES_OAUTH_REDIRECT_BASE') ?? 'http://localhost:4000';
  }

  private scale(m: WithingsMeasure): number {
    // Withings encodes the real value as value × 10^unit (e.g. 75000 × 10⁻³ = 75 kg).
    const v = m.value * Math.pow(10, m.unit ?? 0);
    return Math.round(v * 100) / 100;
  }

  /** Expand getmeas groups to flat readings — BP pair → two rows, same recorded_at. */
  mapMeasures(groups: WithingsGroup[]): RawReading[] {
    const out: RawReading[] = [];
    for (const grp of groups) {
      const recordedAt = new Date(grp.date * 1000);
      for (const m of grp.measures) {
        const spec = MEASTYPE[m.type];
        if (!spec) continue; // ignore unsupported measure types
        out.push({
          metricType: spec.metricType,
          metricLabel: { sk: spec.sk, en: spec.en },
          valueNumeric: this.scale(m),
          unit: spec.unit,
          recordedAt,
        });
      }
    }
    return out;
  }

  getAuthUrl(_patientId: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: 'user.metrics',
      redirect_uri: `${this.redirectBase}/api/wearables/callback/withings`,
      state,
    });
    return `${AUTHORIZE}?${params.toString()}`;
  }

  async exchangeCode(code: string, _state: string): Promise<TokenSet> {
    const res = await postForm<{ body: { access_token: string; refresh_token: string; expires_in: number } }>(OAUTH, {
      action: 'requesttoken',
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: `${this.redirectBase}/api/wearables/callback/withings`,
    });
    return this.toTokenSet(res.body);
  }

  async syncReadings(device: WearableDevice, from: Date): Promise<RawReading[]> {
    if (!device.oauthAccessTokenEnc) return [];
    const accessToken = this.crypto.decryptToken(device.oauthAccessTokenEnc);
    const res = await postForm<{ body?: { measuregrps?: WithingsGroup[] } }>(MEASURE, {
      access_token: accessToken,
      meastypes: '1,9,10,11,54',
      category: '1',
      startdate: String(Math.floor(from.getTime() / 1000)),
    });
    return this.mapMeasures(res.body?.measuregrps ?? []);
  }

  async refreshToken(device: WearableDevice): Promise<TokenSet> {
    if (!device.oauthRefreshTokenEnc) throw new WearablesConfigError('No refresh token stored');
    const refresh = this.crypto.decryptToken(device.oauthRefreshTokenEnc);
    const res = await postForm<{ body: { access_token: string; refresh_token: string; expires_in: number } }>(OAUTH, {
      action: 'refreshtoken',
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refresh,
    });
    return this.toTokenSet(res.body);
  }

  async revokeToken(device: WearableDevice): Promise<void> {
    if (!device.oauthAccessTokenEnc) return;
    await postForm(OAUTH, { action: 'revoketoken', client_id: this.clientId, client_secret: this.clientSecret });
  }

  private toTokenSet(b: { access_token: string; refresh_token?: string; expires_in?: number }): TokenSet {
    return {
      accessToken: b.access_token,
      refreshToken: b.refresh_token,
      expiresAt: b.expires_in ? new Date(Date.now() + b.expires_in * 1000) : undefined,
    };
  }
}
