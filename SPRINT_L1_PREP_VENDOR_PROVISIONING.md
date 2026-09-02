# L1-PREP — Vendor account provisioning & secret-injection runbook
## Nemocnica Snina · Launch gate L1 (OPS + BUILD support)

**Owner:** Operations (provisioning) + Claude Code (config validator, secret-presence health, .env scaffolding)
**Precedes:** L2 (EU staging smoke tests) — cannot start until every secret here is vaulted and the config validator passes with all mocks off.
**Branch (BUILD parts):** `feature/l1-config-validator` off main (after A4 merges)
**Compliance anchors:** Decree 179/2020 (EU residency, TLS 1.3, AES-256 at rest) · Act 351/2022 (WCAG) · Act 362/2011 (NCZI eZdravie = legally valid prescription) · GDPR Art. 46 (TURN EU residency)

---

## What L1 actually gates

The platform is feature-complete in **mock mode**. Every external integration today runs against a mock or sandbox. L1 is the controlled swap from mock → real, vendor by vendor, with three hard rules:

1. **Every secret is vaulted** — never in `.env` committed to git, never in CI logs, never in Strapi content.
2. **EU residency proven per vendor** — data-processing region documented and contractually fixed (DPA on file) before the credential goes live.
3. **The config validator passes with all mocks off** — `OIDC_MOCK_ENABLED=false`, `HIS_MOCK_ENABLED=false`, `TELEHEALTH_PROVIDER≠mock`, `MFA_REQUIRED=true`. If any required secret is absent or any mock is still on, production boot must fail fast — not silently fall back.

L1 does **not** turn wearables on. `WEARABLES_ENABLED=false` stays until the §L9 gate (DPAs, SCCs, partnership agreements). L1 provisions and vaults the wearables credentials so they are *ready*, but the flag stays off.

---

## Paste this into Claude Code (BUILD parts only — D1–D4)

```
This sprint is mostly an OPS provisioning runbook (Parts A–C) — those are human tasks.
Your scope is the BUILD support items D1–D4 only:

Read first:
1. apps/api/src/config/config.schema.ts — the Zod/env schema + noChangeme() helper (CLAUDE.md fix)
2. apps/api/src/config/ — the config validator / ConfigModule setup
3. apps/api/.env.example — current variable surface
4. PRODUCTION_ARCHITECTURE.md — integration list + EU-residency requirements
5. CLAUDE.md — the Non-negotiables and Telemedicine non-negotiables blocks

Then execute D1–D4 (see below). Do NOT provision accounts or invent credential values.
Do NOT enable any mock-off flag in committed .env — only in .env.example as documentation.
Stop after D4 and report. The OPS team runs Parts A–C against your validator.
```

---

## Part A — Core platform integrations (gate the whole site)

Each row: provision the production account, confirm EU data region, sign the DPA, vault the secret, then flip the mock flag off in the production environment (never in git).

