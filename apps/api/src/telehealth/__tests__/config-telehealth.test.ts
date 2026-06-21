/**
 * Config validator checks for telehealth env vars — Sprint S6 (T0.1)
 *
 * Design note: `isProduction` in config.schema.ts is captured at module load
 * time from process.env.NODE_ENV. In Jest (NODE_ENV=test) all production-only
 * refine guards are bypassed by design — those are exercised by a separate CI
 * job that exports NODE_ENV=production before running config tests.
 *
 * Tests here cover:
 *   - Default values for every telehealth var
 *   - The recording gate superRefine (runs in ALL environments)
 *   - Routing-key defaults
 *
 * For the recording gate: pass JS booleans (not strings) because
 * z.coerce.boolean() treats any non-empty string as truthy.
 */
import { validateConfig } from '../../config/config.schema';

const BASE = {
  NODE_ENV:     'development',
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/db',
  REDIS_URL:    'redis://localhost:6379',
  RABBITMQ_URL: 'amqp://localhost:5672',
  JWT_SECRET:   'a'.repeat(64),
};

describe('Config validator — telehealth defaults', () => {
  it('defaults TELEHEALTH_PROVIDER to mock', () => {
    expect(validateConfig({ ...BASE }).TELEHEALTH_PROVIDER).toBe('mock');
  });

  it('defaults LIVEKIT_TURN_REGION to eu', () => {
    expect(validateConfig({ ...BASE }).LIVEKIT_TURN_REGION).toBe('eu');
  });

  it('defaults TELEHEALTH_RECORDING_ENABLED to false', () => {
    expect(validateConfig({ ...BASE }).TELEHEALTH_RECORDING_ENABLED).toBe(false);
  });

  it('defaults TELEHEALTH_RECORDING_DPO_APPROVED to false', () => {
    expect(validateConfig({ ...BASE }).TELEHEALTH_RECORDING_DPO_APPROVED).toBe(false);
  });

  it('defaults TELEHEALTH_SESSION_TTL_SECONDS to 3600', () => {
    expect(validateConfig({ ...BASE }).TELEHEALTH_SESSION_TTL_SECONDS).toBe(3600);
  });

  it('defaults TELEHEALTH_JOIN_WINDOW_SECONDS to 600', () => {
    expect(validateConfig({ ...BASE }).TELEHEALTH_JOIN_WINDOW_SECONDS).toBe(600);
  });

  it('defaults TELEHEALTH_NO_SHOW_GRACE_MINUTES to 15', () => {
    expect(validateConfig({ ...BASE }).TELEHEALTH_NO_SHOW_GRACE_MINUTES).toBe(15);
  });

  it('defaults routing keys', () => {
    const cfg = validateConfig({ ...BASE });
    expect(cfg.TELEHEALTH_SESSION_ENDED_ROUTING_KEY).toBe('telehealth.session.ended');
    expect(cfg.TELEHEALTH_BOOKING_CONFIRMED_ROUTING_KEY).toBe('telehealth.booking.confirmed');
  });

  it('accepts explicit TELEHEALTH_PROVIDER=livekit', () => {
    expect(validateConfig({ ...BASE, TELEHEALTH_PROVIDER: 'livekit' }).TELEHEALTH_PROVIDER).toBe('livekit');
  });
});

describe('Config validator — recording gate (all environments)', () => {
  // superRefine runs regardless of NODE_ENV.
  // Use JS booleans directly to bypass z.coerce.boolean() string-truthy behaviour.

  it('rejects RECORDING_ENABLED=true without DPO_APPROVED=true', () => {
    expect(() =>
      validateConfig({
        ...BASE,
        TELEHEALTH_RECORDING_ENABLED:      true,
        TELEHEALTH_RECORDING_DPO_APPROVED: false,
      }),
    ).toThrow('TELEHEALTH_RECORDING_DPO_APPROVED=true');
  });

  it('accepts RECORDING_ENABLED=true when DPO_APPROVED=true', () => {
    const cfg = validateConfig({
      ...BASE,
      TELEHEALTH_RECORDING_ENABLED:      true,
      TELEHEALTH_RECORDING_DPO_APPROVED: true,
    });
    expect(cfg.TELEHEALTH_RECORDING_ENABLED).toBe(true);
    expect(cfg.TELEHEALTH_RECORDING_DPO_APPROVED).toBe(true);
  });

  it('accepts RECORDING_ENABLED=false without DPO_APPROVED (default state)', () => {
    const cfg = validateConfig({ ...BASE });
    expect(cfg.TELEHEALTH_RECORDING_ENABLED).toBe(false);
  });
});
