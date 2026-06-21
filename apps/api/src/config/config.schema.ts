/**
 * Startup config validator — fails fast if any required variable is missing
 * or if production-invariant rules are violated.
 *
 * Based on CONFIG_AND_ENV.md. Called from main.ts before the app starts.
 */
import { z } from 'zod';

const isProduction = process.env['NODE_ENV'] === 'production';

// TLS URL validators
const tlsPostgres = z.string().url().refine(
  (v) => !isProduction || v.startsWith('postgresql://') || v.startsWith('postgres://'),
  { message: 'DATABASE_URL must use postgresql:// scheme' },
);
const tlsRedis = z.string().url().refine(
  (v) => !isProduction || v.startsWith('rediss://'),
  { message: 'REDIS_URL must use rediss:// (TLS) in production' },
);
const tlsRabbit = z.string().url().refine(
  (v) => !isProduction || v.startsWith('amqps://'),
  { message: 'RABBITMQ_URL must use amqps:// (TLS) in production' },
);

const noChangeme = (name: string, minLen = 1) =>
  z.string().min(minLen).refine(
    (v) => !isProduction || !v.toLowerCase().includes('changeme'),
    { message: `${name} must not contain placeholder value 'CHANGEME' in production` },
  );

export const ConfigSchema = z.object({
  // ── Core ────────────────────────────────────────────
  NODE_ENV:           z.enum(['development', 'test', 'production']).default('development'),
  APP_BASE_URL:       z.string().url().default('http://localhost:3000'),
  API_BASE_URL:       z.string().url().default('http://localhost:4000'),
  DEFAULT_LOCALE:     z.string().default('sk'),
  TZ:                 z.string().default('Europe/Bratislava'),
  PORT:               z.coerce.number().default(4000),

  // ── Database ────────────────────────────────────────
  // DATABASE_URL            — app runtime role (ns_app): restricted on audit_log
  // DATABASE_MIGRATION_URL  — migrator role (nsadmin): used by prisma migrate deploy
  //                           and make db-harden. Never loaded at API runtime.
  DATABASE_URL:           tlsPostgres,
  DATABASE_MIGRATION_URL: tlsPostgres.optional(),
  REDIS_URL:              tlsRedis,

  // ── Auth: staff ─────────────────────────────────────
  JWT_SECRET:         noChangeme('JWT_SECRET', 32),
  JWT_ACCESS_TTL:     z.coerce.number().default(900),
  MFA_REQUIRED:       z.coerce.boolean().refine(
    (v) => !isProduction || v === true,
    { message: 'MFA_REQUIRED must be true in production (Decree 179/2020)' },
  ).default(true),

  // ── Auth: patient (eID / OIDC) ──────────────────────
  OIDC_ISSUER_URL:    z.string().url().default('https://oidc.slovensko.sk'),
  OIDC_CLIENT_ID:     z.string().min(1).default('dev-client'),
  OIDC_CLIENT_SECRET: z.string().min(1).default('dev-secret'),
  OIDC_REDIRECT_URI:  z.string().url().default('http://localhost:3000/sk/portal/callback'),
  OIDC_SCOPES:        z.string().default('openid profile'),
  OIDC_USE_PKCE:      z.coerce.boolean().default(true),
  OIDC_MOCK_ENABLED:  z.coerce.boolean().refine(
    (v) => !isProduction || v === false,
    { message: 'OIDC_MOCK_ENABLED must be false in production' },
  ).default(true),

  // ── Strapi CMS ──────────────────────────────────────
  STRAPI_URL:         z.string().url().default('http://localhost:1337'),
  STRAPI_API_TOKEN:   z.string().min(1).default('dev-token'),
  CONTENT_REVALIDATE_SECONDS: z.coerce.number().default(60),

  // ── HIS / FHIR ──────────────────────────────────────
  RABBITMQ_URL:       tlsRabbit,
  HIS_FHIR_BASE_URL:  z.string().url().default('https://his-sandbox.local/fhir'),
  HIS_MOCK_ENABLED:   z.coerce.boolean().refine(
    (v) => !isProduction || v === false,
    { message: 'HIS_MOCK_ENABLED must be false in production' },
  ).default(true),

  // ── SMS ─────────────────────────────────────────────
  SMS_PROVIDER:       z.string().default('console'),
  SMS_SENDER_ID:      z.string().default('NemSnina'),
  OTP_TTL_SECONDS:    z.coerce.number().default(600),
  OTP_MAX_ATTEMPTS:   z.coerce.number().default(5),
  BOOKING_REMINDER_HOURS: z.coerce.number().default(48),

  // ── Payments ─────────────────────────────────────────
  LSPP_FEE_EUR:       z.coerce.number().default(1.99),

  // ── Observability ────────────────────────────────────
  LOG_LEVEL:          z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * Validates config and throws with a clear message on failure.
 * Call this once at startup before NestJS bootstraps.
 */
export function validateConfig(raw: Record<string, unknown> = process.env as Record<string, unknown>): AppConfig {
  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Config validation failed:\n${messages}\n\nCheck .env or your secrets manager.`);
  }
  return result.data;
}
