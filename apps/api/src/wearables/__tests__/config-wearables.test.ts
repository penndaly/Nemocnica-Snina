/**
 * Config validator — wearables vars (Sprint W1, Part D + E).
 *
 * NODE_ENV=test, so production-only refine guards are bypassed by design
 * (same convention as config-telehealth.test.ts). The live/enabled cross-check
 * lives in superRefine and runs in ALL environments.
 */
import { validateConfig } from '../../config/config.schema';

const BASE = {
  NODE_ENV:     'development',
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/db',
  REDIS_URL:    'redis://localhost:6379',
  RABBITMQ_URL: 'amqp://localhost:5672',
  JWT_SECRET:   'a'.repeat(64),
};

describe('Config validator — wearables defaults', () => {
  it('defaults WEARABLES_ENABLED to false', () => {
    expect(validateConfig({ ...BASE }).WEARABLES_ENABLED).toBe(false);
  });

  it('defaults WEARABLES_PROVIDER to mock', () => {
    expect(validateConfig({ ...BASE }).WEARABLES_PROVIDER).toBe('mock');
  });

  it('defaults WEARABLES_GDPR_RETENTION_DAYS to 90', () => {
    expect(validateConfig({ ...BASE }).WEARABLES_GDPR_RETENTION_DAYS).toBe(90);
  });

  it('defaults WEARABLES_OAUTH_REDIRECT_BASE to localhost:4000', () => {
    expect(validateConfig({ ...BASE }).WEARABLES_OAUTH_REDIRECT_BASE).toBe('http://localhost:4000');
  });
});

describe('Config validator — WEARABLES_TOKEN_KEY', () => {
  it('accepts a valid 64-char hex key', () => {
    const key = 'a'.repeat(64);
    expect(validateConfig({ ...BASE, WEARABLES_TOKEN_KEY: key }).WEARABLES_TOKEN_KEY).toBe(key);
  });

  it('rejects a key that is not 32-byte hex', () => {
    expect(() =>
      validateConfig({ ...BASE, WEARABLES_TOKEN_KEY: 'too-short' }),
    ).toThrow('32-byte hex');
  });

  it('falls back to the dev default when unset', () => {
    expect(validateConfig({ ...BASE }).WEARABLES_TOKEN_KEY).toBe('0'.repeat(64));
  });
});

describe('Config validator — wearables provider gate (all environments)', () => {
  it('rejects WEARABLES_PROVIDER=live when WEARABLES_ENABLED=false', () => {
    expect(() =>
      validateConfig({ ...BASE, WEARABLES_PROVIDER: 'live', WEARABLES_ENABLED: false }),
    ).toThrow('WEARABLES_ENABLED=true');
  });

  it('accepts WEARABLES_PROVIDER=live when WEARABLES_ENABLED=true', () => {
    const cfg = validateConfig({
      ...BASE,
      WEARABLES_PROVIDER: 'live',
      WEARABLES_ENABLED:  true,
    });
    expect(cfg.WEARABLES_PROVIDER).toBe('live');
    expect(cfg.WEARABLES_ENABLED).toBe(true);
  });

  it('accepts WEARABLES_PROVIDER=mock with WEARABLES_ENABLED=false (default state)', () => {
    const cfg = validateConfig({ ...BASE });
    expect(cfg.WEARABLES_PROVIDER).toBe('mock');
    expect(cfg.WEARABLES_ENABLED).toBe(false);
  });
});
