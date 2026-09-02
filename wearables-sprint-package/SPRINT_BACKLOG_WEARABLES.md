# Sprint Backlog — Wearables & Remote Monitoring
## Nemocnica Snina Patient Portal

**Feature branch:** `feature/wearables-remote-monitoring`
**UI prototype:** `portal.html` → Wearables tab (click portal nav "Wearables")
**Demo data file (remove for production):** `assets/wearables-demo-data.js`

---

**Before starting any sprint — paste this context into Claude Code:**
```
Read design_handoff_nemocnica_snina/CONTEXT_PROMPT.md in full before writing any code.
The site is running locally: Next.js on localhost:3000, NestJS API on localhost:4000,
PostgreSQL/Redis/RabbitMQ via Docker. Local fixes already applied (see SPRINT_BACKLOG_v2.md header).
Read design_handoff_nemocnica_snina/SPRINT_BACKLOG_WEARABLES.md §W[X] in full.
Execute Sprint W[X] only, then stop and report Done-when criteria.
```

---

## Non-negotiables (wearables-specific)

- **No raw platform OAuth tokens in logs or DB plaintext.** All `oauth_access_token` and `oauth_refresh_token` values stored AES-256-GCM encrypted (key: `WEARABLES_TOKEN_KEY` — 32-byte hex, config-validated).
- **Explicit per-device GDPR consent before any sync.** `device_consent` row required; absence blocks all reads. Consent withdrawal triggers immediate token revocation + reading soft-delete.
- **No medical device data in client-side storage.** CGM glucose, ECG results, pacemaker telemetry never touch `localStorage` in production — API responses only, held in React state.
- **Cardiac implant platforms (Medtronic MyCareLink, Abbott Merlin.net, Boston Scientific Latitude NXT) require signed partnership agreements** with each vendor before production API access is granted. Prototype uses mock responses. Mark integration `status: partnership_required` until agreements are in place.
- **FHIR Observations exported to HIS are immutable once written.** Never delete or overwrite a synced row in `device_readings`; add a `superseded_by` pointer instead.
- **Alert thresholds are clinician-configurable per patient**, not hardcoded. Defaults ship as seed data; per-patient overrides stored in `device_alert_thresholds`.
- **`WEARABLES_ENABLED=false` in production until Sprint W6 compliance gate passes.** Config validator enforces.

---

## Sprint W1 — Data Model, API Skeleton & Consent Engine 🔴 HIGH

**What's needed:** Database schema, NestJS module skeleton, GDPR consent model, and config additions. No external API calls yet — all platform adapters return mock data.

