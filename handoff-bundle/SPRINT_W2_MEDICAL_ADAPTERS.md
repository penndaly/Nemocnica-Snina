# Sprint W2 — Medical Device Adapters (v2)
## Nemocnica Snina · Wearables & Remote Monitoring

**Branch:** `feature/wearables-w2-medical-adapters`  
**Date:** June 24 2026  
**Hard dependency:** WL9 merged to main first.
  W4–W6 ship with an in-memory OAuth state service. WL9 Part A replaces it with
  a Redis-backed async contract. Adapters written before WL9 merges must be
  rewritten when it does. Do not start W2 until WL9 is on main.
**Parallel with:** W3 (consumer adapters) — branches merge independently after WL9.

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
4.  apps/api/src/wearables/platform-catalog.ts — gating flags and the existing
    BadRequestPartnership exception. Use these; do not invent a parallel error channel.
5.  apps/api/src/wearables/token-crypto.service.ts — REUSE, do not recreate.
    Use encryptToken / decryptToken for ALL OAuth token storage.
6.  apps/api/src/wearables/oauth-state.service.ts — REUSE, do not recreate.
    WL9 updated this to async Redis KV (generateState / consumeState are async).
    Do not call synchronous overloads; they no longer exist.
7.  apps/api/src/wearables/wearables.module.ts — where MedicalAdaptersModule
    and AdapterRegistry get registered. Read before touching.
8.  apps/api/src/wearables/sync.job.ts — background sync; adapters plug in via
    AdapterRegistry (Part A below), not direct injection.
9.  apps/api/src/config/config.schema.ts — add new env vars here only; use
    strictBool() for every boolean flag.
10. wearables-sprint-package/SPRINT_BACKLOG_WEARABLES.md §W2 — platform-level
    detail reference. Where it contradicts items 1–9 above, items 1–9 win.