| # | Integration | Secrets to vault | Mock flag → off | EU-residency proof required | Owner |
|---|---|---|---|---|---|
| 1 | **slovensko.sk eID / OIDC** (patient + staff auth) | `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_ISSUER_URL`, `OIDC_JWKS_URI` | `OIDC_MOCK_ENABLED=false` | NASES (national, SK) — confirm IdP endpoint + JWKS | Ops + Legal |
| 2 | **HIS** (hospital information system) | `HIS_HL7_ENDPOINT`, `HIS_FHIR_BASE_URL`, `HIS_CLIENT_CERT`, `HIS_CLIENT_KEY`, `HIS_MTLS_CA` | `HIS_MOCK_ENABLED=false` | On-prem / hospital DC (SK) — mTLS only, no public exposure | Ops + Hospital IT |
| 3 | **SMS gateway** (booking, MFA, critical alerts) | `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_ENDPOINT`, `WEARABLES_ALERT_SMS_TO` | n/a (no mock flag — uses test credentials in dev) | EU SMS aggregator — confirm processing region | Ops |
| 4 | **Payment gateway** (booking payments, receipts) | `PAYMENT_API_KEY`, `PAYMENT_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_MERCHANT_ID` | n/a | EU PSP — PCI-DSS + EU settlement | Ops + Finance |
| 5 | **NCZI eZdravie** (e-prescriptions — legally valid) | `NCZI_CLIENT_CERT`, `NCZI_CLIENT_KEY`, `NCZI_ENDPOINT`, `NCZI_OUR_PROVIDER_ID` | n/a | NCZI (national, SK) — qualified cert | Ops + Legal |
| 6 | **Translation service** (cs/pl/hu/uk machine drafts) | `TRANSLATION_API_KEY`, `TRANSLATION_ENDPOINT` | n/a | EU endpoint (e.g. DeepL EU) — confirm no data outside EU | Ops |
| 7 | **LiveKit** (telemedicine video + TURN) | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL`, `LIVEKIT_TURN_REGION=eu` | `TELEHEALTH_PROVIDER=livekit` (not `mock`) | EU LiveKit cloud OR self-hosted EU + EU TURN (GDPR Art. 46) | Ops |

**Hard checks before any of these go live:**
- eID (#1) and HIS (#2): the config validator must reject production boot if `OIDC_MOCK_ENABLED` or `HIS_MOCK_ENABLED` is `true` OR if their secrets are absent.
- LiveKit (#7): `TELEHEALTH_PROVIDER=mock` must be rejected in production. `LIVEKIT_TURN_REGION` must equal `eu` or boot fails.
- NCZI (#5): the FHIR MedicationRequest is only the HIS copy — the NCZI eZdravie record is the legally valid prescription. Do not go live on telemedicine prescribing until #5 is verified end-to-end in L2.

---

## Part B — Wearables medical adapters (W2) — provision, vault, leave OFF

`WEARABLES_ENABLED=false` until §L9. Provision and vault now so L9 is a flag flip, not a scramble.

| # | Adapter | Secrets to vault | EU-residency / partnership note |
|---|---|---|---|
| 8 | **Abbott LibreLinkUp (EU)** | `LIBRE_CLIENT_ID`, `LIBRE_CLIENT_SECRET`, `LIBRE_REGION=eu` | EU region mandatory (`z.enum(['eu']).default('eu')` in schema). Resolve the live LibreLinkUp connection-id TODO — adapter currently uses `device.id` placeholder; needs a persisted provider connection id before `WEARABLES_PROVIDER=live`. |
| 9 | **Dexcom G7 (EU)** | `DEXCOM_CLIENT_ID`, `DEXCOM_CLIENT_SECRET`, `DEXCOM_SANDBOX=false` | EU API host. Confirm sandbox→prod app review complete. Device created with `lastSyncAt=null` (QA fix) — initial pull works. |
| 10 | **Withings** | `WITHINGS_CLIENT_ID`, `WITHINGS_CLIENT_SECRET` | EU region. Measure-type mapping corrected in QA (11=pulse, 54=SpO2, 88=bone mass) — verify against the production account's `getmeas` response in L2. |
| 11 | **Omron connect** | `OMRON_CLIENT_ID`, `OMRON_CLIENT_SECRET` | Confirm EU data region. |
| 12 | **Kardia / AliveCor** (upload scaffold) | `KARDIA_API_KEY` | Upload-only scaffold (no live OAuth). Provision API key; full adapter is post-launch. |

**Partnership-gated medical stubs — NOT provisionable at L1** (tracked for §L9, 4–8 week lead):
Medtronic CGM, Abbott Cardiac, Boston Scientific, Philips — all `partnershipRequired: true`. Connect is blocked at the catalog level. No L1 action beyond initiating the partnership/DPA conversations.

---

## Part C — Wearables consumer adapters (W3) — provision, vault, leave OFF

These cross the EU boundary (US-based processors) — **SCCs required**, not just a DPA.

| # | Adapter | Secrets to vault | Cross-border instrument |
|---|---|---|---|
| 13 | **Fitbit (Google)** | `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET` | SCC — Google/US. Backoff math verified in QA. |
| 14 | **Garmin** | `GARMIN_CONSUMER_KEY`, `GARMIN_CONSUMER_SECRET`, `GARMIN_WEBHOOK_KEY` | SCC — US. OAuth-1.0a request-token handshake still deferred (push semantics are real; `getAuthUrl` throws explicitly). Full OAuth-1.0a is a separate task before this can go live. |
| 15 | **Google Health Connect** | `GOOGLE_HEALTH_CLIENT_ID`, `GOOGLE_HEALTH_CLIENT_SECRET` | SCC — Google/US. PKCE re-derived statelessly. |
| 16 | **Samsung Health** | `SAMSUNG_HEALTH_CLIENT_ID`, `SAMSUNG_HEALTH_CLIENT_SECRET` | SCC — US. |

**Consumer stubs — NOT provisionable at L1:**
- **Apple Health** — needs the iOS companion app (App Store) first; `APPLE_HEALTH_BUNDLE_ID` / `APPLE_TEAM_ID` stay blank until that ships.
- **Huawei** — hard-blocked at config level until EU Adequacy Decision. No credentials, no provisioning. Do not attempt.
- **Xiaomi** — file-import only (.zip/CSV via adm-zip); no API credentials to provision.
- **Meta, Polar** — partnership stubs; initiate conversations only.

---

## Part D — BUILD support (Claude Code scope)

### D1 — Config validator: fail-fast on absent secrets + mocks-on in production

In `apps/api/src/config/config.schema.ts` / the ConfigModule validator, extend the production-mode validation so boot **throws** (not warns) when `NODE_ENV=production` and any of these hold:

```typescript
// Production-only refinements (add to the existing schema .refine / superRefine):

