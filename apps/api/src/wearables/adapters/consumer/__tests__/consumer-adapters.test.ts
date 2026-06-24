import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { WearablePlatform } from '@prisma/client';
import { TokenCryptoService } from '../../../token-crypto.service';
import { WearablesBlockedError, WearablesStubError, BadRequestPartnership } from '../../../platform-catalog';
import { FitbitAdapter } from '../fitbit.adapter';
import { GarminAdapter } from '../garmin.adapter';
import { GoogleHealthAdapter } from '../google-health.adapter';
import { SamsungHealthAdapter } from '../samsung-health.adapter';
import { AppleHealthAdapter } from '../apple-health.adapter';
import { HuaweiAdapter } from '../huawei.adapter';
import { MetaAdapter } from '../meta.adapter';
import { XiaomiAdapter } from '../xiaomi.adapter';
import { MockAdapter } from '../../../mock.adapter';
import { AbbottLibreAdapter } from '../../medical/abbott-libre.adapter';
import { DexcomAdapter } from '../../medical/dexcom.adapter';
import { WithingsAdapter } from '../../medical/withings.adapter';
import { OmronAdapter } from '../../medical/omron.adapter';
import { MedtronicCgmAdapter } from '../../medical/medtronic-cgm.adapter';
import { MedtronicCardiacAdapter } from '../../medical/medtronic-cardiac.adapter';
import { AbbottCardiacAdapter } from '../../medical/abbott-cardiac.adapter';
import { BscLatitudeAdapter } from '../../medical/bsc-latitude.adapter';
import { AlivecorAdapter } from '../../medical/alivecor.adapter';
import { AdapterRegistry } from '../../adapter-registry.service';

const KEY = 'a'.repeat(64);
const cfg = (over: Record<string, unknown> = {}): ConfigService =>
  ({ get: (k: string) => ({ WEARABLES_TOKEN_KEY: KEY, ...over } as Record<string, unknown>)[k] } as never);
const crypto = () => new TokenCryptoService(cfg());