Execute Sprint W2 only. Stop and report Done-when criteria before merging.
```

---

## Critical: conform to the shipped codebase

W4–W6 are on main, built on MockAdapter. W2 slots underneath that existing stack.
Several things are **already built and must not be recreated**:

| DO NOT recreate | Location | What to do instead |
|---|---|---|
| `TokenCryptoService` | `wearables/token-crypto.service.ts` | Inject and call `encryptToken` / `decryptToken` |
| `OAuthStateService` | `wearables/oauth-state.service.ts` | Inject and call `generateState` / `consumeState` (both async after WL9) |
| `ConsentService` + `ConsentGuard` | `wearables/consent.service.ts` | Already applied to all `/api/wearables/**` routes |
| Background sync job | `wearables/sync.job.ts` | Adapters plug in via `AdapterRegistry` (see Part A) |
| DB migrations | Prisma migrations on main | Do not re-run or alter existing migrations |
| REST controller | `wearables/wearables.controller.ts` | Do not add platform-specific controller methods |

---

## Non-negotiables

- **All 5 interface methods implemented.** `getAuthUrl`, `exchangeCode`, `syncReadings`, `refreshToken`, `revokeToken`. Stubs throw the correct catalog error; they still implement the interface.
- **All OAuth tokens via `TokenCryptoService`.** `encryptToken` / `decryptToken`. Never store plaintext. Never log tokens. Throw `WearablesTokenError` on decryption failure.
- **All OAuth state via `OAuthStateService`.** `generateState` / `consumeState` (async). Do not write your own state logic.
- **Partnership gating via `platform-catalog.ts` flags + `BadRequestPartnership` exception.** The canonical error is `partnershipRequired: true` in the catalog + the existing exception class. The verify checklist string `PARTNERSHIP_REQUIRED` is the catalog flag value, not a free-form string you invent.
- **No `physicians` table.** Physician–patient relationship is via `TelehealthSession`.
- **`LIBRE_REGION` config-validator-enforced.** Must equal `'eu'`; production validator rejects other values. Use `z.enum(['eu'])` with no fallback in the production path.
- **`strictBool()` for every boolean config flag.** `z.coerce.boolean()` is banned.
- **pnpm only.** Never `npm install` or `yarn`.

---

## Part A — Adapter registry (build this first — it is the missing architectural piece)

W1 wired a single `WEARABLE_ADAPTER` injection token to `MockAdapter`. With 9 medical adapters and N consumer adapters, the sync job and controller need a registry that selects the right adapter by platform at runtime.

```typescript
// apps/api/src/wearables/adapters/adapter-registry.service.ts

@Injectable()
export class AdapterRegistry {
  private readonly live = new Map<WearablePlatform, WearablePlatformAdapter>();

  constructor(
    // Inject every adapter — NestJS resolves them all
    private readonly mock:              MockAdapter,
    private readonly abbottLibre:       AbbottLibreAdapter,
    private readonly dexcom:            DexcomAdapter,
    private readonly withings:          WithingsAdapter,
    private readonly omron:             OmronAdapter,
    private readonly medtronicCgm:      MedtronicCgmAdapter,
    private readonly medtronicCardiac:  MedtronicCardiacAdapter,
    private readonly abbottCardiac:     AbbottCardiacAdapter,
    private readonly bscLatitude:       BscLatitudeAdapter,
    private readonly alivecor:          AlivecorAdapter,
    // ConsumerAdaptersModule adapters injected when W3 merges
    private readonly config:            ConfigService,
  ) {
    this.live.set(WearablePlatform.abbott_libre,      abbottLibre);
    this.live.set(WearablePlatform.dexcom,            dexcom);
    this.live.set(WearablePlatform.withings,          withings);
    this.live.set(WearablePlatform.omron,             omron);
    this.live.set(WearablePlatform.medtronic_cgm,     medtronicCgm);
    this.live.set(WearablePlatform.medtronic_cardiac, medtronicCardiac);
    this.live.set(WearablePlatform.abbott_cardiac,    abbottCardiac);
    this.live.set(WearablePlatform.boston_scientific,  bscLatitude);
    this.live.set(WearablePlatform.alivecor,          alivecor);
  }

  getAdapter(platform: WearablePlatform): WearablePlatformAdapter {
    if (this.config.get<string>('WEARABLES_PROVIDER') === 'mock') {
      return this.mock;
    }
    const adapter = this.live.get(platform);
    if (!adapter) {
      throw new Error(`No adapter registered for platform: ${platform}`);
    }
    return adapter;
  }
}
```

- Register `AdapterRegistry` in `MedicalAdaptersModule` and export it.
- Replace the single `WEARABLE_ADAPTER` token in `wearables.module.ts` with `AdapterRegistry`.
- Update `sync.job.ts` and `wearables.service.ts` to call `adapterRegistry.getAdapter(device.platform)` instead of injecting the adapter directly.

---

## Part B — `MedicalAdaptersModule`

```typescript
// apps/api/src/wearables/adapters/medical/medical-adapters.module.ts

@Module({
  providers: [
    AbbottLibreAdapter,
    DexcomAdapter,
    WithingsAdapter,          // shared; re-exported for W3 ConsumerAdaptersModule
    OmronAdapter,
    MedtronicCgmAdapter,      // partnership stub
    MedtronicCardiacAdapter,  // partnership stub
    AbbottCardiacAdapter,     // partnership stub
    BscLatitudeAdapter,       // partnership stub
    AlivecorAdapter,          // manual-upload stub
    AdapterRegistry,
  ],
  exports: [
    AbbottLibreAdapter, DexcomAdapter, WithingsAdapter, OmronAdapter,
    MedtronicCgmAdapter, MedtronicCardiacAdapter, AbbottCardiacAdapter,
    BscLatitudeAdapter, AlivecorAdapter, AdapterRegistry,
  ],
})
export class MedicalAdaptersModule {}
```

Add to `wearables.module.ts`:
```typescript
imports: [MedicalAdaptersModule],
// ConsumerAdaptersModule comes in W3
```

---

## Part C — LOINC metric_type reference

| Reading | LOINC | Unit | Notes |
|---|---|---|---|
| Glucose | `14745-4` | mmol/l | convert mg/dL ÷ 18.0182 |
| Heart rate | `8867-4` | bpm | — |
| Systolic BP | `8480-6` | mmHg | separate row from diastolic |
| Diastolic BP | `8462-4` | mmHg | separate row from systolic |
| SpO₂ | `59408-5` | % | — |
| Weight | `29463-7` | kg | — |
| ECG study | `11524-6` | — | — |
| Pacemaker status | `pacemaker-status` | — | custom, not a LOINC code |

Upsert key on `device_readings`: `(device_id, recorded_at, metric_type)` — prevents duplicates on re-sync.

---

## Part D — Live adapters

All live adapters implement all five interface methods. The four methods beyond `getAuthUrl`:

```typescript
// Every adapter must implement:
exchangeCode(code: string, state: string): Promise<TokenSet>
  // Validate state: await this.oauthStateService.consumeState(state)
  // Exchange code for tokens; encrypt both with tokenCrypto.encryptToken()
  // Return TokenSet (accessToken, refreshToken, expiresAt)

syncReadings(device: WearableDevice, from: Date): Promise<RawReading[]>
  // Decrypt tokens: this.tokenCrypto.decryptToken(device.oauthAccessTokenEnc)
  // Fetch readings from vendor API since `from`
  // Return RawReading[] — alert.service.ts evaluates flags

refreshToken(device: WearableDevice): Promise<TokenSet>
  // Called by sync.job.ts when oauth_expires_at < now + 5min (W6 rotation logic)
  // Decrypt refresh token; call vendor refresh endpoint; encrypt new tokens; return TokenSet

revokeToken(device: WearableDevice): Promise<void>
  // Called by ConsentService.withdrawConsent()
  // POST to vendor revocation endpoint; on failure: log + continue (do not block withdrawal)
```

### D1. Abbott LibreLink Up (`abbott-libre.adapter.ts`)

```
getAuthUrl:   https://api.libreview.io/auth  (EU endpoint — LIBRE_REGION=eu enforced)
exchangeCode: POST https://api.libreview.io/auth/token
syncReadings: GET  https://api.libreview.io/llu/connections/:patientId/graph
refreshToken: POST https://api.libreview.io/auth/token  grant_type=refresh_token
revokeToken:  DELETE https://api.libreview.io/auth/token  (best-effort)
```

- Validate `LIBRE_REGION === 'eu'` in the adapter constructor. Throw `WearablesConfigError` if not. The config validator enforces this in production with `z.enum(['eu'])` — add that to `config.schema.ts`.
- Glucose conversion: `mgPerDl / 18.0182`, round to 2dp. metric_type `14745-4`.
- `getAuthUrl()`: call `await this.oauthStateService.generateState(patientToken, 'abbott_libre')` → include state in redirect. State payload includes `LIBRE_REGION`.
- JSDoc note: `// Patient must accept connection invite from hospital LibreView account before sync returns data.`

```
Config additions (config.schema.ts):
  LIBRE_CLIENT_ID:     z.string().min(1)
  LIBRE_CLIENT_SECRET: z.string().min(1)
  LIBRE_REGION:        z.enum(['eu'])  — no default; validator rejects absence in production
```

### D2. Dexcom G7 (`dexcom.adapter.ts`)

```
getAuthUrl:   https://api.dexcom.com/v2/oauth2/login  (sandbox: sandbox-api.dexcom.com)
exchangeCode: POST https://api.dexcom.com/v2/oauth2/token
syncReadings: GET  https://api.dexcom.com/v3/users/self/egvs?startDate=[ISO]&endDate=[ISO]
refreshToken: POST https://api.dexcom.com/v2/oauth2/token  grant_type=refresh_token
revokeToken:  POST https://api.dexcom.com/v2/oauth2/revoke
```

- PKCE: generate `code_verifier` (32 random bytes, base64url) + `code_challenge` (SHA-256, base64url). Store `code_verifier` encrypted in Redis alongside OAuth state TTL (15 min). Retrieve in `exchangeCode` via `consumeState`.
- Glucose conversion: `mgPerDl / 18.0182`. metric_type `14745-4`.
- Rate limit: 1 call per 5 min per user. Check `device.lastSyncAt`; skip if < 5 min ago.
- `DEXCOM_SANDBOX=true` → use sandbox base URL.

```
Config additions:
  DEXCOM_CLIENT_ID:     z.string().min(1)
  DEXCOM_CLIENT_SECRET: z.string().min(1)
  DEXCOM_SANDBOX:       strictBool(true)
```

### D3. Withings Health API (`withings.adapter.ts`)

```
getAuthUrl:   https://account.withings.com/oauth2_user/authorize2
exchangeCode: POST https://wbsapi.withings.net/v2/oauth2  action=requesttoken
syncReadings: POST https://wbsapi.withings.net/measure?action=getmeas
refreshToken: POST https://wbsapi.withings.net/v2/oauth2  action=refreshtoken
revokeToken:  POST https://wbsapi.withings.net/v2/oauth2  action=revoketoken
```

Withings meastype → metric_type:

| meastype | metric_type | Unit |
|---|---|---|
| 1 | `29463-7` | kg (÷1000 if in grams) |
| 9 | `8462-4` | mmHg (diastolic) |
| 10 | `8480-6` | mmHg (systolic) |
| 11 | `59408-5` | % |
| 88 | `8867-4` | bpm |

BP (meastype 9 + 10) arrives in one API call → write **two separate `device_readings` rows** with the same `recorded_at`. This is required for alert.service.ts threshold evaluation by metric_type.

```
Config additions:
  WITHINGS_CLIENT_ID:     z.string().min(1)
  WITHINGS_CLIENT_SECRET: z.string().min(1)
```

### D4. Omron Connect (`omron.adapter.ts`)

```
getAuthUrl:   https://oauth.omronconnect.com/oauth2/authorize
exchangeCode: POST https://oauth.omronconnect.com/oauth2/token
syncReadings: GET  https://api.omronconnect.com/measurement/v1/bloodpressure
refreshToken: POST https://oauth.omronconnect.com/oauth2/token  grant_type=refresh_token
revokeToken:  POST https://oauth.omronconnect.com/oauth2/revoke  (best-effort)
```

One BP response → three rows: systolic (`8480-6`), diastolic (`8462-4`), pulse/HR (`8867-4`) — same `recorded_at`.

```
Config additions:
  OMRON_CLIENT_ID:     z.string().min(1)
  OMRON_CLIENT_SECRET: z.string().min(1)
```

---

## Part E — Partnership + manual-upload stubs

Each stub implements all 5 interface methods. All non-`getAuthUrl` methods throw `BadRequestPartnership` (from `platform-catalog.ts`) or return empty for `syncReadings`. The catalog `partnershipRequired: true` flag controls UI gating — adapters do not need to duplicate that logic.

```typescript
// Pattern for all partnership stubs:
getAuthUrl(_patientToken: string, _state: string): string {
  throw new BadRequestPartnership(WearablePlatform.medtronic_cgm);
}
async exchangeCode(): Promise<TokenSet> {
  throw new BadRequestPartnership(WearablePlatform.medtronic_cgm);
}
async syncReadings(): Promise<RawReading[]> { return []; }
async refreshToken(): Promise<TokenSet> {
  throw new BadRequestPartnership(WearablePlatform.medtronic_cgm);
}
async revokeToken(): Promise<void> { /* no-op — no token to revoke */ }
```

| Adapter | Platform enum | Partnership contact |
|---|---|---|
| `medtronic-cgm.adapter.ts` | `medtronic_cgm` | partnerapi@medtronic.com |
| `medtronic-cardiac.adapter.ts` | `medtronic_cardiac` | mycarelink-api@medtronic.com |
| `abbott-cardiac.adapter.ts` | `abbott_cardiac` | cardiovascular.digital@abbott.com |
| `bsc-latitude.adapter.ts` | `boston_scientific` | rpmpartner@bsci.com |

**AliveCor (`alivecor.adapter.ts`)** — manual upload, not partnership:
- `getAuthUrl()` throws `WearablesStubError({ error: 'MANUAL_UPLOAD_REQUIRED' })`.
- All other methods: same stub pattern as above.
- Scaffold `POST /api/wearables/upload/kardia` (multipart PDF, `StaffJwtGuard` — clinician only) returning 501 Not Implemented. Wire parsing when KardiaPro Enterprise agreement is signed. metric_type: `11524-6`.
- `audit_log` entry on every upload attempt (action: `wearable_kardia_upload_attempted`).

---

## Part F — Config additions summary

```typescript
// apps/api/src/config/config.schema.ts — add all of these:

LIBRE_CLIENT_ID:       z.string().min(1),
LIBRE_CLIENT_SECRET:   z.string().min(1),
LIBRE_REGION:          z.enum(['eu']),        // no default — required in production

DEXCOM_CLIENT_ID:      z.string().min(1),
DEXCOM_CLIENT_SECRET:  z.string().min(1),
DEXCOM_SANDBOX:        strictBool(true),

WITHINGS_CLIENT_ID:    z.string().min(1),
WITHINGS_CLIENT_SECRET:z.string().min(1),

OMRON_CLIENT_ID:       z.string().min(1),
OMRON_CLIENT_SECRET:   z.string().min(1),

// Stubs — optional; present so .env.example is self-documenting:
MEDTRONIC_CLIENT_ID:    z.string().optional(),
MEDTRONIC_CLIENT_SECRET:z.string().optional(),
```

Add all to `.env.example` with empty values and comments.

---

## Part G — Unit tests

```
Test file: apps/api/src/wearables/adapters/medical/medical-adapters.spec.ts

G1. Abbott Libre — EU region enforced at constructor
    LIBRE_REGION='us' → WearablesConfigError thrown at module init (not at runtime)

G2. Abbott Libre — glucose conversion
    Input: 180 mg/dL → 10.0 mmol/l ±0.01
    Input:  72 mg/dL →  4.0 mmol/l ±0.01