```
Read portal.html (Wearables tab prototype), assets/wearables-demo-data.js, and
apps/api/src/telehealth/ (use as structural pattern) before writing any code.

─── PART A — Prisma migrations ───────────────────────────────────────────────

Create apps/api/prisma/migrations/YYYYMMDD_wearables/migration.sql with:

1. wearable_platforms enum:
   abbott_libre | dexcom | medtronic_cgm | medtronic_cardiac |
   abbott_cardiac | boston_scientific | alivecor | withings | omron |
   apple_health | google_health | samsung_health | fitbit | garmin |
   huawei | xiaomi | meta

2. wearable_category enum: medical | consumer

3. device_type enum:
   cgm | pacemaker | ecg | bp | smartwatch | fitness | hybrid | other

4. wearable_sync_status enum: ok | error | pending | revoked

5. reading_flag enum: normal | high | low | critical | info

6. wearable_devices table:
   id                    uuid PK default gen_random_uuid()
   patient_token         text NOT NULL          -- opaque eID token, NOT an RC
   platform              wearable_platforms NOT NULL
   device_label          text NOT NULL          -- user-visible e.g. "FreeStyle Libre 3"
   category              wearable_category NOT NULL
   device_type           device_type NOT NULL
   oauth_access_token_enc  text                 -- AES-256-GCM ciphertext
   oauth_refresh_token_enc text                 -- AES-256-GCM ciphertext
   oauth_expires_at      timestamptz
   share_with_physician  boolean NOT NULL default true
   last_sync_at          timestamptz
   sync_status           wearable_sync_status NOT NULL default 'pending'
   sync_error            text
   partnership_required  boolean NOT NULL default false  -- cardiac implants
   connected_at          timestamptz NOT NULL default now()
   disconnected_at       timestamptz
   created_at            timestamptz NOT NULL default now()
   updated_at            timestamptz NOT NULL default now()

7. device_readings table:
   id               uuid PK default gen_random_uuid()
   device_id        uuid NOT NULL REFERENCES wearable_devices(id)
   patient_token    text NOT NULL              -- denormalized for query speed
   metric_type      text NOT NULL              -- LOINC code string e.g. '14745-4'
   metric_label     jsonb NOT NULL             -- {sk,en} bilingual display name
   value_numeric    numeric(12,4)
   value_text       text
   unit             text NOT NULL default ''
   flag             reading_flag NOT NULL default 'normal'
   recorded_at      timestamptz NOT NULL       -- device timestamp
   received_at      timestamptz NOT NULL default now()
   fhir_observation_id  text                  -- set after HIS export; immutable
   superseded_by    uuid REFERENCES device_readings(id)
   created_at       timestamptz NOT NULL default now()

   CREATE INDEX idx_dr_device_recorded ON device_readings(device_id, recorded_at DESC);
   CREATE INDEX idx_dr_patient_recorded ON device_readings(patient_token, recorded_at DESC);

8. device_consent table:
   id              uuid PK default gen_random_uuid()
   patient_token   text NOT NULL
   device_id       uuid NOT NULL REFERENCES wearable_devices(id)
   consent_type    text NOT NULL    -- 'data_storage' | 'physician_sharing' | 'his_export'
   granted         boolean NOT NULL
   granted_at      timestamptz NOT NULL default now()
   withdrawn_at    timestamptz
   ip_hash         text NOT NULL    -- SHA-256 of request IP (GDPR evidence)
   created_at      timestamptz NOT NULL default now()

9. device_alert_thresholds table (clinician-configurable per patient):
   id              uuid PK default gen_random_uuid()
   patient_token   text NOT NULL
   metric_type     text NOT NULL
   threshold_high  numeric(12,4)
   threshold_low   numeric(12,4)
   threshold_critical_high  numeric(12,4)
   threshold_critical_low   numeric(12,4)
   set_by_physician_id  text NOT NULL REFERENCES physicians(id)
   created_at      timestamptz NOT NULL default now()
   updated_at      timestamptz NOT NULL default now()

10. device_sync_jobs table (for background scheduler tracking):
    id              uuid PK
    device_id       uuid NOT NULL REFERENCES wearable_devices(id)
    status          text NOT NULL  -- 'pending'|'running'|'completed'|'failed'
    started_at      timestamptz
    completed_at    timestamptz
    readings_fetched int NOT NULL default 0
    error           text
    created_at      timestamptz NOT NULL default now()

Run `pnpm prisma migrate dev --name wearables` to apply.

─── PART B — NestJS WearablesModule skeleton ─────────────────────────────────

Create apps/api/src/wearables/ with:

wearables.module.ts — imports: PrismaModule, AuditModule, RabbitMQModule
wearables.controller.ts — REST endpoints (all return 501 Not Implemented stubs for now):
  GET    /api/wearables              (patient JWT) → WearableDeviceDto[]
  POST   /api/wearables/connect/:platform  (patient JWT) → { authUrl: string }
  GET    /api/wearables/callback/:platform  (no auth — state param validation) → redirect
  DELETE /api/wearables/devices/:deviceId  (patient JWT) → 204
  GET    /api/wearables/devices/:deviceId/readings  (patient JWT) → ReadingDto[]
  POST   /api/wearables/devices/:deviceId/sync  (patient JWT) → { jobId: string }
  PUT    /api/wearables/devices/:deviceId/consent  (patient JWT) → ConsentDto
  GET    /api/wearables/physician/:patientToken  (clinician JWT, share_with_physician=true only) → PhysicianWearableView

wearables.service.ts — business logic stubs + ConsentService.checkConsent() guard
platform-adapter.interface.ts — WearablePlatformAdapter interface:
  getAuthUrl(patientId: string, state: string): string
  exchangeCode(code: string, state: string): Promise<TokenSet>
  syncReadings(device: WearableDevice, from: Date): Promise<RawReading[]>
  revokeToken(device: WearableDevice): Promise<void>
mock.adapter.ts — implements WearablePlatformAdapter; returns static fixture data
  matching assets/wearables-demo-data.js shape; used when WEARABLES_PROVIDER=mock

─── PART C — Consent engine ──────────────────────────────────────────────────

ConsentService (wearables/consent.service.ts):
  grantConsent(patientToken, deviceId, types[], ipHash) → void; audit_log entry
  withdrawConsent(patientToken, deviceId) → triggers revokeToken(); soft-deletes
    readings (sets superseded_by = null, fhir_observation_id stays intact);
    audit_log entry
  checkConsent(patientToken, deviceId, type) → boolean; throws 403 if absent

ConsentGuard — NestJS guard applied to all /api/wearables/** endpoints:
  Validates patient JWT → extracts patient_token → calls checkConsent('data_storage')
  Throws 403 with body { code: 'WEARABLES_CONSENT_REQUIRED', deviceId } if absent

─── PART D — Config additions ────────────────────────────────────────────────

apps/api/src/config/config.schema.ts — add:
  WEARABLES_ENABLED: boolean (default false; must be true to pass live platform checks)
  WEARABLES_PROVIDER: 'mock' | 'live' (mock only in dev/CI; live rejected unless
    WEARABLES_ENABLED=true)
  WEARABLES_TOKEN_KEY: 32-byte hex (required; config validator enforces)
  WEARABLES_OAUTH_REDIRECT_BASE: URL base for /api/wearables/callback/:platform

Add all to .env.example with safe defaults (WEARABLES_PROVIDER=mock).

─── PART E — Tests ────────────────────────────────────────────────────────────

Unit tests (wearables.service.spec.ts):
  - Consent absent → 403 on any /wearables/** endpoint
  - Consent withdrawal triggers mock revokeToken() + readings soft-delete
  - device_readings with fhir_observation_id set survive consent withdrawal (no delete)
  - Config validator rejects WEARABLES_PROVIDER=live when WEARABLES_ENABLED=false
  - AES-256-GCM encrypt/decrypt round-trip for OAuth tokens
```
**Done when:** migrations apply cleanly; all /api/wearables/** endpoints reachable (501 stubs); ConsentGuard blocks unconsented calls; config validator covers WEARABLES_TOKEN_KEY; encrypt/decrypt round-trip passes; unit tests green.

---

## Sprint W2 — Medical Device Integrations 🔴 HIGH

**What's needed:** Live OAuth2 adapters for CGM, pacemaker telemonitoring, ECG, and blood-pressure platforms. Pacemaker platforms require signed partnership agreements — these adapters return a `partnership_required` error until agreements are in place.

```
Read apps/api/src/wearables/platform-adapter.interface.ts and mock.adapter.ts
from Sprint W1. Read assets/wearables-demo-data.js for the expected data shapes.

Create one adapter per platform under apps/api/src/wearables/adapters/medical/:

─── 1. Abbott LibreLink Up  (abbott-libre.adapter.ts) ───────────────────────
OAuth2 Authorization Code flow:
  authUrl:  https://api.libreview.io/auth (country-specific — detect from LIBRE_REGION env)
  token:    POST https://api.libreview.io/auth/token
  readings: GET  https://api.libreview.io/llu/connections/:patientId/graph
              → timestamp, ValueInMgPerDl (convert to mmol/l ÷ 18.0182)
              → metric_type '14745-4' (Glucose [Moles/volume])
  Required env: LIBRE_CLIENT_ID, LIBRE_CLIENT_SECRET, LIBRE_REGION (EU default 'eu')
  Prod note: LibreLink Up requires users to accept a connection invite from the
    hospital LibreView account — document invite flow in onboarding.

─── 2. Dexcom  (dexcom.adapter.ts) ──────────────────────────────────────────
OAuth2 Authorization Code + PKCE:
  authUrl:  https://api.dexcom.com/v2/oauth2/login
  token:    POST https://api.dexcom.com/v2/oauth2/token
  readings: GET  https://api.dexcom.com/v3/users/self/egvs
              ?startDate=[ISO]&endDate=[ISO]
              → value in mg/dL (convert to mmol/l), trend arrow, status
              → metric_type '14745-4'
  Required env: DEXCOM_CLIENT_ID, DEXCOM_CLIENT_SECRET
  Sandbox: set DEXCOM_SANDBOX=true to use https://sandbox-api.dexcom.com

─── 3. Medtronic Guardian CGM  (medtronic-cgm.adapter.ts) ───────────────────
CareLink Personal API:
  ⚠️  PARTNERSHIP REQUIRED — set partnership_required=true on device row.
  Until a Medtronic API partnership agreement is signed, return:
    { error: 'PARTNERSHIP_AGREEMENT_REQUIRED', vendor: 'Medtronic',
      contact: 'partnerapi@medtronic.com' }
  Implement adapter interface stubs only; wire once agreement is in place.
  When live: POST https://carelink.minimed.eu/patient/connect/oauth
  Required env: MEDTRONIC_CLIENT_ID, MEDTRONIC_CLIENT_SECRET

─── 4. Medtronic MyCareLink (pacemaker)  (medtronic-cardiac.adapter.ts) ─────
  ⚠️  PARTNERSHIP REQUIRED (separate Medtronic Cardiac Rhythm agreement).
  Partnership contact: mycarelink-api@medtronic.com
  Stub only. Returns partnership_required=true.
  Data shape when live: status (OK|ALERT), battery_pct, last_interrogation_at,
    lead_impedance, detected_episodes[] → metric_type 'pacemaker-status' (custom)

─── 5. Abbott Merlin.net (ICD/PM)  (abbott-cardiac.adapter.ts) ──────────────
  ⚠️  PARTNERSHIP REQUIRED — Abbott Cardiac Rhythm Management.
  Contact: cardiovascular.digital@abbott.com
  Stub only. Returns partnership_required=true.

─── 6. Boston Scientific Latitude NXT  (bsc-latitude.adapter.ts) ────────────
  ⚠️  PARTNERSHIP REQUIRED — BSC Remote Patient Management.
  Contact: rpmpartner@bsci.com
  Stub only. Returns partnership_required=true.

─── 7. AliveCor KardiaMobile  (alivecor.adapter.ts) ─────────────────────────
KardiaStation API (requires clinical account):
  ⚠️  No public OAuth API for individual patients. Integration path:
    (a) Patient emails PDF recording to hospital → admin uploads to records.
    (b) OR: KardiaPro Enterprise API (enterprise agreement required).
  For now: stub returns { error: 'MANUAL_UPLOAD_REQUIRED' }.
  Implement a manual-upload endpoint: POST /api/wearables/kardia/upload
    (multipart PDF, clinician auth only) → parse PDF text → store as ECG reading.
  metric_type: '11524-6' (EKG study)

─── 8. Withings Health API  (withings.adapter.ts) ───────────────────────────
OAuth2 Authorization Code (also used for consumer Withings devices):
  authUrl:  https://account.withings.com/oauth2_user/authorize2
  token:    POST https://wbsapi.withings.net/v2/oauth2 action=requesttoken
  readings: POST https://wbsapi.withings.net/measure?action=getmeas
              meastype 1 = weight (kg); 9 = diastolic BP; 10 = systolic BP;
              11 = SpO2; 88 = HR
              → convert to device_readings rows
              → BP pair: systolic metric_type '8480-6', diastolic '8462-4'
  Required env: WITHINGS_CLIENT_ID, WITHINGS_CLIENT_SECRET

─── 9. Omron Connect  (omron.adapter.ts) ─────────────────────────────────────
OAuth2 (Omron Connect Cloud):
  authUrl:  https://oauth.omronconnect.com/oauth2/authorize
  token:    POST https://oauth.omronconnect.com/oauth2/token
  readings: GET  https://api.omronconnect.com/measurement/v1/bloodpressure
              → systolic, diastolic, pulse, measured_at
              → metric_type '85354-9' (BP panel)
  Required env: OMRON_CLIENT_ID, OMRON_CLIENT_SECRET

─── Shared infrastructure ────────────────────────────────────────────────────

apps/api/src/wearables/token-crypto.service.ts:
  encryptToken(plaintext: string): string  — AES-256-GCM with WEARABLES_TOKEN_KEY
  decryptToken(ciphertext: string): string
  Throw WearablesTokenError if decryption fails; never log plaintext.

apps/api/src/wearables/oauth-state.service.ts:
  generateState(patientToken, platform): string  — HMAC-SHA256, 15-min TTL in Redis
  validateState(state, platform): { patientToken } | null
  Invalidate state after one use (CSRF protection).

Background sync job (wearables/sync.job.ts):
  @Cron('*/15 * * * *') — sync all active devices with last_sync_at > 15 min ago
  For each: call adapter.syncReadings(device, lastSyncAt)
  Upsert device_readings (upsert on device_id + recorded_at + metric_type)
  Update wearable_devices.last_sync_at, sync_status
  Write device_sync_jobs row; emit wearables.readings.synced to RabbitMQ

