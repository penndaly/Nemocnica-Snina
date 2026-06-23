/**
 * Strict env→boolean coercion (security fix).
 *
 * z.coerce.boolean() used JS Boolean(), so the string "false" coerced to TRUE —
 * meaning OIDC_MOCK_ENABLED=false / HIS_MOCK_ENABLED=false in a production .env
 * would silently ENABLE the mock. These tests pin the corrected behaviour.
 *
 * config.schema captures `isProduction` at import time, so each scenario
 * re-imports the module under an isolated NODE_ENV.
 */

// Minimal required vars (no defaults) so a parse can succeed at all.
const REQUIRED = {
  DATABASE_URL: 'postgresql://app:pw@db:5432/ns',
  REDIS_URL: 'redis://localhost:6379',
  RABBITMQ_URL: 'amqp://localhost:5672',
  JWT_SECRET: 'x'.repeat(48),
};

// Production-valid base where every other gated flag passes, so only the flag
// under test varies. OIDC/HIS mocks use "" → false (must be false in prod).
const PROD_BASE = {
  ...REQUIRED,
  REDIS_URL: 'rediss://cache:6379',
  RABBITMQ_URL: 'amqps://mq:5671',
  OIDC_MOCK_ENABLED: 'false',
  HIS_MOCK_ENABLED: 'false',
  MFA_REQUIRED: 'true',
  TELEHEALTH_PROVIDER: 'livekit',
  LIVEKIT_URL: 'wss://livekit.eu',
  LIVEKIT_API_KEY: 'realkey',
  LIVEKIT_API_SECRET: 'realsecret',
  LIVEKIT_TURN_REGION: 'eu-west',
  PDF_SERVICE_URL: 'https://pdf.internal',
  PDF_SERVICE_API_KEY: 'realpdfkey',
  WEARABLES_TOKEN_KEY: 'a'.repeat(64),
};

interface ParseResult {
  ok: boolean;
  data: Record<string, unknown> | null;
  failedPaths: string[];
}

function parse(nodeEnv: string, env: Record<string, string>): ParseResult {
  let out!: ParseResult;
  const prev = process.env.NODE_ENV;
  jest.isolateModules(() => {
    process.env.NODE_ENV = nodeEnv;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ConfigSchema } = require('../config.schema');
    const r = ConfigSchema.safeParse({ NODE_ENV: nodeEnv, ...env });
    out = {
      ok: r.success,
      data: r.success ? r.data : null,
      failedPaths: r.success ? [] : r.error.issues.map((i: any) => i.path.join('.')),
    };
  });
  process.env.NODE_ENV = prev;
  return out;
}

describe('strict boolean coercion — the core defect', () => {
  it('OIDC_MOCK_ENABLED="false" parses to false (was silently true under z.coerce.boolean)', () => {
    const r = parse('development', { ...REQUIRED, OIDC_MOCK_ENABLED: 'false' });
    expect(r.ok).toBe(true);
    expect(r.data!.OIDC_MOCK_ENABLED).toBe(false);
  });

  it('OIDC_MOCK_ENABLED="true" parses to true', () => {
    const r = parse('development', { ...REQUIRED, OIDC_MOCK_ENABLED: 'true' });
    expect(r.data!.OIDC_MOCK_ENABLED).toBe(true);
  });

  it('MFA_REQUIRED="false" parses to false (in dev, where it is allowed)', () => {
    const r = parse('development', { ...REQUIRED, MFA_REQUIRED: 'false' });
    expect(r.ok).toBe(true);
    expect(r.data!.MFA_REQUIRED).toBe(false);
  });

  it('MFA_REQUIRED unset → production default true', () => {
    const { MFA_REQUIRED, ...noMfa } = PROD_BASE;
    const r = parse('production', noMfa);
    expect(r.ok).toBe(true);
    expect(r.data!.MFA_REQUIRED).toBe(true);
  });

  it('the same coercion applies to HIS / WEARABLES / TELEHEALTH_RECORDING flags', () => {
    const r = parse('development', {
      ...REQUIRED,
      HIS_MOCK_ENABLED: 'false',
      WEARABLES_ENABLED: 'false',
      TELEHEALTH_RECORDING_ENABLED: 'false',
      TELEHEALTH_RECORDING_DPO_APPROVED: 'false',
    });
    expect(r.data!.HIS_MOCK_ENABLED).toBe(false);
    expect(r.data!.WEARABLES_ENABLED).toBe(false);
    expect(r.data!.TELEHEALTH_RECORDING_ENABLED).toBe(false);
  });
});

describe('production safety gates still hold with real booleans', () => {
  it('OIDC_MOCK_ENABLED="false" is ACCEPTED in production (and is actually false)', () => {
    const r = parse('production', { ...PROD_BASE, OIDC_MOCK_ENABLED: 'false' });
    expect(r.ok).toBe(true);
    expect(r.data!.OIDC_MOCK_ENABLED).toBe(false);
  });

  it('OIDC_MOCK_ENABLED="true" is REJECTED in production', () => {
    const r = parse('production', { ...PROD_BASE, OIDC_MOCK_ENABLED: 'true' });
    expect(r.ok).toBe(false);
    expect(r.failedPaths).toContain('OIDC_MOCK_ENABLED');
  });

  it('MFA_REQUIRED="false" is REJECTED in production', () => {
    const r = parse('production', { ...PROD_BASE, MFA_REQUIRED: 'false' });
    expect(r.ok).toBe(false);
    expect(r.failedPaths).toContain('MFA_REQUIRED');
  });
});