G3. Dexcom — PKCE challenge (RFC 7636 Appendix B test vector)
    Fixed code_verifier → expected code_challenge string (SHA-256 base64url)

G4. Dexcom — sandbox URL switch
    DEXCOM_SANDBOX=true → getAuthUrl() URL contains 'sandbox-api.dexcom.com'
    DEXCOM_SANDBOX=false → URL contains 'api.dexcom.com'

G5. Withings — BP pair splits to 2 rows
    Single getmeas response with meastype 9 + meastype 10 at same timestamp
    → 2 device_reading rows: systolic metric_type='8480-6', diastolic='8462-4'
    Both rows have identical recorded_at

G6. Withings — weight unit conversion
    meastype=1, value=75000 (Withings returns in grams) → 75.0 kg stored

G7. Omron — 3 readings from one BP response
    One bloodpressure response → rows for '8480-6', '8462-4', '8867-4'; same recorded_at

G8. All 5 interface methods present on all 4 live adapters
    For each adapter class: verify .getAuthUrl .exchangeCode .syncReadings
      .refreshToken .revokeToken are all defined (tsc enforces this — belt-and-suspenders)

G9. Partnership stubs — BadRequestPartnership thrown, no OAuth initiated
    MedtronicCgmAdapter.getAuthUrl()   → throws BadRequestPartnership
    MedtronicCardiacAdapter.getAuthUrl() → throws BadRequestPartnership
    AbbottCardiacAdapter.getAuthUrl()   → throws BadRequestPartnership
    BscLatitudeAdapter.getAuthUrl()     → throws BadRequestPartnership
    Each: syncReadings() returns [] (no throw)