─── Tests ────────────────────────────────────────────────────────────────────

Unit tests:
  - partnership_required adapters return correct error shape without throwing
  - Abbott / Dexcom adapters: sandbox round-trip (mock HTTP with nock)
  - Withings: mmHg pair correctly split into systolic + diastolic readings
  - Token encrypt/decrypt; corrupted ciphertext throws WearablesTokenError
  - State CSRF: reused state rejected; expired state rejected
  - Sync job: failed adapter → sync_status='error', device_sync_jobs row written
```
**Done when:** Abbott Libre + Dexcom sandbox round-trips pass; Withings + Omron OAuth stubs callable; all 3 cardiac platforms return partnership_required gracefully; token encryption tested; OAuth state CSRF tested; sync job writes device_sync_jobs rows; unit tests green.

---

## Sprint W3 — Consumer Platform Integrations 🟡 MEDIUM

**What's needed:** OAuth2 / Health Connect adapters for all consumer wearable platforms. Apple requires a native iOS companion app; Xiaomi requires GDPR data-export polling.

```
Read apps/api/src/wearables/platform-adapter.interface.ts (W1) and
    apps/api/src/wearables/adapters/medical/withings.adapter.ts (W2, same API used
    for consumer Withings devices).

Create apps/api/src/wearables/adapters/consumer/:

