# Sprint W3 — Consumer Platform Adapters (v2)
## Nemocnica Snina · Wearables & Remote Monitoring

**Branch:** `feature/wearables-w3-consumer-adapters`  
**Date:** June 24 2026  
**Hard dependency:** WL9 merged to main first. W2 merged to main first (AdapterRegistry
  lives in MedicalAdaptersModule; W3 extends it with consumer adapters).  
**Parallel with:** W2 is a prerequisite, not truly parallel. Start W3 only after W2 is on main.
  If W2 and W3 must run simultaneously, duplicate AdapterRegistry locally and reconcile at merge.

---

## Paste this into Claude Code before starting

```
Read the following files in full before writing any code:

1.  CLAUDE.md — non-negotiables (no physicians table, pnpm only, EU hosting,
    audit_log append-only, strictBool, z.coerce.boolean banned)
2.  apps/api/src/wearables/platform-adapter.interface.ts — implement ALL FIVE
    methods: getAuthUrl, exchangeCode, syncReadings, refreshToken, revokeToken.
    DI fails if any method is missing.
3.  apps/api/src/wearables/mock.adapter.ts — canonical reference implementation
4.  apps/api/src/wearables/platform-catalog.ts — gating flags and BadRequestPartnership.
    Use these; do not invent a parallel error channel.
5.  apps/api/src/wearables/token-crypto.service.ts — REUSE. encryptToken / decryptToken.
6.  apps/api/src/wearables/oauth-state.service.ts — REUSE. generateState / consumeState
    are async (WL9 Redis update). Do not re-implement state logic.
7.  apps/api/src/wearables/webhooks/garmin.webhook.controller.ts — READ THIS BEFORE
    touching Garmin. W6 already built the push handler with HMAC-SHA1 + rate-limit.
    Your job is OAuth connect/disconnect ONLY. Do not create a second webhook controller.
8.  apps/api/src/wearables/adapters/medical/medical-adapters.module.ts — W2 built
    MedicalAdaptersModule + AdapterRegistry. Import both; extend AdapterRegistry with
    consumer adapters (see Part A).
9.  apps/api/src/wearables/wearables.module.ts — wire ConsumerAdaptersModule here.
10. apps/api/src/config/config.schema.ts — add new env vars here only.
11. wearables-sprint-package/SPRINT_BACKLOG_WEARABLES.md §W3 — platform-level
    detail reference. Where it contradicts items 1–9 above, items 1–9 win.

Execute Sprint W3 only. Stop and report Done-when criteria before merging.
```

---

## Critical: conform to the shipped codebase

| DO NOT recreate | Location | What to do instead |
|---|---|---|
| `TokenCryptoService` | `wearables/token-crypto.service.ts` | Inject; call `encryptToken` / `decryptToken` |
| `OAuthStateService` | `wearables/oauth-state.service.ts` | Inject; call `generateState` / `consumeState` (async) |
| Garmin webhook handler | `wearables/webhooks/garmin.webhook.controller.ts` | Read it; extend if needed; never duplicate |
| `AdapterRegistry` | `wearables/adapters/medical/adapter-registry.service.ts` (W2) | Extend its constructor with consumer adapters |
| `MedicalAdaptersModule` | W2 | Import it into `ConsumerAdaptersModule`; re-export `WithingsAdapter` |
| DB migrations | Prisma migrations on main | Do not re-run or alter existing migrations |
| `audit_log` table | Existing table | Use `AuditService.writeAuditEntry()` — no `webhook_log` table |

**Audit logging note:** CLAUDE.md specifies that all auditable events go to `audit_log` via `AuditService`. There is no separate `webhook_log` table. Any spec language suggesting creating one is superseded by CLAUDE.md.

---

## Non-negotiables

