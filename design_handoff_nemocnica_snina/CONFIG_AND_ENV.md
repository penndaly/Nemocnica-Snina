# Configuration Brief & `.env` Reference — Nemocnica Snina

Single source for every environment variable and external account the production system needs. Hand this to whoever provisions infrastructure and vendor accounts. Every value the developer needs is named here — **no blanks left in the prompts**, only real credentials to be filled by ops.

Legend: 🔴 **secret** (vault only, never committed) · 🟢 **public/config** (safe in repo config) · ⚙️ **derived** (set per environment).

---

## How to use
1. Ops creates the vendor accounts in the **Accounts to provision** table and drops secrets into the secret manager (not `.env` in the repo).
2. Copy `.env.example` (below) to `.env.local` (dev) / inject via the secret manager (staging/prod).
3. All 🔴 secrets load from the vault at runtime; `.env.example` ships with **safe placeholders only**.
4. EU region is mandatory for every hosted dependency (Decree 179/2020).

---

## Accounts to provision (ops checklist)
| # | Vendor / service | Used for | Owner | Notes |
|---|---|---|---|---|
| 1 | EU cloud (e.g. GCP `europe-central2` Warsaw / `europe-west3` Frankfurt) | hosting, network, KMS | Ops | EU-only; enable CMEK |
| 2 | Managed PostgreSQL (EU) | operational DB | Ops | private IP, TLS, daily encrypted backups |
| 3 | Managed Redis (EU) | sessions, caching, OTP store | Ops | |
| 4 | RabbitMQ (managed or self-host EU) | HIS async queue | Ops | DLQ enabled |
| 5 | Strapi host (EU) + its own Postgres | CMS | Backend | RBAC + MFA on |
| 6 | **Slovensko.sk eID / ÚPVS** OIDC client | patient auth | Security | request client_id/secret + redirect allowlist |
| 7 | HIS vendor FHIR/HL7 endpoint + creds | bookings → HIS, portal reads | Hospital IT | sandbox first |
| 8 | NCZI (eObjednanie / eDohody) access | national scheduling + capitation XML | Hospital IT | |
| 9 | e-VÚC / PSK APS API key | live "who's on duty" feed | Hospital IT | |
| 10 | SMS gateway (e.g. local SK provider) | OTP, confirmations, reminders | Ops | sender ID registered |
| 11 | Payment gateway (PCI, e.g. GP webpay / Stripe EU) | LSPP fee, paid documents | Finance | hosted fields/redirect |
| 12 | Google Cloud Translation (v3) + glossary bucket | cs/pl/hu/uk | Backend | service-account JSON |
| 13 | Email/transactional (optional) | staff notifications | Ops | |
| 14 | Error monitoring + uptime (EU) | observability | Ops | scrub PII |

---