─── 1. Apple Health  (apple-health.adapter.ts) ──────────────────────────────
Apple HealthKit data can only be accessed from a native iOS app. Web OAuth alone
is insufficient. Integration path:
  (a) Build a lightweight iOS companion app (SwiftUI, target iOS 16+) that:
      - Authenticates with the hospital portal (OIDC token exchange)
      - Reads HealthKit data with HKHealthStore.requestAuthorization
      - POSTs readings to POST /api/wearables/apple/push (patient JWT)
  (b) Server-side: POST /api/wearables/apple/push receives ReadingPayload[];
      validates JWT; upserts into device_readings; sets platform=apple_health.
Adapter stub: returns { error: 'IOS_APP_REQUIRED', appStoreUrl: null }
  until the companion app is published.
iOS app scope: HKQuantityTypeIdentifier.heartRate, stepCount, oxygenSaturation,
  bloodPressureSystolic, bloodPressureDiastolic, restingHeartRate; HKCategoryType
  sleepAnalysis; HKElectrocardiogramType (ECG waveform export requires Series 4+).
Required env: APPLE_HEALTH_BUNDLE_ID, APPLE_TEAM_ID

─── 2. Google Health Connect  (google-health.adapter.ts) ────────────────────
Google Health Connect API (Android 9+, replaces Google Fit REST):
  OAuth2: https://accounts.google.com/o/oauth2/auth
  scopes: https://www.googleapis.com/auth/health.activity.read
          https://www.googleapis.com/auth/health.heart_rate.read
          https://www.googleapis.com/auth/health.blood_pressure.read
          https://www.googleapis.com/auth/health.blood_glucose.read
          https://www.googleapis.com/auth/health.sleep.read
          https://www.googleapis.com/auth/health.oxygen_saturation.read
  readings: GET https://healthcare.googleapis.com/v1/projects/.../datasets/.../
    fhirStores/.../fhir/Observation (FHIR R4 endpoint — map directly to
    device_readings; metric_type comes from Observation.code.coding[].code)
  Required env: GOOGLE_HEALTH_CLIENT_ID, GOOGLE_HEALTH_CLIENT_SECRET,
    GOOGLE_PROJECT_ID, GOOGLE_FHIR_DATASET, GOOGLE_FHIR_STORE

─── 3. Samsung Health  (samsung-health.adapter.ts) ──────────────────────────
Samsung Health Connect uses Android Health Connect API (same scopes as Google above)
  plus Samsung-specific data types via Samsung Health SDK.
  For Web OAuth: Samsung Developer APIs (developer.samsung.com/health)
  authUrl: https://us.health.samsung.com/auth/authorize
  token:   POST https://us.health.samsung.com/auth/token
  data:    GET  https://us.health.samsung.com/v1/user/data/daily_step_count etc.
  Required env: SAMSUNG_HEALTH_CLIENT_ID, SAMSUNG_HEALTH_CLIENT_SECRET
  Note: Samsung Health REST API is in limited beta; set partnership_required=false
    but include a setup note that developer account approval may take 2–4 weeks.

─── 4. Fitbit (Google Fit)  (fitbit.adapter.ts) ─────────────────────────────
Fitbit Web API (acquired by Google; separate OAuth from Google Health):
  authUrl:  https://www.fitbit.com/oauth2/authorize
  token:    POST https://api.fitbit.com/oauth2/token (Basic auth with client credentials)
  readings:
    Heart rate: GET https://api.fitbit.com/1/user/-/activities/heart/date/today/1d.json
    Steps:      GET https://api.fitbit.com/1/user/-/activities/steps/date/today/1d.json
    Sleep:      GET https://api.fitbit.com/1.2/user/-/sleep/date/[date].json
    SpO2:       GET https://api.fitbit.com/1/user/-/spo2/date/today.json
  Required env: FITBIT_CLIENT_ID, FITBIT_CLIENT_SECRET
  Rate limit: 150 API calls/hour/user — sync job must respect this; use
    device_sync_jobs.readings_fetched to back off.

─── 5. Garmin  (garmin.adapter.ts) ──────────────────────────────────────────
Garmin Health API (developer.garmin.com/health-api):
  Uses OAuth 1.0a (not 2.0) — implement oauth-signature package.
  authUrl:  https://connect.garmin.com/oauthConfirm
  token:    POST https://connectapi.garmin.com/oauth-service/oauth/access_token
  Push model: Garmin PUSHES data to a registered callback webhook, not pull.
    Register webhook: apps/api/src/wearables/webhooks/garmin.webhook.ts
    POST /api/wearables/webhooks/garmin  (no auth — validate X-Garmin-Signature)
    Payload: dailies[], activities[], epochs[], sleeps[], userMetrics[]
    Map to device_readings; emit wearables.readings.synced
  Required env: GARMIN_CONSUMER_KEY, GARMIN_CONSUMER_SECRET, GARMIN_WEBHOOK_KEY