- **All 5 interface methods implemented.** `getAuthUrl`, `exchangeCode`, `syncReadings`, `refreshToken`, `revokeToken`. Stubs return empty / throw catalog error — they still satisfy the interface.
- **Huawei is a blocked stub. Full stop.** `platform-catalog.ts` sets `partnershipRequired: true` for Huawei. WL9 Part D adds a config validator that rejects `HUAWEI_HEALTH_ENABLED=true` when `WEARABLES_ENABLED=true`. The adapter returns `{ error: 'HUAWEI_BLOCKED_EU_ADEQUACY' }` and never initiates OAuth. Any spec language describing buildable Huawei OAuth endpoints is superseded by this rule (Decree 179/2020 + DPIA_WEARABLES_ADDENDUM.md).
- **Garmin webhook: extend, do not duplicate.** `garmin.webhook.controller.ts` exists with HMAC-SHA1 validation and 100 req/min rate-limit. Your only Garmin work is OAuth 1.0a connect/disconnect.
- **All OAuth state via `OAuthStateService` (async).** Do not write your own state logic.
- **All OAuth tokens via `TokenCryptoService`.** No plaintext in DB or logs.
- **No `physicians` table.** Physician–patient via `TelehealthSession`.
- **`strictBool()` for every boolean config flag.** `z.coerce.boolean()` is banned.
- **Upload endpoints:** `POST /api/wearables/upload/xiaomi` (transition prompt canonical path). Not `/api/wearables/xiaomi/upload`.
- **pnpm only.**

---

## Part A — Extending AdapterRegistry with consumer adapters

W2 built `AdapterRegistry` in `MedicalAdaptersModule`. W3 extends its constructor to include consumer adapters. Do not create a second registry.

```typescript
// In adapter-registry.service.ts — add W3 adapters to the constructor:
// (W3 opens a PR against W2's AdapterRegistry, or resolves at merge time)

constructor(
  // ... existing W2 injections ...
  private readonly fitbit:        FitbitAdapter,
  private readonly garmin:        GarminAdapter,
  private readonly googleHealth:  GoogleHealthAdapter,
  private readonly samsung:       SamsungHealthAdapter,
  private readonly apple:         AppleHealthAdapter,    // stub
  private readonly huawei:        HuaweiAdapter,         // blocked stub
  private readonly meta:          MetaAdapter,           // partnership stub
  private readonly xiaomi:        XiaomiAdapter,         // manual upload stub
  // WithingsAdapter already registered by W2 for consumer devices too
) {
  // ... existing W2 registrations ...
  this.live.set(WearablePlatform.fitbit,         fitbit);
  this.live.set(WearablePlatform.garmin,         garmin);
  this.live.set(WearablePlatform.google_health,  googleHealth);
  this.live.set(WearablePlatform.samsung_health, samsung);
  this.live.set(WearablePlatform.apple_health,   apple);
  this.live.set(WearablePlatform.huawei,         huawei);
  this.live.set(WearablePlatform.meta,           meta);
  this.live.set(WearablePlatform.xiaomi,         xiaomi);
}
```

---

## Part B — `ConsumerAdaptersModule`

```typescript
// apps/api/src/wearables/adapters/consumer/consumer-adapters.module.ts

@Module({
  imports: [MedicalAdaptersModule],   // re-exports WithingsAdapter + AdapterRegistry
  providers: [
    FitbitAdapter,
    GarminAdapter,
    GoogleHealthAdapter,
    SamsungHealthAdapter,
    AppleHealthAdapter,   // stub
    HuaweiAdapter,        // blocked stub
    MetaAdapter,          // partnership stub
    XiaomiAdapter,        // manual upload stub
  ],
  exports: [
    FitbitAdapter, GarminAdapter, GoogleHealthAdapter, SamsungHealthAdapter,
    AppleHealthAdapter, HuaweiAdapter, MetaAdapter, XiaomiAdapter,
  ],
})
export class ConsumerAdaptersModule {}
```

Add to `wearables.module.ts`:
```typescript
imports: [MedicalAdaptersModule, ConsumerAdaptersModule],
```

---

## Part C — Push-platform pattern

Garmin pushes data; `syncReadings` must return empty rather than polling:

```typescript
// sync.job.ts already exists — verify this guard is present; add if missing:
if (adapter instanceof GarminAdapter) {
  // Push platform — data arrives via webhook (garmin.webhook.controller.ts)
  // Do not attempt pull; update sync metadata only
  await prisma.wearableDevice.update({
    where: { id: device.id },
    data:  { syncStatus: 'ok' },
  });
  continue;
}
```

---

## Part D — Live adapters