## `.env.example` (commit this — placeholders only)
```dotenv
# ───────────────────────── Core ─────────────────────────
NODE_ENV=development
APP_BASE_URL=http://localhost:3000           # 🟢 prod: https://www.nemocnicasnina.sk
API_BASE_URL=http://localhost:4000           # 🟢
DEFAULT_LOCALE=sk                            # 🟢
SUPPORTED_LOCALES=sk,cs,pl,hu,uk,en          # 🟢
TZ=Europe/Bratislava                         # 🟢

# ───────────────────────── Database ─────────────────────────
DATABASE_URL=postgresql://app:CHANGEME@localhost:5432/nemocnica   # 🔴
# Migrations/admin use a SEPARATE role WITHOUT update/delete on audit_log (see COMPLETION_BRIEF A2)
DATABASE_MIGRATION_URL=postgresql://migrator:CHANGEME@localhost:5432/nemocnica  # 🔴
REDIS_URL=redis://localhost:6379             # 🔴 prod: rediss:// (TLS)

# ───────────────────────── Auth: staff (admin/clinician) ─────────────────────────
JWT_SECRET=CHANGEME_min_32_chars             # 🔴
JWT_ACCESS_TTL=900                           # 🟢 seconds (15m)
JWT_REFRESH_TTL=2592000                      # 🟢 seconds (30d)
TOTP_ISSUER=Nemocnica Snina Admin            # 🟢 shown in authenticator apps
MFA_REQUIRED=true                            # 🟢 must stay true (Decree 179/2020)

# ───────────────────────── Auth: patient (eID / OIDC) ─────────────────────────
OIDC_ISSUER_URL=https://oidc.slovensko.sk    # 🟢 (use sandbox issuer in dev)
OIDC_CLIENT_ID=CHANGEME                       # 🔴
OIDC_CLIENT_SECRET=CHANGEME                   # 🔴
OIDC_REDIRECT_URI=http://localhost:3000/sk/portal/callback   # 🟢 must be allowlisted with the broker
OIDC_SCOPES=openid profile                    # 🟢
OIDC_USE_PKCE=true                            # 🟢
# Local/CI mock IdP so tests don't hit the live broker:
OIDC_MOCK_ENABLED=true                        # 🟢 dev/ci only; MUST be false in prod
OIDC_MOCK_PORT=4010                           # 🟢

# ───────────────────────── Strapi CMS ─────────────────────────
STRAPI_URL=http://localhost:1337             # 🟢
STRAPI_API_TOKEN=CHANGEME                     # 🔴 read token for the web/api data layer
STRAPI_WEBHOOK_SECRET=CHANGEME                # 🔴 verifies revalidate webhooks
CONTENT_REVALIDATE_SECONDS=60                 # 🟢 ISR window for CMS edits

# ───────────────────────── HIS (queue consumer + FHIR) ─────────────────────────
RABBITMQ_URL=amqp://guest:guest@localhost:5672   # 🔴 prod: amqps:// (TLS)
HIS_FHIR_BASE_URL=https://his-sandbox.local/fhir # 🟢 hospital-provided
HIS_FHIR_CLIENT_ID=CHANGEME                   # 🔴
HIS_FHIR_CLIENT_SECRET=CHANGEME               # 🔴
HIS_HL7V2_FALLBACK_ENABLED=true               # 🟢
HIS_MOCK_ENABLED=true                         # 🟢 dev/ci sandbox; false in prod

# ───────────────────────── NCZI / e-VÚC ─────────────────────────
NCZI_EDOHODY_ENDPOINT=https://nczi.example/edohody   # 🟢 hospital-provided
NCZI_API_KEY=CHANGEME                         # 🔴
NCZI_DOCTOR_CODE_DEFAULT=CHANGEME             # 🟢 used in eDohoda XML
APS_FEED_URL=https://psk.example/aps          # 🟢 e-VÚC Prešov region
APS_FEED_API_KEY=CHANGEME                     # 🔴
APS_CACHE_TTL_SECONDS=600                     # 🟢

# ───────────────────────── SMS ─────────────────────────
SMS_PROVIDER=console                          # 🟢 dev: console | prod: <vendor>
SMS_API_KEY=CHANGEME                          # 🔴
SMS_SENDER_ID=NemSnina                        # 🟢 registered sender
OTP_TTL_SECONDS=600                           # 🟢 10 min
OTP_MAX_ATTEMPTS=5                            # 🟢
BOOKING_REMINDER_HOURS=48                     # 🟢

# ───────────────────────── Payments ─────────────────────────
PAYMENT_PROVIDER=CHANGEME                      # 🟢 e.g. gpwebpay | stripe-eu
PAYMENT_PUBLIC_KEY=CHANGEME                    # 🟢 publishable/hosted-fields key
PAYMENT_SECRET_KEY=CHANGEME                    # 🔴
PAYMENT_WEBHOOK_SECRET=CHANGEME                # 🔴
LSPP_FEE_EUR=1.99                              # 🟢 General Surgery emergency-use fee

# ───────────────────────── Translation ─────────────────────────
GOOGLE_APPLICATION_CREDENTIALS=./secrets/gcp-translate.json   # 🔴 service-account file (not committed)
GCP_PROJECT_ID=CHANGEME                        # 🟢
TRANSLATION_GLOSSARY_ID=nemocnica-snina-glossary  # 🟢
TRANSLATION_CACHE_TTL_SECONDS=604800           # 🟢 7 days

# ───────────────────────── Observability ─────────────────────────
SENTRY_DSN=                                    # 🔴 optional; scrub PII
LOG_LEVEL=info                                 # 🟢
```

## Secret-handling rules
- 🔴 secrets live **only** in the secret manager / CI secrets — never in the repo. `.env.example` carries placeholders.
- `GOOGLE_APPLICATION_CREDENTIALS` points to a file mounted at runtime; add `secrets/` to `.gitignore`.
- The app's runtime DB role has **INSERT+SELECT only on `audit_log`** (see `COMPLETION_BRIEF.md` A2); migrations use `DATABASE_MIGRATION_URL`.
- In production: `OIDC_MOCK_ENABLED=false`, `HIS_MOCK_ENABLED=false`, `SMS_PROVIDER` real, `rediss://`/`amqps://` TLS URLs, `MFA_REQUIRED=true`.

## Config validation (prompt)
```
Add a startup config validator (e.g. zod/convict) in apps/api and apps/web that loads and
type-checks every variable in .env.example, fails fast with a clear message if a required one is
missing, and ENFORCES production invariants: in NODE_ENV=production assert OIDC_MOCK_ENABLED=false,
HIS_MOCK_ENABLED=false, MFA_REQUIRED=true, DATABASE_URL/REDIS_URL/RABBITMQ_URL use TLS schemes, and
no secret equals a CHANGEME placeholder. Document each var in a generated CONFIG.md table.
```
