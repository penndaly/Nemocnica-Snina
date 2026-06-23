import {
  PLATFORM_CATALOG,
  availablePlatforms,
  getPlatformEntry,
  isWearablePlatform,
} from '../platform-catalog';

describe('platform catalogue', () => {
  it('flags cardiac-implant platforms + Meta as partnership-required', () => {
    for (const p of ['medtronic_cardiac', 'abbott_cardiac', 'boston_scientific', 'meta']) {
      expect(PLATFORM_CATALOG[p as keyof typeof PLATFORM_CATALOG].partnershipRequired).toBe(true);
    }
  });

  it('blocks Huawei pending EU adequacy (partnership-required)', () => {
    expect(PLATFORM_CATALOG.huawei.partnershipRequired).toBe(true);
  });

  it('does NOT gate the standard CGM/consumer platforms', () => {
    for (const p of ['abbott_libre', 'dexcom', 'fitbit', 'withings', 'garmin']) {
      expect(PLATFORM_CATALOG[p as keyof typeof PLATFORM_CATALOG].partnershipRequired).toBe(false);
    }
  });

  it('marks AliveCor + Xiaomi as manual-upload only', () => {
    expect(PLATFORM_CATALOG.alivecor.manualUploadOnly).toBe(true);
    expect(PLATFORM_CATALOG.xiaomi.manualUploadOnly).toBe(true);
    expect(PLATFORM_CATALOG.fitbit.manualUploadOnly).toBe(false);
  });

  it('marks Apple Health as requiring an iOS companion app', () => {
    expect(PLATFORM_CATALOG.apple_health.iosAppRequired).toBe(true);
  });

  it('resolves known platforms and rejects unknown ones', () => {
    expect(isWearablePlatform('fitbit')).toBe(true);
    expect(isWearablePlatform('nokia_3310')).toBe(false);
    expect(getPlatformEntry('fitbit')?.brand).toBe('Fitbit');
    expect(getPlatformEntry('nope')).toBeUndefined();
  });

  it('exposes every enum value in the available list', () => {
    expect(availablePlatforms()).toHaveLength(Object.keys(PLATFORM_CATALOG).length);
  });
});