All live adapters implement all five interface methods.

### D1. Fitbit (`fitbit.adapter.ts`)

```
getAuthUrl:   https://www.fitbit.com/oauth2/authorize
exchangeCode: POST https://api.fitbit.com/oauth2/token
              Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)
syncReadings: GET https://api.fitbit.com/1/user/-/activities/heart/date/today/1d.json
              GET https://api.fitbit.com/1/user/-/activities/steps/date/today/1d.json
              GET https://api.fitbit.com/1.2/user/-/sleep/date/[YYYY-MM-DD].json
              GET https://api.fitbit.com/1/user/-/spo2/date/today.json
refreshToken: POST https://api.fitbit.com/oauth2/token  grant_type=refresh_token
revokeToken:  POST https://api.fitbit.com/oauth2/revoke
```

**Rate limit — 150 API calls/hour/user (4 calls per sync cycle):**
```typescript
async syncReadings(device: WearableDevice, from: Date): Promise<RawReading[]> {
  const jobsLastHour = await prisma.deviceSyncJob.count({
    where: {
      deviceId:    device.id,
      createdAt:   { gte: subHours(new Date(), 1) },
      status:      'completed',
    },
  });
  // Each sync uses 4 calls; 140 is the safety margin (leaves 10 buffer)
  if (jobsLastHour * 4 >= 140) {
    await prisma.wearableDevice.update({
      where: { id: device.id },
      data:  { syncStatus: 'pending', syncError: 'rate_limit_backoff' },
    });
    return [];   // do not throw — let sync job continue with other devices
  }
  // ... fetch readings ...
}
```

Metric mappings:
- `summary.steps` → `55423-8` (steps)
- `value.restingHeartRate` (or first intraday value) → `8867-4` (bpm)
- `minutesAsleep` → `93832-4` (min, sleep)
- SpO2 `value.avg` → `59408-5` (%)

```
Config additions:
  FITBIT_CLIENT_ID:     z.string().min(1)
  FITBIT_CLIENT_SECRET: z.string().min(1)
```

### D2. Garmin (`garmin.adapter.ts`)

**Read `garmin.webhook.controller.ts` before writing a single line.** The push handler, HMAC-SHA1 validation, and 100 req/min rate-limit are already live. This adapter provides the OAuth 1.0a connect/disconnect flow only.

```
Request token:  POST https://connectapi.garmin.com/oauth-service/oauth/request_token
getAuthUrl:     https://connect.garmin.com/oauthConfirm?oauth_token={token}
Access token:   POST https://connectapi.garmin.com/oauth-service/oauth/access_token
Deregister:     DELETE https://healthapi.garmin.com/wellness-api/rest/user/registration
```

Use the `oauth-1.0a` npm package (already in package.json from W6 — verify; install if absent).

```typescript
async getAuthUrl(patientToken: string, state: string): Promise<string> {
  // OAuth 1.0a: get request token first, then build auth URL
  // Store request token secret encrypted in Redis alongside state (same TTL: 15 min)
  const { oauthToken, oauthTokenSecret } = await this.getRequestToken();
  await this.oauthStateService.attachSecret(state, oauthTokenSecret); // extend OAuthStateService if needed
  return `https://connect.garmin.com/oauthConfirm?oauth_token=${oauthToken}&state=${state}`;
}

async syncReadings(_device: WearableDevice, _from: Date): Promise<RawReading[]> {
  return []; // Garmin pushes; never pull
}

