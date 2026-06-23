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

  // ── APS (Ambulatory Emergency Service) ───────────────
  PSK_APS_API_URL:        z.string().url().optional(),
  APS_CACHE_TTL_SECONDS:  z.coerce.number().default(600),

  // ── Payments ─────────────────────────────────────────
  LSPP_FEE_EUR:       z.coerce.number().default(1.99),

  // ── Observability ────────────────────────────────────
  LOG_LEVEL:          z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // ── Telehealth / Video ───────────────────────────────────────
  TELEHEALTH_PROVIDER: z.string().default('mock').refine(
    (v) => !isProduction || v !== 'mock',
    { message: 'TELEHEALTH_PROVIDER must not be "mock" in production' },
  ),

  LIVEKIT_URL: z.string().default('wss://livekit.example.eu').refine(
    (v) => !isProduction || v.startsWith('wss://'),
    { message: 'LIVEKIT_URL must use wss:// (TLS) in production' },
  ),

  LIVEKIT_API_KEY:    noChangeme('LIVEKIT_API_KEY').default('CHANGEME'),
  LIVEKIT_API_SECRET: noChangeme('LIVEKIT_API_SECRET').default('CHANGEME'),

  LIVEKIT_TURN_REGION: z.string().default('eu').refine(
    (v) => {
      if (!isProduction) return true;
      if (!v || v.trim() === '') return false;
      const nonEuRegex = /^(us|ap|sa|af|me|ca|au)[-_]/i;
      return !nonEuRegex.test(v);
    },
    {
      message:
        'LIVEKIT_TURN_REGION must be an EU-resident region (GDPR Art. 46 — health data must not transit non-EU TURN servers)',
    },
  ),

  TELEHEALTH_SESSION_TTL_SECONDS:   z.coerce.number().default(3600),
  TELEHEALTH_JOIN_WINDOW_SECONDS:   z.coerce.number().default(600),
  TELEHEALTH_NO_SHOW_GRACE_MINUTES: z.coerce.number().default(15),

  TELEHEALTH_RECORDING_ENABLED:     z.coerce.boolean().default(false),
  TELEHEALTH_RECORDING_DPO_APPROVED: z.coerce.boolean().default(false),

  TELEHEALTH_PDF_RETENTION_SECONDS: z.coerce.number().default(604800),

  PDF_SERVICE_URL: z.string().default('http://localhost:3030').refine(
    (v) => !isProduction || !v.includes('localhost'),
    { message: 'PDF_SERVICE_URL must not be localhost in production' },
  ),
  PDF_SERVICE_API_KEY: noChangeme('PDF_SERVICE_API_KEY').default('CHANGEME'),

  TELEHEALTH_SESSION_ENDED_ROUTING_KEY:     z.string().default('telehealth.session.ended'),
  TELEHEALTH_BOOKING_CONFIRMED_ROUTING_KEY: z.string().default('telehealth.booking.confirmed'),

  // ── Wearables & Remote Monitoring ─────────────────────────────
  // WEARABLES_ENABLED stays false until the Sprint W6 compliance gate passes.
  WEARABLES_ENABLED:  z.coerce.boolean().default(false),
  WEARABLES_PROVIDER: z.enum(['mock', 'live']).default('mock'),

  // 32-byte hex (64 hex chars). AES-256-GCM key for OAuth token encryption.
  // Generate: openssl rand -hex 32. The all-zero dev default is rejected in prod.
  WEARABLES_TOKEN_KEY: z.string()
    .default('0'.repeat(64))
    .refine((v) => /^[0-9a-fA-F]{64}$/.test(v), {
      message: 'WEARABLES_TOKEN_KEY must be a 32-byte hex string (64 hex chars)',
    })
    .refine((v) => !isProduction || v !== '0'.repeat(64), {
      message: 'WEARABLES_TOKEN_KEY must be set to a real key (not the dev default) in production',
    }),

  WEARABLES_OAUTH_REDIRECT_BASE: z.string().url().default('http://localhost:4000'),
  WEARABLES_GDPR_RETENTION_DAYS:           z.coerce.number().default(90),
  WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS:  z.coerce.number().default(90),
  // W5/W6 — escalation SMS recipient for critical alerts (no physicians table, so
  // alerts route to a configured on-call number), Garmin webhook HMAC key, and the
  // public portal base the OAuth callback redirects back to.
  WEARABLES_ALERT_SMS_TO: z.string().default(''),
  GARMIN_WEBHOOK_KEY:     z.string().default(''),
  WEB_PORTAL_BASE_URL:    z.string().url().default('http://localhost:3000'),
}).superRefine((data, ctx) => {
  // Wearables live provider requires the feature flag to be on (W6 gate).
  if (data.WEARABLES_PROVIDER === 'live' && !data.WEARABLES_ENABLED) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['WEARABLES_PROVIDER'],
      message:
        'WEARABLES_PROVIDER=live requires WEARABLES_ENABLED=true (Sprint W6 compliance gate)',
    });
  }

  // Recording gate: RECORDING_ENABLED=true requires DPO_APPROVED=true
  if (data.TELEHEALTH_RECORDING_ENABLED && !data.TELEHEALTH_RECORDING_DPO_APPROVED) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['TELEHEALTH_RECORDING_ENABLED'],
      message:
        'TELEHEALTH_RECORDING_ENABLED=true requires TELEHEALTH_RECORDING_DPO_APPROVED=true (DPO sign-off required)',
    });
  }
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