// 1. Mocks must be off in production
if (env.NODE_ENV === 'production') {
  if (env.OIDC_MOCK_ENABLED === true)  fail('OIDC_MOCK_ENABLED must be false in production');
  if (env.HIS_MOCK_ENABLED === true)   fail('HIS_MOCK_ENABLED must be false in production');
  if (env.TELEHEALTH_PROVIDER === 'mock') fail('TELEHEALTH_PROVIDER=mock rejected in production');
  if (env.MFA_REQUIRED !== true)       fail('MFA_REQUIRED must be true in production');

  // 2. Core integration secrets must be present and non-placeholder
  //    (reuse the noChangeme() helper from the CLAUDE.md local fix)
  noChangeme('OIDC_CLIENT_SECRET', 16);
  noChangeme('HIS_CLIENT_KEY');
  noChangeme('SMS_API_KEY', 8);
  noChangeme('PAYMENT_SECRET', 16);
  noChangeme('PAYMENT_WEBHOOK_SECRET', 16);
  noChangeme('NCZI_CLIENT_KEY');
  noChangeme('LIVEKIT_API_SECRET', 16);

  // 3. LiveKit TURN must be EU (GDPR Art. 46)
  if (env.TELEHEALTH_PROVIDER === 'livekit' && env.LIVEKIT_TURN_REGION !== 'eu')
    fail('LIVEKIT_TURN_REGION must be "eu" in production');

  // 4. Wearables: if WEARABLES_ENABLED=true, every ENABLED adapter's secrets must be present.
  //    (Do NOT require wearables secrets when WEARABLES_ENABLED=false — they provision ahead of L9.)
  if (env.WEARABLES_ENABLED === true) {
    // for each adapter not in partnership/blocked state, assert its client id + secret are set
  }

  // 5. Huawei can never be enabled (EU Adequacy)
  // (already enforced — keep the existing gate)
}
```

`fail()` aggregates messages so a single boot reports **all** missing secrets at once, not one at a time. Use `strictBool()` (from commit a7b9714) for every boolean flag so `"false"` can never read as `true`.

### D2 — `.env.example` completeness

Ensure `.env.example` lists **every** variable in Parts A–C with empty values and an inline comment noting: required-in-production, the owner, and EU-residency note. This is the single source of truth ops uses to build the vault. No real values — placeholders only. Group by Part A / B / C with header comments.

### D3 — Secret-presence health endpoint (no values leaked)

Add `GET /api/admin/system/integration-readiness` (role: `super_admin`):

```typescript
// Returns readiness booleans ONLY — never a secret value, never a partial.
// {
//   core: {
//     oidc:        { configured: boolean, mockOff: boolean },
//     his:         { configured: boolean, mockOff: boolean },
//     sms:         { configured: boolean },
//     payments:    { configured: boolean },
//     nczi:        { configured: boolean },
//     translation: { configured: boolean },
//     livekit:     { configured: boolean, turnRegionEu: boolean, providerLive: boolean }
//   },
//   wearables: {
//     enabled: boolean,    // WEARABLES_ENABLED
//     adapters: { [id]: { credentialsConfigured: boolean, partnershipRequired: boolean, blocked: boolean } }
//   },
//   productionReady: boolean   // true only if every core.*.configured && all mocks off
// }
```

This is what ops watches turn green during L1, and what the L9 go/no-go review reads. It reuses the same `credentialsConfigured` pattern from the A4 wearables platform endpoint (never returns the value).

### D4 — Tests

```typescript
// config-validator.spec.ts:
// L1-1  production + OIDC_MOCK_ENABLED=true → boot throws
// L1-2  production + HIS_MOCK_ENABLED=true → boot throws
// L1-3  production + TELEHEALTH_PROVIDER=mock → boot throws
// L1-4  production + MFA_REQUIRED=false → boot throws
// L1-5  production + missing PAYMENT_SECRET → boot throws (aggregated with any other gaps)
// L1-6  production + TELEHEALTH_PROVIDER=livekit + LIVEKIT_TURN_REGION=us → boot throws
// L1-7  production + WEARABLES_ENABLED=true + Fitbit enabled + secrets absent → boot throws
// L1-8  production + WEARABLES_ENABLED=false + wearables secrets absent → boots fine (provision-ahead)
// L1-9  development + all mocks on → boots fine (no production refinements apply)
// L1-10 aggregation: 3 secrets missing → error message names all 3