G10. AliveCor stub — MANUAL_UPLOAD_REQUIRED
    AlivecorAdapter.getAuthUrl() → throws WearablesStubError with error='MANUAL_UPLOAD_REQUIRED'

G11. TokenCryptoService round-trip
    encryptToken(plain) → ciphertext !== plain
    decryptToken(ciphertext) === plain
    decryptToken(tampered) → throws WearablesTokenError

G12. AdapterRegistry — correct adapter selected
    WEARABLES_PROVIDER=mock → getAdapter(any platform) returns MockAdapter
    WEARABLES_PROVIDER=live → getAdapter(abbott_libre) returns AbbottLibreAdapter
    WEARABLES_PROVIDER=live → getAdapter(unknown_platform) throws Error

G13. OAuthStateService — one-time-use (infra-gated)
    generateState(token, 'abbott_libre') → consumeState(state) → { patientToken } ✓
    consumeState(state) a second time → null
    Mark: @skipWithoutRedis — skip gracefully in CI if Redis not available
```

---

## Done-when checklist

- [ ] `AdapterRegistry` built and wired; sync job uses `adapterRegistry.getAdapter(platform)`
- [ ] `MedicalAdaptersModule` registered in `wearables.module.ts`
- [ ] Abbott Libre: all 5 methods, EU region validator-enforced, mg/dL→mmol/l
- [ ] Dexcom: all 5 methods, PKCE, sandbox switch, 5-min rate limit guard
- [ ] Withings: all 5 methods, 5 meastype mappings, BP pair → 2 rows
- [ ] Omron: all 5 methods, 3 readings per BP response
- [ ] All 4 live adapters: `tsc --noEmit` clean, interface satisfied
- [ ] All 4 partnership stubs: `BadRequestPartnership` thrown from `platform-catalog.ts`; `syncReadings` returns `[]`
- [ ] AliveCor: `MANUAL_UPLOAD_REQUIRED` stub; `/api/wearables/upload/kardia` scaffolded (501)
- [ ] `TokenCryptoService` used for all token storage — no plaintext in DB or logs
- [ ] `OAuthStateService.generateState / consumeState` (async) used on all OAuth routes
- [ ] `LIBRE_REGION` config validator uses `z.enum(['eu'])` — rejects non-EU in production
- [ ] All new env vars in `config.schema.ts` using `strictBool()` for booleans; in `.env.example`
- [ ] No `physicians` table referenced anywhere in this sprint's code
- [ ] Unit tests G1–G12 green; G13 written + infra-gated
- [ ] `pnpm tsc --noEmit` clean on `apps/api`
- [ ] Merge: `git merge --ff-only feature/wearables-w2-medical-adapters`

---

## Merge note (W2 + W3)

Both branches add to `wearables.module.ts`. Only expected conflict:

```typescript
// W2 adds:
imports: [MedicalAdaptersModule],

// W3 adds (via ConsumerAdaptersModule which imports MedicalAdaptersModule):
imports: [MedicalAdaptersModule, ConsumerAdaptersModule],

// Merged result:
imports: [MedicalAdaptersModule, ConsumerAdaptersModule],
```

W3's `AdapterRegistry` constructor gains the consumer-adapter injections added by W3 — resolve by merging both constructor parameter lists. No logic conflict.
