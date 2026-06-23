/**
 * CMS_AUTH_BYPASS production gate. config.schema captures `isProduction` at
 * import time, so each scenario re-imports the module under an isolated
 * NODE_ENV via jest.isolateModules.
 */

// A fully production-valid env so the ONLY variable under test is CMS_AUTH_BYPASS.
const PROD_ENV: Record<string, string> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://app:pw@db.internal:5432/ns',
  REDIS_URL: 'rediss://cache.internal:6379',
  RABBITMQ_URL: 'amqps://mq.internal:5671',
  JWT_SECRET: 'x'.repeat(48),
  MFA_REQUIRED: 'true',
  OIDC_MOCK_ENABLED: 'false',
  HIS_MOCK_ENABLED: 'false',
  TELEHEALTH_PROVIDER: 'livekit',
  LIVEKIT_URL: 'wss://livekit.eu.example',
  LIVEKIT_API_KEY: 'realkey',
  LIVEKIT_API_SECRET: 'realsecret',
  LIVEKIT_TURN_REGION: 'eu-west',
  PDF_SERVICE_URL: 'https://pdf.internal',
  PDF_SERVICE_API_KEY: 'realpdfkey',
  WEARABLES_TOKEN_KEY: 'a'.repeat(64),
  // A2 staff secrets (all-zero default is rejected in production).
  STAFF_JWT_SECRET: 'b'.repeat(64),
  STAFF_MFA_SECRET: 'c'.repeat(64),
  STAFF_TOTP_KEY: 'd'.repeat(64),
  GDPR_EXPORT_KEY: 'e'.repeat(64),
};

function validateWith(env: Record<string, string>): { ok: boolean; cmsIssue: boolean; messages: string[] } {
  let result!: { ok: boolean; cmsIssue: boolean; messages: string[] };
  const prev = process.env.NODE_ENV;
  jest.isolateModules(() => {
    process.env.NODE_ENV = env.NODE_ENV;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ConfigSchema } = require('../../config/config.schema');
    const parsed = ConfigSchema.safeParse(env);
    const issues = parsed.success ? [] : parsed.error.issues;
    result = {
      ok: parsed.success,
      cmsIssue: issues.some((i: any) => i.path.join('.') === 'CMS_AUTH_BYPASS'),
      messages: issues.map((i: any) => `${i.path.join('.')}: ${i.message}`),
    };
  });
  process.env.NODE_ENV = prev;
  return result;
}

describe('CMS_AUTH_BYPASS config validation', () => {
  it('rejects CMS_AUTH_BYPASS=true in production', () => {
    const r = validateWith({ ...PROD_ENV, CMS_AUTH_BYPASS: 'true' });
    expect(r.ok).toBe(false);
    expect(r.cmsIssue).toBe(true);
  });

  it('accepts CMS_AUTH_BYPASS=false in production', () => {
    const r = validateWith({ ...PROD_ENV, CMS_AUTH_BYPASS: 'false' });
    expect(r.cmsIssue).toBe(false);
    expect(r.ok).toBe(true);
  });

  it('allows CMS_AUTH_BYPASS=true in development', () => {
    const r = validateWith({ NODE_ENV: 'development', CMS_AUTH_BYPASS: 'true' });
    expect(r.cmsIssue).toBe(false);
  });
});