─── 6. Huawei Health Kit  (huawei.adapter.ts) ───────────────────────────────
Huawei Health Kit (requires Huawei Developer account + HMS Core):
  OAuth2 (Account Kit):
    authUrl:  https://oauth-login.cloud.huawei.com/oauth2/v3/authorize
    token:    POST https://oauth-login.cloud.huawei.com/oauth2/v3/token
    scope:    healthkit.read healthkit.activity.read healthkit.heartrate.read
  Data: POST https://health-api.cloud.huawei.com/healthkit/v1/users/self/sampleSet
    DataCollector.dataType = DT_CONTINUOUS_HEART_RATE_STATISTICS
                             DT_INSTANTANEOUS_BLOOD_PRESSURE
                             DT_INSTANTANEOUS_SPO2 etc.
  Required env: HUAWEI_CLIENT_ID, HUAWEI_CLIENT_SECRET, HUAWEI_APP_ID
  Note: Huawei devices sold in EU lack Google Play — this adapter covers that segment.

─── 7. Xiaomi / Mi Fit  (xiaomi.adapter.ts) ──────────────────────────────────
Xiaomi has no public OAuth API for Mi Fit / Mi Fitness. Integration path:
  GDPR Data Export polling:
    (a) Patient requests data export from Mi Fitness app (Settings → Privacy → Export)
    (b) Patient uploads the resulting .zip to POST /api/wearables/xiaomi/upload
        (multipart, patient JWT)
    (c) Server parses CSV files in the zip (ACTIVITY_STAGE.csv, SLEEP_STAGE.csv,
        HEART_RATE.csv) → upserts into device_readings
  Adapter stub: returns { error: 'MANUAL_EXPORT_REQUIRED' }
  Implement upload endpoint now; wire auto-sync if Xiaomi publishes OAuth2 API.
  Required env: none (manual upload only)

─── 8. Withings (consumer tier) ──────────────────────────────────────────────
Reuse withings.adapter.ts from Sprint W2 — the same Withings Health API covers
both medical-grade (BPM Connect Pro) and consumer (ScanWatch, Body+) devices.
Register a second OAuth2 app if separate scopes are needed; otherwise share
WITHINGS_CLIENT_ID / WITHINGS_CLIENT_SECRET.

─── 9. Meta Ray-Ban Smart Glasses  (meta.adapter.ts) ────────────────────────
Meta wearables expose very limited health data. No public health API as of 2026.
Available via Meta's internal Wellbeing API (requires Meta Business partnership):
  Activity: step count, active minutes, approximate calorie burn
  No biometric data (no HR, no BP, no SpO2).
Adapter stub: returns { error: 'PARTNERSHIP_AGREEMENT_REQUIRED',
  vendor: 'Meta', note: 'Activity data only; no biometrics available.' }
Set partnership_required=true.

─── Shared webhook infrastructure ────────────────────────────────────────────

apps/api/src/wearables/webhooks/ — Garmin push handler registered above.
Extend for any future push-model platforms.
All webhooks: validate vendor signature header before processing; return 200
  immediately and process async (RabbitMQ); log raw payload to webhook_log table.

─── Tests ────────────────────────────────────────────────────────────────────

Unit tests:
  - Fitbit rate-limit backoff: 150th call within 1h returns 429; adapter queues retry
  - Garmin signature validation: tampered signature rejected; valid payload processed
  - Xiaomi CSV parser: malformed CSV row skipped; valid rows upserted
  - Google FHIR Observation → device_reading mapping (metric_type from LOINC code)
  - All partnership_required adapters return correct error without throwing
```
**Done when:** Fitbit + Withings (consumer) + Google Health OAuth round-trips pass sandbox; Garmin webhook validates + processes payload; Xiaomi CSV parser upserts readings; Apple adapter returns IOS_APP_REQUIRED cleanly; all partnership stubs return correct errors; unit tests green.

---

## Sprint W4 — Patient Portal Wearables Tab (Production Wiring) 🟡 MEDIUM

**What's needed:** Replace `wearables-demo-data.js` with real API calls in the Next.js portal. Connect device OAuth flows. Remove all prototype demo data.

```
Read:
  portal.html (Wearables tab — the UI spec to match pixel-for-pixel)
  assets/wearables-demo-data.js (shapes the portal currently uses)
  apps/web/src/app/[lang]/portal/ (existing portal implementation)
  design_handoff_nemocnica_snina/TELEMEDICINE_BUILD_GUIDE.md §T1.4 (portal
    pattern used for the Teleconsultations tab — follow the same structure)

─── PART A — Remove demo data ────────────────────────────────────────────────

1. Delete assets/wearables-demo-data.js.
2. Remove <script src="assets/wearables-demo-data.js"> from portal.html.
   (portal.html is the prototype reference only — the Next.js portal is the
   production build; this cleanup keeps the prototype honest.)

─── PART B — API client ──────────────────────────────────────────────────────

apps/web/src/lib/wearables-api.ts:
  getWearables(): Promise<WearablesResponse>
    → GET /api/wearables  (patient JWT from session)
  connectDevice(platform: WearablePlatform): Promise<{ authUrl: string }>
    → POST /api/wearables/connect/:platform
  disconnectDevice(deviceId: string): Promise<void>
    → DELETE /api/wearables/devices/:deviceId
  getReadings(deviceId: string, from?: Date): Promise<DeviceReading[]>
    → GET /api/wearables/devices/:deviceId/readings
  syncDevice(deviceId: string): Promise<{ jobId: string }>
    → POST /api/wearables/devices/:deviceId/sync
  updateConsent(deviceId: string, shareWithPhysician: boolean): Promise<void>
    → PUT /api/wearables/devices/:deviceId/consent

─── PART C — Portal Wearables tab ────────────────────────────────────────────

