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

/**
 * Strict env→boolean parser. z.coerce.boolean() is unsafe for env flags: it uses
 * JS Boolean(), so the string "false" coerces to TRUE — meaning OIDC_MOCK_ENABLED=false
 * would silently ENABLE the mock in production. This only treats the literal "true"
 * as true and "false" as false; anything else (unset / empty / typo) falls back to
 * the explicit default. Returns a real boolean for downstream .refine()/.superRefine().
 */
const strictBool = (defaultVal: boolean) =>
  z.union([z.string(), z.boolean()]).optional().transform((v) => {
    if (typeof v === 'boolean') return v;           // programmatic callers / tests
    if (v === 'true') return true;
    if (v === 'false') return false;                // the fix: NOT truthy-coerced
    return defaultVal;                              // unset / empty / typo
  });

/**
 * Hex secret of a fixed byte length (e.g. AES-256-GCM key = 32 bytes = 64 hex
 * chars). The all-zero dev default is rejected in production. Mirrors the
 * WEARABLES_TOKEN_KEY pattern.
 */
const hexSecret = (name: string, bytes: number) => {
  const chars = bytes * 2;
  const devDefault = '0'.repeat(chars);
  return z
    .string()
    .default(devDefault)
    .refine((v) => new RegExp(`^[0-9a-fA-F]{${chars}}$`).test(v), {
      message: `${name} must be a ${bytes}-byte hex string (${chars} hex chars)`,
    })
    .refine((v) => !isProduction || v !== devDefault, {
      message: `${name} must be set to a real key (not the dev all-zero default) in production`,
    });
};

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
  MFA_REQUIRED:       strictBool(true).refine(
    (v) => !isProduction || v === true,
    { message: 'MFA_REQUIRED must be true in production (Decree 179/2020)' },
  ),

  // ── Auth: patient (eID / OIDC) ──────────────────────
  OIDC_ISSUER_URL:    z.string().url().default('https://oidc.slovensko.sk'),
  OIDC_CLIENT_ID:     z.string().min(1).default('dev-client'),
  OIDC_CLIENT_SECRET: z.string().min(1).default('dev-secret'),
  OIDC_REDIRECT_URI:  z.string().url().default('http://localhost:3000/sk/portal/callback'),
  OIDC_SCOPES:        z.string().default('openid profile'),
  OIDC_USE_PKCE:      strictBool(true),
  OIDC_MOCK_ENABLED:  strictBool(true).refine(
    (v) => !isProduction || v === false,
    { message: 'OIDC_MOCK_ENABLED must be false in production' },
  ),

  // ── Strapi CMS ──────────────────────────────────────
  STRAPI_URL:         z.string().url().default('http://localhost:1337'),
  STRAPI_API_TOKEN:   z.string().min(1).default('dev-token'),
  // Admin API token used by the CMS write API for privileged operations
  // (media upload, creating i18n localizations). Falls back to STRAPI_API_TOKEN.
  STRAPI_ADMIN_URL:   z.string().url().default('http://localhost:1337'),
  STRAPI_ADMIN_TOKEN: z.string().default(''),
  CONTENT_REVALIDATE_SECONDS: z.coerce.number().default(60),
  // CMS write API auth. CMS_AUTH_BYPASS=true skips the staff-JWT guard on
  // /api/cms/** so the prototype admin can be wired in dev/CI without a real
  // OIDC+MFA session. It MUST be false in production (Decree 179/2020 — MFA
  // for all staff accounts; no bypass).
  // Parsed as a strict env boolean: only the literal "true" enables the bypass
  // (matches CmsAuthGuard's runtime parsing). z.coerce.boolean() is wrong here —
  // it coerces the string "false" to `true`, which would make CMS_AUTH_BYPASS=false
  // unconfigurable in production.
  CMS_AUTH_BYPASS:    z.string().optional().default('false')
    .transform((v) => v.toLowerCase() === 'true')
    .refine(
      (v) => !isProduction || v === false,
      { message: 'CMS_AUTH_BYPASS must be false in production (no auth bypass for staff CMS routes)' },
    ),

  // ── Staff auth, MFA & RBAC (Sprint A2) ───────────────
  // Staff JWT is fully separate from the patient JWT: own signing key
  // (STAFF_JWT_SECRET) + aud claim (ns.staff), never accepted on patient routes.
  // STAFF_TOTP_KEY is the AES-256-GCM key for TOTP-secret encryption — 32 bytes
  // (64 hex chars), despite the sprint note's "32-char" shorthand.
  STAFF_JWT_SECRET:        hexSecret('STAFF_JWT_SECRET', 32),
  STAFF_MFA_SECRET:        hexSecret('STAFF_MFA_SECRET', 32),
  STAFF_TOTP_KEY:          hexSecret('STAFF_TOTP_KEY', 32),
  STAFF_JWT_EXPIRES_IN:    z.string().default('15m'),
  STAFF_REFRESH_EXPIRES_IN: z.string().default('7d'),
  STAFF_MFA_CHALLENGE_TTL_SECONDS: z.coerce.number().default(300), // 5 min MFA challenge
  STAFF_INVITE_EXPIRES_H:  z.coerce.number().default(72),
  STAFF_RESET_EXPIRES_M:   z.coerce.number().default(30),
  STAFF_LOGIN_MAX_FAILURES: z.coerce.number().default(10),         // per hour, then lock
  STAFF_EMAIL_RATE_LIMIT:  z.coerce.number().default(3),           // invite/reset emails per address per hour
  ADMIN_URL:               z.string().url().default('http://localhost:3000/admin'),

  // Patient RC reversible encryption (AES-256-GCM) for NCZI eDohoda + GDPR
  // Art. 15 export. 32-byte hex; all-zero dev default rejected in production.
  RC_ENCRYPTION_KEY:       hexSecret('RC_ENCRYPTION_KEY', 32),

  // ── GDPR data tools & translation (Sprint A3) ────────
  // Export bundles are AES-256-GCM encrypted; stored via the local adapter in
  // dev/CI and an EU S3 bucket in prod (GDPR_STORAGE_PROVIDER). Key is 32-byte
  // hex; the all-zero dev default is rejected in production.
  GDPR_STORAGE_PROVIDER:       z.enum(['local', 's3']).default('local'),
  GDPR_EXPORT_BUCKET:          z.string().default('ns-gdpr-exports-eu'),
  GDPR_EXPORT_KEY:             hexSecret('GDPR_EXPORT_KEY', 32),
  GDPR_EXPORT_URL_TTL_SECONDS: z.coerce.number().default(300),
  GDPR_EXPORT_RETENTION_HOURS: z.coerce.number().default(1),
  // Machine translation: mock in dev/CI, DeepL in prod.
  MT_PROVIDER:        z.enum(['mock', 'deepl']).default('mock'),
  MT_DEEPL_API_KEY:   z.string().default(''),
  MT_TARGET_LOCALES:  z.string().default('cs,pl,hu,uk'),
  MT_GLOSSARY_ID:     z.string().default(''),

  // ── HIS / FHIR ──────────────────────────────────────
  RABBITMQ_URL:       tlsRabbit,
  HIS_FHIR_BASE_URL:  z.string().url().default('https://his-sandbox.local/fhir'),
  HIS_MOCK_ENABLED:   strictBool(true).refine(
    (v) => !isProduction || v === false,
    { message: 'HIS_MOCK_ENABLED must be false in production' },
  ),

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

  TELEHEALTH_RECORDING_ENABLED:     strictBool(false),
  TELEHEALTH_RECORDING_DPO_APPROVED: strictBool(false),

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
  WEARABLES_ENABLED:  strictBool(false),
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

  // Huawei Health is blocked until an EU adequacy decision for China is adopted
  // (no Standard Contractual Clauses cover it yet). WL9 Part D: the validator
  // refuses to let wearables go live with Huawei enabled. See DPIA_WEARABLES_ADDENDUM.md.
  HUAWEI_HEALTH_ENABLED: strictBool(false),

  // ── W2 medical-device adapters ────────────────────────────────
  // Abbott LibreLink Up — EU residency is a GDPR non-negotiable: LIBRE_REGION
  // must be 'eu' (no other value accepted). Creds optional until WEARABLES_PROVIDER=live.
  LIBRE_CLIENT_ID:        z.string().optional(),
  LIBRE_CLIENT_SECRET:    z.string().optional(),
  LIBRE_REGION:           z.enum(['eu']).default('eu'),
  DEXCOM_CLIENT_ID:       z.string().optional(),
  DEXCOM_CLIENT_SECRET:   z.string().optional(),
  DEXCOM_SANDBOX:         strictBool(true),
  WITHINGS_CLIENT_ID:     z.string().optional(),
  WITHINGS_CLIENT_SECRET: z.string().optional(),
  OMRON_CLIENT_ID:        z.string().optional(),
  OMRON_CLIENT_SECRET:    z.string().optional(),
  // Partnership-gated platforms — present so .env.example is self-documenting.
  MEDTRONIC_CLIENT_ID:    z.string().optional(),
  MEDTRONIC_CLIENT_SECRET:z.string().optional(),

  // ── W3 consumer-platform adapters ─────────────────────────────
  // Creds only needed when WEARABLES_PROVIDER=live. GARMIN_WEBHOOK_KEY is already
  // defined above (W6); HUAWEI_HEALTH_ENABLED above (WL9) — not duplicated here.
  FITBIT_CLIENT_ID:             z.string().optional(),
  FITBIT_CLIENT_SECRET:         z.string().optional(),
  GARMIN_CONSUMER_KEY:          z.string().optional(),
  GARMIN_CONSUMER_SECRET:       z.string().optional(),
  GOOGLE_HEALTH_CLIENT_ID:      z.string().optional(),
  GOOGLE_HEALTH_CLIENT_SECRET:  z.string().optional(),
  GOOGLE_PROJECT_ID:            z.string().optional(),
  GOOGLE_FHIR_DATASET:          z.string().optional(),
  GOOGLE_FHIR_STORE:            z.string().optional(),
  SAMSUNG_HEALTH_CLIENT_ID:     z.string().optional(),
  SAMSUNG_HEALTH_CLIENT_SECRET: z.string().optional(),
  APPLE_HEALTH_BUNDLE_ID:       z.string().optional(),
  APPLE_TEAM_ID:                z.string().optional(),
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

  // WL9 Part D — Huawei blocked until the EU adequacy decision for China.
  if (data.WEARABLES_ENABLED && data.HUAWEI_HEALTH_ENABLED) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['HUAWEI_HEALTH_ENABLED'],
      message:
        'HUAWEI_HEALTH_ENABLED must be false or unset until the EU adequacy decision for China is adopted. See DPIA_WEARABLES_ADDENDUM.md.',
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