// integration-readiness.controller.spec.ts:
// L1-11 endpoint returns booleans only; assert no secret value appears anywhere in response
// L1-12 non-super_admin → 403
// L1-13 productionReady=false when any core mock still on
```

---

## Done when

### OPS (Parts A–C) — tracked, run by operations
- [ ] All 7 core integrations (Part A) provisioned, EU region confirmed, DPA signed, secrets vaulted
- [ ] eID + HIS mock flags off in production env; config validator passes
- [ ] LiveKit `TELEHEALTH_PROVIDER=livekit`, `LIVEKIT_TURN_REGION=eu`, TURN proven EU-resident
- [ ] NCZI eZdravie cert installed; prescription path ready for L2 end-to-end test
- [ ] 5 medical adapter accounts (Part B) provisioned + vaulted; Abbott connection-id TODO resolved
- [ ] 4 consumer adapter accounts (Part C) provisioned + vaulted; SCCs signed for all US processors
- [ ] Partnership conversations initiated (Medtronic, Abbott Cardiac, BSC, Meta, Polar) — 4–8 wk lead
- [ ] Huawei confirmed NOT provisioned (stays blocked); Apple deferred to iOS app

### BUILD (Part D) — Claude Code
- [ ] Config validator throws on every mock-on / missing-secret / non-EU-TURN case (L1-1…L1-10 green)
- [ ] `.env.example` lists every Part A–C variable with owner + EU note, no real values
- [ ] `/api/admin/system/integration-readiness` returns booleans only — no value leak (L1-11 green)
- [ ] `productionReady` flips true only when all core configured + mocks off (L1-13 green)
- [ ] `tsc --noEmit` clean; full API suite green (infra-gated set unchanged)

### Gate to L2
- [ ] `integration-readiness` shows `productionReady: true` on the EU staging environment
- [ ] Every Part A secret resolves against its **sandbox** endpoint (full prod swap happens in L2 smoke)
- [ ] `WEARABLES_ENABLED` confirmed still `false` (does not block L2)
