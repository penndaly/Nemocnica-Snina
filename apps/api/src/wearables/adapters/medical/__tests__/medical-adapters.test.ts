import { ConfigService } from '@nestjs/config';
import { WearablePlatform } from '@prisma/client';
import { TokenCryptoService } from '../../../token-crypto.service';
import { WearablesConfigError, BadRequestPartnership, WearablesStubError } from '../../../platform-catalog';
import { AbbottLibreAdapter } from '../abbott-libre.adapter';
import { DexcomAdapter } from '../dexcom.adapter';
import { WithingsAdapter } from '../withings.adapter';
import { OmronAdapter } from '../omron.adapter';
import { MedtronicCgmAdapter } from '../medtronic-cgm.adapter';
import { MedtronicCardiacAdapter } from '../medtronic-cardiac.adapter';
import { AbbottCardiacAdapter } from '../abbott-cardiac.adapter';
import { BscLatitudeAdapter } from '../bsc-latitude.adapter';
import { AlivecorAdapter } from '../alivecor.adapter';
import { MockAdapter } from '../../../mock.adapter';
import { AdapterRegistry } from '../../adapter-registry.service';
import { pkceChallenge } from '../../pkce';

const KEY = 'a'.repeat(64);
function cfg(over: Record<string, unknown> = {}): ConfigService {
  const map: Record<string, unknown> = {
    WEARABLES_TOKEN_KEY: KEY,
    LIBRE_REGION: 'eu',
    WEARABLES_OAUTH_REDIRECT_BASE: 'http://localhost:4000',
    ...over,
  };
  return { get: (k: string) => map[k] } as never;
}
const crypto = () => new TokenCryptoService(cfg());