describe('W3 consumer adapters', () => {
  // G1 — Fitbit rate-limit backoff (no throw)
  it('G1: Fitbit backs off at the hourly budget and returns [] without throwing', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = { deviceSyncJob: { count: jest.fn().mockResolvedValue(36) }, wearableDevice: { update } } as never;
    const fitbit = new FitbitAdapter(cfg(), crypto(), prisma);
    const out = await fitbit.syncReadings({ id: 'd1', oauthAccessTokenEnc: 'enc' } as never, new Date(0));
    expect(out).toEqual([]);
    expect(update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { syncStatus: 'pending', syncError: 'rate_limit_backoff' } });
  });

  // G2 — Fitbit sleep mapping
  it('G2: Fitbit maps minutesAsleep → 93832-4 min', () => {
    const fitbit = new FitbitAdapter(cfg(), crypto(), {} as never);
    const rows = fitbit.map(undefined, undefined, { summary: { totalMinutesAsleep: 420 } }, undefined);
    expect(rows).toEqual([
      expect.objectContaining({ metricType: '93832-4', valueNumeric: 420, unit: 'min' }),
    ]);
  });

  // G4 — Garmin syncReadings returns empty (push platform)
  it('G4: Garmin never polls — syncReadings returns []', async () => {
    const garmin = new GarminAdapter(cfg(), crypto());
    await expect(garmin.syncReadings({} as never, new Date())).resolves.toEqual([]);
  });

  // G5 — Google Health FHIR Observation → reading
  it('G5: Google Health maps a FHIR Observation to a device reading', () => {
    const g = new GoogleHealthAdapter(cfg(), crypto());
    const rows = g.mapObservations({
      entry: [
        {
          resource: {
            code: { coding: [{ code: '8867-4' }] },
            valueQuantity: { value: 72, unit: 'bpm' },
            effectiveDateTime: '2026-06-24T10:00:00Z',
          },
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ metricType: '8867-4', valueNumeric: 72, unit: 'bpm' });
    expect(rows[0].recordedAt.toISOString()).toBe('2026-06-24T10:00:00.000Z');
  });

  // G10 — Huawei blocked at all 5 methods
  it('G10: Huawei is blocked (HUAWEI_BLOCKED_EU_ADEQUACY) and never initiates OAuth', async () => {
    const h = new HuaweiAdapter();
    expect(() => h.getAuthUrl('t', 's')).toThrow(WearablesBlockedError);
    try {
      h.getAuthUrl('t', 's');
    } catch (e) {
      expect((e as WearablesBlockedError).getResponse()).toMatchObject({ error: 'HUAWEI_BLOCKED_EU_ADEQUACY' });
    }
    await expect(h.exchangeCode('c', 's')).rejects.toThrow(WearablesBlockedError);
    await expect(h.refreshToken({} as never)).rejects.toThrow(WearablesBlockedError);
    await expect(h.syncReadings({} as never, new Date())).resolves.toEqual([]);
    await expect(h.revokeToken({} as never)).resolves.toBeUndefined();
  });

  // G12 — Apple IOS_APP_REQUIRED
  it('G12: Apple returns IOS_APP_REQUIRED', () => {
    const a = new AppleHealthAdapter();
    try {
      a.getAuthUrl('t', 's');
      fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(WearablesStubError);
      expect((e as WearablesStubError).getResponse()).toMatchObject({ error: 'IOS_APP_REQUIRED' });
    }
  });

  // G13 — Meta partnership
  it('G13: Meta throws BadRequestPartnership', () => {
    expect(() => new MetaAdapter().getAuthUrl('t', 's')).toThrow(BadRequestPartnership);
  });

  // G14 — all 5 interface methods on the 4 live adapters
  it('G14: live consumer adapters implement all five interface methods', () => {
    const adapters = [
      new FitbitAdapter(cfg(), crypto(), {} as never),
      new GarminAdapter(cfg(), crypto()),
      new GoogleHealthAdapter(cfg(), crypto()),
      new SamsungHealthAdapter(cfg(), crypto()),
    ];
    for (const a of adapters) {
      for (const m of ['getAuthUrl', 'exchangeCode', 'syncReadings', 'refreshToken', 'revokeToken'] as const) {
        expect(typeof (a as unknown as Record<string, unknown>)[m]).toBe('function');
      }
    }
  });

  // G15 — AdapterRegistry resolves consumer platforms after register()
  it('G15: registered consumer adapters resolve in live mode', () => {
    const registry = new AdapterRegistry(
      new MockAdapter(),
      cfg({ WEARABLES_PROVIDER: 'live' }),
      new AbbottLibreAdapter(cfg({ LIBRE_REGION: 'eu' }), crypto()),
      new DexcomAdapter(cfg(), crypto()),
      new WithingsAdapter(cfg(), crypto()),
      new OmronAdapter(cfg(), crypto()),
      new MedtronicCgmAdapter(),
      new MedtronicCardiacAdapter(),
      new AbbottCardiacAdapter(),
      new BscLatitudeAdapter(),
      new AlivecorAdapter(),
    );
    const fitbit = new FitbitAdapter(cfg(), crypto(), {} as never);
    const huawei = new HuaweiAdapter();
    registry.register(WearablePlatform.fitbit, fitbit);
    registry.register(WearablePlatform.huawei, huawei);
    expect(registry.getAdapter(WearablePlatform.fitbit)).toBe(fitbit);
    expect(registry.getAdapter(WearablePlatform.huawei)).toBe(huawei);
  });

  // G16 — no physicians table referenced in consumer adapter code
  it('G16: no "physicians" table reference in consumer adapters', () => {
    const dir = join(__dirname, '..');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    for (const f of files) {
      expect(readFileSync(join(dir, f), 'utf8')).not.toMatch(/physicians/);
    }
  });
});