apps/web/src/app/[lang]/portal/wearables/page.tsx:
  SSR: getWearables() called server-side (patient session required; redirect to
    login if absent).

  Three sections matching portal.html exactly:

  1. Connected devices grid (3-col → 2-col → 1-col responsive):
     WearableDeviceCard component per connected device:
       - Device icon (category: medical=blue, consumer=warm) + brand + model
       - 2 latest readings from device.readings[]
       - Last sync relative time (fmtAgo)
       - "Share with physician" toggle → optimistic update → updateConsent()
       - "Sync now" button → syncDevice() → poll device_sync_jobs until complete
       - partnership_required badge + tooltip for cardiac implant platforms

  2. Recent readings timeline (unified, sorted by recorded_at DESC):
     ReadingTimelineRow per reading:
       - Time (relative), green/amber dot, metric label (bilingual), value+unit,
         device chip, Normal/High badge
       - FHIR Observation export status chip: "In HIS" if fhir_observation_id set

  3. Connect a device panel (toggle):
     Medical tab | Fitness & Wellness tab
     PlatformCard per available platform:
       - 2-letter monogram avatar, brand, model
       - partnership_required → shows "Agreement required" badge; onClick shows
         partnership contact info instead of initiating OAuth
       - Normal → onClick calls connectDevice(platform) → redirect to authUrl
       - manual_upload_only (AliveCor, Xiaomi) → "Upload data" button →
         opens upload modal → POST /api/wearables/:platform/upload

  4. GDPR consent notice (always visible at bottom):
     "Wearable integration is fully optional. Data shared exclusively with your
     treating physician. Withdraw consent at any time." — link to
     /[lang]/portal/wearables/sublas (consent management page)

─── PART D — Consent management page ────────────────────────────────────────

apps/web/src/app/[lang]/portal/wearables/sublas/page.tsx:
  List all connected devices with consent status per type
  (data_storage | physician_sharing | his_export).
  "Withdraw all consent" button per device: calls withdrawConsent() → device
  disconnected + token revoked + readings soft-deleted.
  Full audit trail shown: granted_at, withdrawn_at per consent.
  aria-live feedback on toggle changes.

─── PART E — Navigation ──────────────────────────────────────────────────────

Add "Wearables" nav item to portal sidebar in:
  apps/web/src/app/[lang]/portal/layout.tsx
  Between "Lab results" and any future items.
  Show device count badge if > 0 connected devices.

─── PART F — i18n ────────────────────────────────────────────────────────────

Add all wearables strings to apps/web/src/messages/sk.json and en.json:
  portal.wearables.title, portal.wearables.optional,
  portal.wearables.connectDevice, portal.wearables.shareWithPhysician,
  portal.wearables.recentReadings, portal.wearables.medicalTab,
  portal.wearables.fitnessTab, portal.wearables.privacyNotice,
  portal.wearables.partnershipRequired, portal.wearables.manualUpload,
  portal.wearables.inHis, portal.wearables.syncNow,
  portal.wearables.consent.title, portal.wearables.consent.withdrawAll
  (machine-translate cs/pl/hu/uk — mark clinical strings for human review)

─── Tests ────────────────────────────────────────────────────────────────────

E2E (Playwright):
  - Wearables tab renders with 3 connected devices (mock API)
  - Share-with-physician toggle: optimistic update visible; API call made
  - "Connect device" → partnership_required platform shows agreement modal
  - Consent withdrawal: device removed from list; audit entry present
  - axe: zero critical/serious violations on wearables tab
```
**Done when:** portal wearables tab renders from live API (mock provider); demo file removed; Connect Device OAuth redirect works for Fitbit + Withings sandbox; consent withdrawal removes device; i18n strings present for SK + EN; axe clean; E2E tests pass.

---

## Sprint W5 — Clinical Alerts & HIS Integration 🔴 HIGH

**What's needed:** Threshold-based alerts routed to physician inbox, FHIR Observation export to HIS, and a physician view of patient wearable summaries.

```
Read:
  design_handoff_nemocnica_snina/TELEMEDICINE_BUILD_GUIDE.md §T3.1 (HIS queue pattern)
  apps/api/src/his/his-sync.consumer.ts (extend for wearables)
  apps/api/src/wearables/wearables.service.ts (W1)
  design_handoff_nemocnica_snina/DATA_MODEL.md §device_alert_thresholds (W1)

─── PART A — Alert engine ────────────────────────────────────────────────────

apps/api/src/wearables/alert.service.ts:

evaluateReading(reading: DeviceReading, device: WearableDevice): AlertResult
  1. Load device_alert_thresholds for patient_token + metric_type.
     If no patient-specific threshold: load DEFAULT_THRESHOLDS seed (see below).
  2. Compare value_numeric against threshold_high, threshold_low,
     threshold_critical_high, threshold_critical_low.
  3. Return: flag ('normal'|'high'|'low'|'critical'), exceeded_threshold.
  4. If critical: emit wearables.alert.critical to RabbitMQ immediately.
  5. If high or low and physician has share_with_physician=true: batch into
     wearables.alert.batch (processed every 15 min; avoids spam).

DEFAULT_THRESHOLDS seed (seed via Prisma seed.ts):
  Glucose (14745-4):
    threshold_high: 10.0 mmol/l, threshold_low: 3.9 mmol/l
    threshold_critical_high: 15.0, threshold_critical_low: 3.0
  Heart rate (8867-4):
    threshold_high: 120 bpm, threshold_low: 40 bpm
    threshold_critical_high: 150, threshold_critical_low: 30
  Systolic BP (8480-6):
    threshold_high: 160 mmHg, threshold_critical_high: 180
    threshold_low: 85, threshold_critical_low: 70
  SpO2 (59408-5):
    threshold_low: 92%, threshold_critical_low: 88%