describe('W2 medical adapters', () => {
  // G1 — Abbott Libre EU region enforced at construction
  it('G1: Abbott Libre throws WearablesConfigError when LIBRE_REGION ≠ eu', () => {
    expect(() => new AbbottLibreAdapter(cfg({ LIBRE_REGION: 'us' }), crypto())).toThrow(WearablesConfigError);
    expect(() => new AbbottLibreAdapter(cfg(), crypto())).not.toThrow();
  });

  // G2 — glucose conversion
  it('G2: Abbott Libre converts mg/dL → mmol/l (÷18.0182)', () => {
    const a = new AbbottLibreAdapter(cfg(), crypto());
    expect(Math.abs(a.mapGlucose(180) - 10.0)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(a.mapGlucose(72) - 4.0)).toBeLessThanOrEqual(0.01);
  });

  // G3 — PKCE challenge (RFC 7636 Appendix B test vector)
  it('G3: pkceChallenge matches the RFC 7636 Appendix B vector', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  // G4 — Dexcom sandbox URL switch
  it('G4: Dexcom switches base URL on DEXCOM_SANDBOX', () => {
    // DexcomAdapter reads this as a raw env string ('false' !== 'false' is
    // the only way to opt out of the sandbox default) — matches real
    // ConfigService.get() behavior, not a JS boolean.
    const sandbox = new DexcomAdapter(cfg({ DEXCOM_SANDBOX: 'true' }), crypto());
    const prod = new DexcomAdapter(cfg({ DEXCOM_SANDBOX: 'false' }), crypto());
    expect(sandbox.getAuthUrl('tok', 'nonce.sig')).toContain('sandbox-api.dexcom.com');
    expect(prod.getAuthUrl('tok', 'nonce.sig')).toContain('api.dexcom.com');
    expect(prod.getAuthUrl('tok', 'nonce.sig')).not.toContain('sandbox-api');
  });

  // G5 — Withings BP pair → 2 rows, same recorded_at
  it('G5: Withings splits a BP pair into systolic + diastolic rows', () => {
    const w = new WithingsAdapter(cfg(), crypto());
    const rows = w.mapMeasures([{ date: 1_700_000_000, measures: [{ type: 10, value: 120 }, { type: 9, value: 80 }] }]);
    expect(rows).toHaveLength(2);
    const systolic = rows.find((r) => r.metricType === '8480-6');
    const diastolic = rows.find((r) => r.metricType === '8462-4');
    expect(systolic?.valueNumeric).toBe(120);
    expect(diastolic?.valueNumeric).toBe(80);
    expect(systolic?.recordedAt.getTime()).toBe(diastolic?.recordedAt.getTime());
  });

  // G6 — Withings applies the unit exponent (75000 × 10⁻³ = 75 kg)
  it('G6: Withings scales weight via the unit exponent', () => {
    const w = new WithingsAdapter(cfg(), crypto());
    const rows = w.mapMeasures([{ date: 1_700_000_000, measures: [{ type: 1, value: 75000, unit: -3 }] }]);
    expect(rows[0].metricType).toBe('29463-7');
    expect(rows[0].valueNumeric).toBe(75.0);
  });

  // Withings measure-type mapping: 11 = heart pulse, 54 = SpO2 (88 = bone mass, ignored)
  it('Withings maps meastype 11→heart rate and 54→SpO2, ignoring bone mass (88)', () => {
    const w = new WithingsAdapter(cfg(), crypto());
    const rows = w.mapMeasures([
      { date: 1_700_000_000, measures: [{ type: 11, value: 68 }, { type: 54, value: 97 }, { type: 88, value: 2500, unit: -3 }] },
    ]);
    expect(rows.find((r) => r.metricType === '8867-4')?.valueNumeric).toBe(68); // HR
    expect(rows.find((r) => r.metricType === '59408-5')?.valueNumeric).toBe(97); // SpO2
    expect(rows).toHaveLength(2); // bone mass dropped
  });

  // G7 — Omron one BP response → 3 rows, same recorded_at
  it('G7: Omron expands a BP measurement into systolic/diastolic/pulse rows', () => {
    const o = new OmronAdapter(cfg(), crypto());
    const rows = o.mapBloodPressure([{ systolic: 130, diastolic: 85, pulse: 70, measured_at: '2026-06-24T08:00:00Z' }]);
    expect(rows.map((r) => r.metricType).sort()).toEqual(['8462-4', '8480-6', '8867-4']);
    const ts = rows.map((r) => r.recordedAt.getTime());
    expect(new Set(ts).size).toBe(1);
  });

  // G8 — all 5 interface methods present on the 4 live adapters
  it('G8: live adapters implement all five interface methods', () => {
    const adapters = [
      new AbbottLibreAdapter(cfg(), crypto()),
      new DexcomAdapter(cfg(), crypto()),
      new WithingsAdapter(cfg(), crypto()),
      new OmronAdapter(cfg(), crypto()),
    ];
    for (const a of adapters) {
      for (const m of ['getAuthUrl', 'exchangeCode', 'syncReadings', 'refreshToken', 'revokeToken'] as const) {
        expect(typeof (a as unknown as Record<string, unknown>)[m]).toBe('function');
      }
    }
  });

  // G9 — partnership stubs throw BadRequestPartnership; syncReadings returns []
  it('G9: partnership stubs gate getAuthUrl and never initiate OAuth', async () => {
    const stubs = [new MedtronicCgmAdapter(), new MedtronicCardiacAdapter(), new AbbottCardiacAdapter(), new BscLatitudeAdapter()];
    for (const s of stubs) {
      expect(() => s.getAuthUrl('tok', 'state')).toThrow(BadRequestPartnership);
      await expect(s.exchangeCode('c', 's')).rejects.toThrow(BadRequestPartnership);
      await expect(s.syncReadings({} as never, new Date())).resolves.toEqual([]);
    }
  });

  // G10 — AliveCor manual-upload stub
  it('G10: AliveCor returns MANUAL_UPLOAD_REQUIRED', () => {
    const a = new AlivecorAdapter();
    try {
      a.getAuthUrl('tok', 'state');
      fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(WearablesStubError);
      expect((e as WearablesStubError).getResponse()).toMatchObject({ error: 'MANUAL_UPLOAD_REQUIRED' });
    }
  });

  // G11 — TokenCryptoService round-trip + tamper
  it('G11: TokenCryptoService round-trips and rejects tampered ciphertext', () => {
    const c = crypto();
    const ct = c.encryptToken('secret-token');
    expect(ct).not.toBe('secret-token');
    expect(c.decryptToken(ct)).toBe('secret-token');
    expect(() => c.decryptToken(ct.slice(0, -4) + 'AAAA')).toThrow();
  });

  // G12 — AdapterRegistry selects by platform / provider
  it('G12: AdapterRegistry returns mock in mock mode, the platform adapter in live mode', () => {
    const mock = new MockAdapter();
    const abbott = new AbbottLibreAdapter(cfg(), crypto());
    const build = (provider: string) =>
      new AdapterRegistry(
        mock,
        cfg({ WEARABLES_PROVIDER: provider }),
        abbott,
        new DexcomAdapter(cfg(), crypto()),
        new WithingsAdapter(cfg(), crypto()),
        new OmronAdapter(cfg(), crypto()),
        new MedtronicCgmAdapter(),
        new MedtronicCardiacAdapter(),
        new AbbottCardiacAdapter(),
        new BscLatitudeAdapter(),
        new AlivecorAdapter(),
      );
    expect(build('mock').getAdapter(WearablePlatform.abbott_libre)).toBe(mock);
    expect(build('live').getAdapter(WearablePlatform.abbott_libre)).toBe(abbott);
    expect(() => build('live').getAdapter('nonexistent' as WearablePlatform)).toThrow();
  });
});