async revokeToken(device: WearableDevice): Promise<void> {
  // DELETE https://healthapi.garmin.com/wellness-api/rest/user/registration
  // Deregisters the webhook subscription for this user
  // Best-effort: log on failure; do not block consent withdrawal
}
```

```
Config additions (GARMIN_WEBHOOK_KEY already added by W6 — verify, don't duplicate):
  GARMIN_CONSUMER_KEY:    z.string().min(1)
  GARMIN_CONSUMER_SECRET: z.string().min(1)
```

### D3. Google Health Connect (`google-health.adapter.ts`)

```
getAuthUrl:   https://accounts.google.com/o/oauth2/auth  (PKCE)
exchangeCode: POST https://oauth2.googleapis.com/token
syncReadings: GET  https://healthcare.googleapis.com/v1/projects/{PROJECT}/
                   datasets/{DATASET}/fhirStores/{STORE}/fhir/Observation
                   ?patient=Patient/{FHIR_ID}&date=gt{lastSyncDate}
refreshToken: POST https://oauth2.googleapis.com/token  grant_type=refresh_token
revokeToken:  POST https://oauth2.googleapis.com/revoke
```

Response is FHIR R4 Observations — map directly:
- `Observation.code.coding[0].code` → `metric_type`
- `Observation.valueQuantity.value` → `value_numeric`
- `Observation.valueQuantity.unit` → `unit`
- `Observation.effectiveDateTime` → `recorded_at`

PKCE: same pattern as Dexcom — `code_verifier` in Redis alongside state, 15-min TTL.

```
Config additions:
  GOOGLE_HEALTH_CLIENT_ID:      z.string().min(1)
  GOOGLE_HEALTH_CLIENT_SECRET:  z.string().min(1)
  GOOGLE_PROJECT_ID:            z.string().min(1)
  GOOGLE_FHIR_DATASET:          z.string().min(1)
  GOOGLE_FHIR_STORE:            z.string().min(1)
```

### D4. Samsung Health (`samsung-health.adapter.ts`)

```
getAuthUrl:   https://us.health.samsung.com/auth/authorize
exchangeCode: POST https://us.health.samsung.com/auth/token
syncReadings: GET  https://us.health.samsung.com/v1/user/data/daily_step_count
              GET  https://us.health.samsung.com/v1/user/data/heart_rate
              GET  https://us.health.samsung.com/v1/user/data/sleep
refreshToken: POST https://us.health.samsung.com/auth/token  grant_type=refresh_token
revokeToken:  POST https://us.health.samsung.com/auth/revoke  (best-effort)
```

Metric mappings: steps → `55423-8`, HR → `8867-4`, sleep duration → `93832-4`.

JSDoc note: `// Samsung Health REST API requires developer account approval (developer.samsung.com/health). Allow 2–4 weeks. API is in limited beta as of 2026.`

```
Config additions:
  SAMSUNG_HEALTH_CLIENT_ID:     z.string().min(1)
  SAMSUNG_HEALTH_CLIENT_SECRET: z.string().min(1)
```

---

## Part E — Blocked and partnership stubs

### E1. Huawei Health Kit (`huawei.adapter.ts`) — BLOCKED

```typescript
// Huawei live sync is blocked until the EU Adequacy Decision for China is adopted
// (Decree 179/2020 + DPIA_WEARABLES_ADDENDUM.md + WL9 Part D config validator).
// The adapter MUST NOT contain working OAuth endpoints.
// platform-catalog.ts partnershipRequired=true controls UI gating.

getAuthUrl(_patientToken: string, _state: string): string {
  throw new WearablesBlockedError({
    error:   'HUAWEI_BLOCKED_EU_ADEQUACY',
    message: 'Huawei Health Kit is blocked pending the EU Adequacy Decision for China. See DPIA_WEARABLES_ADDENDUM.md.',
  });
}
async exchangeCode(): Promise<TokenSet>  { throw new WearablesBlockedError({ error: 'HUAWEI_BLOCKED_EU_ADEQUACY' }); }
async syncReadings(): Promise<RawReading[]> { return []; }
async refreshToken(): Promise<TokenSet>  { throw new WearablesBlockedError({ error: 'HUAWEI_BLOCKED_EU_ADEQUACY' }); }
async revokeToken():  Promise<void>      { /* no-op */ }

// Config validator (WL9 Part D) rejects HUAWEI_HEALTH_ENABLED=true
// when WEARABLES_ENABLED=true. Verify this is in place; do not add a second validator.
// Add HUAWEI_HEALTH_ENABLED to config.schema.ts if WL9 has not yet done so:
//   HUAWEI_HEALTH_ENABLED: strictBool(false)
```

### E2. Apple Health (`apple-health.adapter.ts`) — iOS app required

```typescript
// Apple HealthKit requires a native iOS companion app. No web OAuth path exists.
// Do NOT scaffold a SwiftUI app here — that is a separate deliverable.

getAuthUrl(): string {
  throw new WearablesStubError({ error: 'IOS_APP_REQUIRED', appStoreUrl: null });
}
async exchangeCode(): Promise<TokenSet>  { throw new WearablesStubError({ error: 'IOS_APP_REQUIRED' }); }
async syncReadings(): Promise<RawReading[]> { return []; }
async refreshToken(): Promise<TokenSet>  { throw new WearablesStubError({ error: 'IOS_APP_REQUIRED' }); }
async revokeToken():  Promise<void>      { /* no-op */ }

// Scaffold push endpoint for when the iOS app ships (501 Not Implemented):
// POST /api/wearables/upload/apple  (patient JWT, ReadingPayload[] body)
// Returns 501 with body { message: 'iOS companion app not yet available.' }
// audit_log entry on call (action: 'wearable_apple_push_stub_called')
```

```
Config additions (blank until app ships):
  APPLE_HEALTH_BUNDLE_ID: z.string().optional()
  APPLE_TEAM_ID:          z.string().optional()
```

### E3. Meta Ray-Ban (`meta.adapter.ts`) — partnership required

```typescript
// No public health API. Meta Wellbeing API requires a Meta Business partnership.
// Activity data only (steps, active minutes) — no biometrics.

getAuthUrl(): string {
  throw new BadRequestPartnership(WearablePlatform.meta);
}
async exchangeCode(): Promise<TokenSet>    { throw new BadRequestPartnership(WearablePlatform.meta); }
async syncReadings(): Promise<RawReading[]> { return []; }
async refreshToken(): Promise<TokenSet>    { throw new BadRequestPartnership(WearablePlatform.meta); }
async revokeToken():  Promise<void>        { /* no-op */ }
```

### E4. Xiaomi (`xiaomi.adapter.ts`) — manual CSV upload

```typescript
// No public OAuth API. Integration via GDPR Data Export (manual upload).

getAuthUrl(): string {
  throw new WearablesStubError({ error: 'MANUAL_EXPORT_REQUIRED' });
}
async exchangeCode(): Promise<TokenSet>    { throw new WearablesStubError({ error: 'MANUAL_EXPORT_REQUIRED' }); }
async syncReadings(): Promise<RawReading[]> { return []; }
async refreshToken(): Promise<TokenSet>    { throw new WearablesStubError({ error: 'MANUAL_EXPORT_REQUIRED' }); }
async revokeToken():  Promise<void>        { /* no-op — no token to revoke */ }
```

**Implement the upload endpoint (this is the live Xiaomi path):**

```
POST /api/wearables/upload/xiaomi
Auth:   Patient JWT (ConsentGuard — consent type 'data_storage' required)
Body:   multipart/form-data, field 'file', .zip, max 50 MB
Route:  wearables.controller.ts  (not a separate controller)
Returns: { imported: number, skipped: number, errors: string[] }
```

ZIP contents — parse these CSV files (ignore all others):

| File | Columns | metric_type | Unit |
|---|---|---|---|
| `ACTIVITY_STAGE.csv` | date, startTime, endTime, activityStage, steps | `55423-8` | steps |
| `SLEEP_STAGE.csv` | date, startTime, endTime, stage, duration_min | `93832-4` | min |
| `HEART_RATE.csv` | date, time, heartRate | `8867-4` | bpm |

Rules:
- Upsert key: `(device_id, recorded_at, metric_type)` — skip duplicates, count as `skipped`
- Malformed row (non-numeric value, unparseable date): skip + append description to `errors[]` — do not throw; partial import is acceptable
- Rows exceeding 10,000: reject with 422 before parsing begins
- `audit_log` entry: `action='wearable_xiaomi_upload'`, `meta={ imported, skipped, filename, patientTokenPrefix: token.slice(0,8) }`

### E5. Withings consumer tier

No new code. `WithingsAdapter` (W2) covers both medical-grade (BPM Connect Pro) and consumer (ScanWatch, Body+) devices via the same OAuth app. `ConsumerAdaptersModule` imports `MedicalAdaptersModule` which exports `WithingsAdapter` — that is sufficient. Do not duplicate the adapter.

---

## Part F — Config additions summary

```typescript
// apps/api/src/config/config.schema.ts

FITBIT_CLIENT_ID:             z.string().min(1),
FITBIT_CLIENT_SECRET:         z.string().min(1),

// Garmin — GARMIN_WEBHOOK_KEY already added by W6; verify present, don't duplicate
GARMIN_CONSUMER_KEY:          z.string().min(1),
GARMIN_CONSUMER_SECRET:       z.string().min(1),

GOOGLE_HEALTH_CLIENT_ID:      z.string().min(1),
GOOGLE_HEALTH_CLIENT_SECRET:  z.string().min(1),
GOOGLE_PROJECT_ID:            z.string().min(1),
GOOGLE_FHIR_DATASET:          z.string().min(1),
GOOGLE_FHIR_STORE:            z.string().min(1),

SAMSUNG_HEALTH_CLIENT_ID:     z.string().min(1),
SAMSUNG_HEALTH_CLIENT_SECRET: z.string().min(1),

// Huawei — HUAWEI_HEALTH_ENABLED added by WL9 Part D; verify present, don't duplicate
// If WL9 not yet merged: HUAWEI_HEALTH_ENABLED: strictBool(false)

// Apple — blank until iOS app ships
APPLE_HEALTH_BUNDLE_ID:       z.string().optional(),
APPLE_TEAM_ID:                z.string().optional(),
```

Add all to `.env.example` with empty values and comments.

---

## Part G — Unit tests

```
Test file: apps/api/src/wearables/adapters/consumer/consumer-adapters.spec.ts

G1. Fitbit — rate-limit backoff (no throw)
    Simulate 36 completed sync jobs in last hour (36 × 4 = 144 ≥ 140)
    → syncReadings returns []
    → wearable_devices.sync_status updated to 'pending', sync_error='rate_limit_backoff'
    → no exception thrown

G2. Fitbit — sleep mapping
    minutesAsleep=420 → device_reading: metric_type='93832-4', value_numeric=420, unit='min'

G3. Garmin — webhook not duplicated
    Import GarminWebhookController and GarminAdapter → only one @Controller class
    handles POST /api/wearables/webhooks/garmin (the W6 one)

G4. Garmin — syncReadings returns empty
    GarminAdapter.syncReadings(device, from) → returns []  (no HTTP calls made)

G5. Google Health — FHIR Observation → device_reading mapping
    Mock Observation: code.coding[0].code='8867-4', valueQuantity={value:72, unit:'bpm'}
    effectiveDateTime='2026-06-24T10:00:00Z'
    → device_reading: metric_type='8867-4', value_numeric=72, unit='bpm',
      recorded_at=2026-06-24T10:00:00Z

G6. Xiaomi — CSV parser: valid rows imported
    HEART_RATE.csv with 3 valid rows → 3 device_readings upserted; imported=3, skipped=0

G7. Xiaomi — CSV parser: malformed row skipped gracefully
    HEART_RATE.csv: row 2 has non-numeric heartRate='N/A'
    → row 2 skipped; rows 1 + 3 imported; errors=['Row 2: invalid heartRate value "N/A"']
    → no exception thrown

G8. Xiaomi — max-row guard
    Upload with 10,001 rows → 422 returned before any parsing begins

G9. Xiaomi — upload endpoint path
    POST /api/wearables/upload/xiaomi (not /api/wearables/xiaomi/upload)
    → route resolves correctly (integration test with supertest)

G10. Huawei — blocked at all 5 methods
    HuaweiAdapter.getAuthUrl()   → throws WearablesBlockedError, error='HUAWEI_BLOCKED_EU_ADEQUACY'
    HuaweiAdapter.exchangeCode() → throws WearablesBlockedError
    HuaweiAdapter.refreshToken() → throws WearablesBlockedError
    HuaweiAdapter.syncReadings() → returns []  (no throw)
    HuaweiAdapter.revokeToken()  → resolves void  (no throw)

G11. Huawei — config validator blocks HUAWEI_HEALTH_ENABLED=true in production
    Config { WEARABLES_ENABLED: true, HUAWEI_HEALTH_ENABLED: true }
    → config validator throws at startup (WL9 Part D enforcement)
    Mark: @skipWithoutWL9 if WL9 not yet merged in CI

G12. Apple — IOS_APP_REQUIRED stub
    AppleHealthAdapter.getAuthUrl() → throws WearablesStubError, error='IOS_APP_REQUIRED'
    POST /api/wearables/upload/apple → 501 Not Implemented

G13. Meta — BadRequestPartnership
    MetaAdapter.getAuthUrl() → throws BadRequestPartnership

G14. All 5 interface methods present on all 4 live adapters
    FitbitAdapter, GarminAdapter, GoogleHealthAdapter, SamsungHealthAdapter
    → tsc enforces; belt-and-suspenders: verify each method defined in test

G15. AdapterRegistry — consumer platforms registered
    WEARABLES_PROVIDER=live, getAdapter(WearablePlatform.fitbit)  → FitbitAdapter
    WEARABLES_PROVIDER=live, getAdapter(WearablePlatform.garmin)  → GarminAdapter
    WEARABLES_PROVIDER=live, getAdapter(WearablePlatform.huawei)  → HuaweiAdapter (blocked stub)

G16. No physicians table referenced
    grep -r 'physicians' apps/api/src/wearables/adapters/consumer/ → 0 matches
```

---

## Done-when checklist

- [ ] `ConsumerAdaptersModule` created; registered in `wearables.module.ts` alongside `MedicalAdaptersModule`
- [ ] `AdapterRegistry` extended with all 8 consumer platforms
- [ ] Fitbit: all 5 methods, rate-limit backoff (returns `[]`, no throw), correct metric mappings
- [ ] Garmin: OAuth 1.0a connect/disconnect ONLY; `garmin.webhook.controller.ts` NOT duplicated; `syncReadings` returns `[]`
- [ ] Google Health: all 5 methods, PKCE, FHIR Observation → `device_reading` mapping
- [ ] Samsung Health: all 5 methods, 3 metric types, developer-account note in JSDoc
- [ ] All 4 live adapters: `tsc --noEmit` clean, all 5 interface methods satisfied
- [ ] Huawei: blocked stub at all 5 methods; `HUAWEI_HEALTH_ENABLED=true` config-validator-enforced (WL9 gate verified)
- [ ] Apple: `IOS_APP_REQUIRED` stub; `/api/wearables/upload/apple` scaffolded (501); no SwiftUI code
- [ ] Meta: `BadRequestPartnership` thrown via `platform-catalog.ts`
- [ ] Xiaomi: `MANUAL_EXPORT_REQUIRED` stub; `POST /api/wearables/upload/xiaomi` implemented with ZIP+CSV parser
- [ ] Withings consumer: re-exported from `MedicalAdaptersModule` — no duplicate code
- [ ] `TokenCryptoService` used for all token storage — no plaintext in DB or logs
- [ ] `OAuthStateService.generateState / consumeState` (async) used on all OAuth routes
- [ ] All new env vars in `config.schema.ts` (verify existing W6/WL9 vars not duplicated); in `.env.example`
- [ ] `strictBool()` for all boolean flags; no `z.coerce.boolean()`
- [ ] No `physicians` table referenced anywhere in this sprint's code
- [ ] No `webhook_log` table created; audit events go to `AuditService.writeAuditEntry()`
- [ ] Upload endpoint path is `POST /api/wearables/upload/xiaomi` (not `/xiaomi/upload`)
- [ ] Unit tests G1–G15 green; G11 infra-gated if WL9 not in CI; G16 lint rule written
- [ ] `pnpm tsc --noEmit` clean on `apps/api`
- [ ] Merge: `git merge --ff-only feature/wearables-w3-consumer-adapters`

---

## Merge note (W2 + W3)

Only expected conflict is `wearables.module.ts` and `adapter-registry.service.ts`:

```typescript
// wearables.module.ts
// W2: imports: [MedicalAdaptersModule]
// W3: imports: [MedicalAdaptersModule, ConsumerAdaptersModule]
// Merged: imports: [MedicalAdaptersModule, ConsumerAdaptersModule]

// adapter-registry.service.ts constructor
// Merge both parameter lists and both this.live.set() blocks.
// No logic conflict — purely additive.
```