RabbitMQ consumers (wearables/alert.consumer.ts):
  wearables.alert.critical → immediate:
    SmsService.send(physician.phone, alert summary)
    Create portal notification for physician
    audit_log entry (action: 'wearable_alert_critical')
  wearables.alert.batch → every 15 min:
    Aggregate by patient + physician; send one digest SMS
    audit_log entries

─── PART B — FHIR Observation export ────────────────────────────────────────

Extend apps/api/src/his/his-sync.consumer.ts:
  Consume wearables.readings.synced event:
    For each reading where share_with_physician=true AND fhir_observation_id IS NULL:
      Build FHIR R4 Observation:
        resourceType: 'Observation'
        status: 'final'
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: reading.category === 'medical' ? 'vital-signs' : 'activity' }] }]
        code: { coding: [{ system: 'http://loinc.org', code: reading.metric_type }] }
        subject: { reference: 'Patient/' + patient_fhir_id }
        effectiveDateTime: reading.recorded_at
        valueQuantity: { value: reading.value_numeric, unit: reading.unit,
          system: 'http://unitsofmeasure.org' }
        device: { display: device.device_label }
      POST to HIS FHIR endpoint (reuse pattern from T3.1).
      On success: set device_readings.fhir_observation_id = response.id
      On failure: DLQ + retry (max 3); never delete the reading.
      Idempotent: skip if fhir_observation_id already set.
    Purge guard: readings with fhir_observation_id=null and consent withdrawn=true
      are soft-deleted only AFTER successful FHIR export OR after
      WEARABLES_GDPR_RETENTION_DAYS (default 90) have elapsed.

─── PART C — Physician view ──────────────────────────────────────────────────

GET /api/wearables/physician/:patientToken  (clinician JWT):
  Validates: requesting physician has an appointment or telehealth session with
    the patient in the last 90 days OR patient has explicitly consented
    (device_consent type='physician_sharing' granted=true).
  Returns: WearableDevice[] with most recent 10 readings per device, alert
    history (last 7 days), fhir_observation_id status.

Physician portal page:
  apps/web/src/app/admin/patients/[patientToken]/wearables/page.tsx
  — Summary cards (most recent reading per metric)
  — Alert history timeline (last 7 days)
  — Per-device: trend sparkline (SVG, last 24 readings)
  — "Set thresholds" side panel: form to create/update device_alert_thresholds
    (clinician role required; audit_log on every change)
  — "Export to HIS" button: POST /api/wearables/devices/:id/export-fhir
    (manual trigger for readings not yet exported)

─── Tests ────────────────────────────────────────────────────────────────────

Unit tests:
  - evaluateReading: critical glucose (15.1 mmol/l) emits wearables.alert.critical
  - evaluateReading: normal reading emits nothing
  - FHIR export: idempotent — second call with existing fhir_observation_id is a no-op
  - FHIR export: DLQ written on 3rd consecutive failure; reading NOT deleted
  - Physician view: physician with no recent appointment returns 403
  - Threshold update: non-clinician role returns 403; audit_log written on success
```
**Done when:** critical glucose reading emits SMS + portal notification; FHIR Observations written to HIS sandbox with correct LOINC codes; idempotency verified; physician view gated by appointment relationship; threshold UI saves + audits; unit tests green.

---

## Sprint W6 — Compliance, Security Hardening & E2E Tests 🔴 HIGH

**What's needed:** GDPR compliance gate, security pen-test items, WCAG AA, and the `WEARABLES_ENABLED` production launch gate.

```
Read:
  design_handoff_nemocnica_snina/TELEMEDICINE_COMPLIANCE_REVIEW.md (pattern)
  design_handoff_nemocnica_snina/LAUNCH_CHECKLIST.md §L9 (gate to extend)
  apps/api/src/config/config.schema.ts (add WEARABLES_ENABLED enforcement)

─── PART A — Security hardening ─────────────────────────────────────────────

1. OAuth token rotation:
   On every sync: if oauth_expires_at < now + 5min, call adapter.refreshToken()
   Store new encrypted tokens; old tokens cleared immediately.
   Rotation failure → sync_status='error'; alert patient via portal notification
   (not SMS — avoid leaking device existence to phone).

2. OAuth state CSRF audit:
   Verify OAuthStateService.validateState() is called on EVERY /callback route.
   Add integration test: forged state parameter → 400 Bad Request.
   Add: state params include platform + nonce + patient_token_hash (not plaintext).

3. Webhook signature validation (Garmin, future platforms):
   All inbound webhooks: reject if signature header absent or invalid.
   Rate-limit webhook endpoint: 100 req/min per source IP.
   Log raw payload to webhook_log; never log decrypted token values.

4. Scope of physician access:
   Physician can only read wearable data for patients where:
     (a) share_with_physician=true on the device, AND
     (b) device_consent type='physician_sharing' is granted, AND
     (c) the physician has an appointment or session with the patient in the
         last WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS (default 90) days.
   Write integration test: physician with no relationship → 403.

5. Readings isolation:
   Patient A cannot read Patient B's device_readings.
   Integration test: authenticated patient JWT for patient A attempting
   GET /api/wearables/devices/[patient-B-device-id]/readings → 403.

─── PART B — GDPR compliance ────────────────────────────────────────────────

1. Retention policy:
   Add to docs/RETENTION.md (alongside telemedicine rows):
   | Data                        | Retention    | Basis                          |
   |-----------------------------|--------------|--------------------------------|
   | device_readings (no consent)| 0 days       | deleted on withdrawal          |
   | device_readings (consented) | 90 days      | WEARABLES_GDPR_RETENTION_DAYS  |
   | device_readings (FHIR synced)| indefinite  | authoritative copy in HIS      |
   | device_consent audit rows   | 5 years      | GDPR accountability (Art. 5.2) |
   | OAuth tokens (encrypted)    | until revoked| technical necessity            |
   | wearables alert SMS content | 30 days      | incident investigation         |

2. DPIA addendum:
   Create docs/DPIA_WEARABLES_ADDENDUM.md:
   - Data controller: Nemocnica Snina, s.r.o.
   - Lawful basis: explicit consent (GDPR Art. 9(2)(a)) for health data
   - Special category data: CGM glucose, ECG, pacemaker telemetry, BP → Art. 9
   - Third-party processors: list all platform vendors (Abbott, Dexcom, Apple,
     Google, Samsung, Fitbit, Garmin, Huawei, Meta) + DPA status for each
   - Data transfers: flag Fitbit (Google, US) + Garmin (US) for SCCs;
     Huawei (CN) — no transfer until Adequacy Decision or SCCs confirmed
   - Automated decisions: alert thresholds only flag for human review;
     no automated clinical decisions → no Art. 22 DPIA trigger
   - Retention as above

3. Consent re-confirmation:
   If patient has not reviewed consent for a device in > 12 months:
   Show a re-confirmation banner on next portal visit. If not confirmed within
   30 days: suspend sync (sync_status='pending'), notify patient.

─── PART C — WCAG 2.1 AA ────────────────────────────────────────────────────

Run axe-core on:
  - /[lang]/portal/wearables (connected devices + timeline)
  - /[lang]/portal/wearables/sublas (consent management)
  - /admin/patients/[token]/wearables (physician view)

Fix all critical + serious violations. Common issues to pre-check:
  - Device cards: ensure Share toggle has visible label + aria-label
  - Timeline: ensure dot indicators have aria-label or role=img + aria-label
  - Connect panel: ensure platform buttons have descriptive text (not just 2-letter)
  - Consent withdrawal: confirm dialog must trap focus

─── PART D — E2E test suite ─────────────────────────────────────────────────

Add to existing E2E suite (Playwright):

WR-1  Patient connects Fitbit device:
  Login → Wearables tab → Connect device → Fitness tab → Fitbit →
  OAuth redirect → mock callback → device appears in connected list.

WR-2  Share-with-physician toggle:
  Toggle OFF → API call → physician view no longer returns that device.
  Toggle ON → API call → device reappears in physician view.

WR-3  Critical glucose alert:
  Inject reading 16.0 mmol/l via POST /api/wearables/devices/:id/readings (admin) →
  wearables.alert.critical consumed → physician SMS mock called →
  Alert badge appears in physician portal.

WR-4  Consent withdrawal:
  Withdraw consent for Abbott device → device removed from list →
  device_readings soft-deleted → fhir_observation_id rows preserved →
  Physician view returns 0 devices for that patient.

WR-5  Readings isolation:
  Patient A's JWT → attempt to read Patient B's device → 403.

WR-6  FHIR Observation export:
  Sync produces reading → consume wearables.readings.synced →
  FHIR sandbox has Observation with correct LOINC code →
  device_readings.fhir_observation_id populated.
  Re-run sync → idempotent (no duplicate Observation).

─── PART E — Launch gate ────────────────────────────────────────────────────

Add to LAUNCH_CHECKLIST.md §L9:
  Wearables compliance gate (all required before WEARABLES_ENABLED=true in prod):
  [ ] DPIA_WEARABLES_ADDENDUM.md: signed by DPO
  [ ] RETENTION.md: wearables section added; DPO sign-off
  [ ] DPAs in place with each live platform vendor (Abbott, Dexcom, Fitbit, Withings,
      Garmin, Google, Samsung, Huawei)
  [ ] SCCs confirmed for Fitbit (Google/US) and Garmin (US)
  [ ] Huawei blocked from live sync until Adequacy Decision or SCCs signed
  [ ] Partnership agreements signed: Medtronic, Abbott Cardiac, BSC
      (blocks MyCareLink, Merlin.net, Latitude NXT live sync)
  [ ] axe: zero critical/serious on all 3 wearables pages
  [ ] WR-1 through WR-6 green in CI
  [ ] Pen-test items verified: OAuth CSRF, token isolation, readings isolation,
      webhook signature, physician scope
  [ ] iOS companion app published (App Store) before Apple Health goes live
  [ ] WEARABLES_ENABLED=true + WEARABLES_PROVIDER=live set in production .env
      (config validator enforces; mock provider rejected in production)
```
**Done when:** WR-1–WR-6 green in CI; axe zero violations on all 3 pages; DPIA addendum created; RETENTION.md updated; L9 gate updated; config validator rejects live provider without WEARABLES_ENABLED=true.

---

## Dependency map

```
existing sprints:
  S3 (portal auth + FHIR MedicationRequest)  ──────────> W1 (portal patient token pattern)
  S6 (NestJS module pattern)  ─────────────────────────> W1
  S10 (HIS queue + FHIR Encounter pattern)  ───────────> W5 (reuse queue topology)

wearables sprints:
  W1 (data model + consent)
    ├──> W2 (medical adapters)   ─┐
    └──> W3 (consumer adapters)  ─┼──> W4 (portal UI + demo removal)
                                  │        └──> W5 (alerts + HIS)
                                  │                 └──> W6 (compliance + E2E)
                                  └── (W2 + W3 run in parallel after W1)
```

**Parallel execution:** W2 and W3 can run simultaneously in separate Claude Code sessions after W1 is merged. W4 requires at minimum one live adapter (recommend Fitbit or Withings) from W2/W3 to test the Connect Device flow end-to-end.

---

## Removing demo data checklist (for Sprint W4)

When the production API is ready, remove the prototype demo shim in this order:

1. `git rm assets/wearables-demo-data.js`
2. In `portal.html`: remove `<script src="assets/wearables-demo-data.js"></script>`
3. In `portal.html` inline script: the `WEARABLES` constant reference is now
   served by the production Next.js portal at `/[lang]/portal/wearables` — the
   prototype `portal.html` file becomes a static reference only; no further
   changes needed to it.
4. Verify `window.NS_WEARABLES_DEMO` is `undefined` in the production build.
5. Commit: `feat(wearables): remove demo data shim — production API live`
