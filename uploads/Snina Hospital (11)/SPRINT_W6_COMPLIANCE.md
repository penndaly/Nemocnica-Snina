# Sprint W6 — Compliance, Security Hardening & Production Gate
## Nemocnica Snina · Wearables & Remote Monitoring

**Branch:** `feature/wearables-w6-compliance`  
**Depends on:** W5 ✅ merged (alerts, physician view, FHIR export live)  
**This sprint gates `WEARABLES_ENABLED=true` in production.**  
**Design references:**
- `consent-management.html` (WCAG audit target)
- `portal.html` Wearables tab (WCAG audit target)
- `design_handoff_nemocnica_snina/TELEMEDICINE_COMPLIANCE_REVIEW.md` (pattern)
- `design_handoff_nemocnica_snina/LAUNCH_CHECKLIST.md §L9` (gate to extend)

---

## Paste this into Claude Code before starting

```
Read the following files in full before writing any code:

1. design_handoff_nemocnica_snina/TELEMEDICINE_COMPLIANCE_REVIEW.md (pattern)
2. design_handoff_nemocnica_snina/LAUNCH_CHECKLIST.md §L9 (extend for wearables)
3. apps/api/src/config/config.schema.ts (add WEARABLES_ENABLED enforcement)
4. apps/api/src/wearables/ (all files — understand full module before hardening)
5. apps/web/src/app/[lang]/portal/wearables/ (WCAG audit scope)

Execute Sprint W6 only. This sprint produces no new features — only security
hardening, GDPR compliance docs, WCAG fixes, and the production launch gate.
Stop and report Done-when criteria before marking W6 complete.
```

---

## Non-negotiables

- `WEARABLES_ENABLED=true` ONLY after all items in Part G (Launch gate) are checked.
- `WEARABLES_PROVIDER=mock` rejected in production by config validator.
- Huawei live sync blocked until EU Adequacy Decision or SCCs confirmed.
- No patient data in alert SMS beyond `patient_token.slice(0,8)` + device label.
- axe-core: zero critical or serious violations on all 3 wearables pages before gate passes.

---

## Part A — OAuth token rotation

```typescript
// In wearables sync job (W2/W3 sync.job.ts): before each sync call:

async refreshTokenIfNeeded(device: WearableDevice): Promise<WearableDevice>
  If device.oauth_expires_at < now + 5 minutes:
    token = await adapter.refreshToken(device)
    UPDATE wearable_devices SET
      oauth_access_token_enc  = encrypt(token.accessToken),
      oauth_refresh_token_enc = encrypt(token.refreshToken),
      oauth_expires_at        = token.expiresAt,
      updated_at              = now()
    WHERE id = device.id
    // Clear old token from memory immediately after encrypt
  On refresh failure:
    UPDATE wearable_devices SET sync_status = 'error', sync_error = 'token_refresh_failed'
    Create portal_notification(type='wearable_token_expired', device_id)
    // Do NOT send SMS — avoid leaking device existence to phone
    Return null → skip sync for this device

// Integration test: expired token → refreshTokenIfNeeded called → new encrypted tokens stored
// Integration test: refresh failure → sync_status='error' → portal notification created (no SMS)
```

---

## Part B — OAuth state CSRF hardening

```typescript
// Audit and tighten OAuthStateService (W1 stub):

generateState(patientToken, platform):
  state = HMAC-SHA256(patientToken + ':' + platform + ':' + nonce, WEARABLES_TOKEN_KEY)
  Store in Redis: key='oauth_state:' + state, value={patientToken, platform}, EX=900 (15 min)
  Return state

validateState(state, expectedPlatform):
  entry = Redis.get('oauth_state:' + state)
  If !entry: throw BadRequestException('INVALID_OAUTH_STATE')
  If entry.platform !== expectedPlatform: throw BadRequestException('STATE_PLATFORM_MISMATCH')
  Redis.del('oauth_state:' + state)  // one-time use
  Return { patientToken: entry.patientToken }

// Ensure validateState is called on EVERY /api/wearables/callback/:platform route.
// Integration test: valid state → accepted; reused state → 400; expired state → 400;
//   state for wrong platform → 400; forged state (not in Redis) → 400.
```

---

## Part C — Webhook signature hardening (Garmin + future platforms)

```typescript
// In apps/api/src/wearables/webhooks/garmin.webhook.ts:

validateGarminSignature(req: Request, rawBody: Buffer): void
  signature = req.headers['x-garmin-signature']
  expected  = HMAC-SHA1(rawBody, GARMIN_WEBHOOK_KEY).hex
  If !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)):
    audit_log: action='webhook_invalid_signature', platform='garmin', ip=req.ip
    throw UnauthorizedException('INVALID_WEBHOOK_SIGNATURE')

// All webhook endpoints: validate signature FIRST; return 200 immediately;
// enqueue to RabbitMQ for async processing (never process sync in webhook handler).
// Rate-limit: 100 req/min per source IP (use Redis + sliding window).
// Log raw payload to webhook_log table (columns: platform, received_at, ip, body_hash, processed_at).
// NEVER log decrypted token values anywhere.

// Unit test: valid signature → accepted; tampered body → 401;
//   missing header → 401; rate-limit exceeded → 429.
```

---

## Part D — Physician access scope hardening

```typescript
// Strengthen the physician access guard from W5:

checkPhysicianAccess(physicianId, patientToken):
  conditions = [
    // Condition A: recent appointment
    appointments.exists({ physician_id: physicianId, patient_token: patientToken,
      date: { gte: subDays(now, WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS) } }),
    // Condition B: active telehealth session
    telehealth_sessions.exists({ physician_id: physicianId, patient_token: patientToken,
      scheduled_at: { gte: subDays(now, WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS) } }),
    // Condition C: explicit consent (future: patient grants named physician access)
    device_consent.exists({ patient_token, type: 'physician_named_access',
      physician_id: physicianId, granted: true })
  ]
  If !conditions.some(Boolean): throw ForbiddenException('PHYSICIAN_ACCESS_DENIED')

// Integration tests:
// - Physician A with appointment for Patient X → 200
// - Physician A with expired appointment (91 days ago) → 403
// - Physician B with NO appointment for Patient X → 403
// - Patient A's JWT requesting Patient B's device readings → 403 (readings isolation)
//   Implementation: in all GET /api/wearables/devices/:deviceId endpoints,
//   verify wearable_devices.patient_token === req.user.patient_token; throw 403 if not.
```

---

## Part E — GDPR compliance documentation

```markdown
Create docs/DPIA_WEARABLES_ADDENDUM.md:

# DPIA Addendum — Wearables & Remote Monitoring
## Data controller: Nemocnica Snina, s.r.o.

### Lawful basis
Special category health data (GDPR Art. 9) — explicit consent (Art. 9(2)(a)).
Patient withdraws consent via /portal/wearables/sublas at any time.

### Data categories
| Data | Category | LOINC / standard | Retention |
|---|---|---|---|
| CGM glucose readings | Art. 9 health | 14745-4 | 90 days or until FHIR export |
| ECG waveforms | Art. 9 health | 11524-6 | 90 days or until FHIR export |
| Pacemaker telemetry | Art. 9 health | custom | Partnership agreement required |
| Blood pressure | Art. 9 health | 85354-9 | 90 days or until FHIR export |
| Heart rate | Art. 9 health | 8867-4 | 90 days or until FHIR export |
| Steps / activity | Lifestyle | 55423-8 | 90 days |
| OAuth tokens (encrypted) | Technical | — | Until revoked |
| Consent audit rows | Legal evidence | — | 5 years (Art. 5(2)) |

### Third-party processors (requires signed DPA before live sync)
| Vendor | Platform | EU hosting | DPA status | SCC required |
|---|---|---|---|---|
| Abbott | FreeStyle Libre 3 | ✅ EU (LibreView EU) | ⬜ pending | No |
| Dexcom | G7 / ONE+ | ✅ EU sandbox | ⬜ pending | No |
| Withings | Health API | ✅ FR | ⬜ pending | No |
| Fitbit / Google | Fitbit Web API | ❌ US | ⬜ pending | ✅ Yes — SCCs required |
| Garmin | Health API | ❌ US | ⬜ pending | ✅ Yes — SCCs required |
| Samsung | Samsung Health | ❌ US | ⬜ pending | ✅ Yes — SCCs required |
| Huawei | Health Kit | ❌ CN | ⬜ BLOCKED | ✅ BLOCKED until EU adequacy |
| Meta | Wellbeing API | ❌ US | ⬜ pending | ✅ Yes — SCCs required |

### Automated decisions
Alert thresholds flag readings for HUMAN physician review only.
No automated clinical decisions. Art. 22 does not apply.

### Cardiac implant platforms (partnership required)
Medtronic MyCareLink, Abbott Merlin.net, BSC Latitude NXT:
Live sync blocked until signed vendor partnership agreements.
Contact: mycarelink-api@medtronic.com, cardiovascular.digital@abbott.com, rpmpartner@bsci.com
```

```
Extend docs/RETENTION.md with wearables section:
| Data                           | Retention     | Basis                          |
|--------------------------------|---------------|--------------------------------|
| device_readings (no consent)   | 0 days        | deleted on withdrawal          |
| device_readings (consented)    | 90 days       | WEARABLES_GDPR_RETENTION_DAYS  |
| device_readings (FHIR synced)  | Indefinite    | Authoritative copy in HIS      |
| device_consent audit rows      | 5 years       | GDPR accountability (Art. 5.2) |
| OAuth tokens (encrypted)       | Until revoked | Technical necessity            |
| Alert SMS content              | 30 days       | Incident investigation         |
```

```
Add consent re-confirmation banner (apps/web/src/app/[lang]/portal/wearables/page.tsx):
  If device.connected_at < now - 12 months AND no consent event in last 12 months:
    Show banner: "Please review your wearable consent settings — last reviewed > 12 months ago."
    Link → /[lang]/portal/wearables/sublas
  If banner not acknowledged within 30 days:
    UPDATE wearable_devices SET sync_status = 'pending' WHERE id = device.id
    Create portal_notification(type='consent_reconfirmation_required')
```

---

## Part F — WCAG 2.1 AA audit

```
Run axe-core on all three wearables pages:
  /[lang]/portal/wearables        — connected devices + readings timeline
  /[lang]/portal/wearables/sublas — consent management (built from consent-management.html)
  /admin/patients/[token]/wearables — physician view

Pre-check list (common issues in this UI):

□ Device cards: "Share with physician" checkbox has visible label + aria-label="[metric] — [device]"
□ Reading timeline: green/amber/red dots have aria-label or role="img" aria-label="Normal reading"
□ Connect panel: platform buttons have full text label (not just 2-letter monogram)
□ Toggle switches (consent page): input has aria-label; track span has aria-hidden="true"
□ Confirm modals: role="dialog" aria-modal="true" aria-labelledby; focus trapped (focus-trap-react)
□ Confirm buttons: aria-describedby pointing to consequence list ID
□ Alert severity badges: not colour-only; include text ("Critical", "High", "Normal")
□ Sparkline SVG: role="img" aria-label="Heart rate trend, 24 readings, range 68–96 bpm"
□ "Withdraw all" button: not solely identified by colour; destructive action described

Fix all critical + serious axe violations. Acceptable: none.
```

---

## Part G — Full E2E test suite (Playwright, all wearables scenarios)

```
WR-1  Patient connects Fitbit:
  Login → Wearables tab → Connect device → Fitness tab → Fitbit →
  OAuth redirect → mock callback → device appears in connected list.

WR-2  Share-with-physician toggle:
  Toggle OFF → API call → physician view loses that device.
  Toggle ON again → device reappears in physician view.

WR-3  Critical glucose alert:
  POST /api/wearables/devices/:id/readings (admin JWT, value: 16.0 mmol/l) →
  wearables.alert.critical consumed → SmsService mock called once →
  alert badge count > 0 in portal header.

WR-4  Consent withdrawal (full flow):
  /sublas → withdraw all consent for Abbott device →
  device removed from list → device_readings soft-deleted →
  device_readings with fhir_observation_id → preserved (not deleted) →
  physician view returns 0 devices for patient.

WR-5  Readings isolation:
  Patient A JWT → GET /api/wearables/devices/[patient-B-device-id]/readings → 403.

WR-6  FHIR Observation export (idempotent):
  Sync produces new reading → consume wearables.readings.synced →
  FHIR sandbox Observation with correct LOINC code exists →
  device_readings.fhir_observation_id populated.
  Re-trigger sync → idempotent (no duplicate Observation in FHIR sandbox).

WR-7  OAuth state CSRF:
  Craft request to /api/wearables/callback/fitbit?code=x&state=forged →
  Response: 400 INVALID_OAUTH_STATE.

WR-8  Physician expired access:
  Physician with appointment 91 days ago →
  GET /api/wearables/physician/:token → 403 PHYSICIAN_ACCESS_DENIED.

WR-9  Consent re-confirmation (12-month):
  Set device.connected_at = 13 months ago → visit /[lang]/portal/wearables →
  Re-confirmation banner visible.
  Ignore for 31 days (mock) → sync_status changes to 'pending'.
```

---

## Part H — Config validator additions

```typescript
// apps/api/src/config/config.schema.ts — add:

WEARABLES_ENABLED: z.boolean().default(false)
WEARABLES_PROVIDER: z.enum(['mock', 'live']).default('mock')
  .refine(v => !(v === 'live' && !WEARABLES_ENABLED),
    { message: 'WEARABLES_PROVIDER=live requires WEARABLES_ENABLED=true' })
WEARABLES_TOKEN_KEY: z.string().regex(/^[0-9a-f]{64}$/i,
    'Must be 64-char hex (32 bytes) for AES-256-GCM')
WEARABLES_OAUTH_REDIRECT_BASE: z.string().url()
WEARABLES_GDPR_RETENTION_DAYS: z.number().int().min(30).max(365).default(90)
WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS: z.number().int().min(1).max(365).default(90)

// Add all to apps/api/.env.example with safe defaults.
// Config validator must reject WEARABLES_PROVIDER=live unless WEARABLES_ENABLED=true.
```

---

## Part I — Launch gate (extend `design_handoff_nemocnica_snina/LAUNCH_CHECKLIST.md §L9`)

```markdown
## L9 — Wearables compliance gate (all required before WEARABLES_ENABLED=true in prod)

### Legal & GDPR
[ ] DPIA_WEARABLES_ADDENDUM.md reviewed and signed by DPO
[ ] RETENTION.md wearables section: DPO sign-off
[ ] DPAs in place with each live platform vendor (Abbott, Dexcom, Withings, Fitbit, Garmin, Samsung)
[ ] SCCs confirmed for Fitbit (Google/US), Garmin (US), Samsung (US)
[ ] Huawei live sync BLOCKED until EU Adequacy Decision or SCCs signed
[ ] Partnership agreements signed: Medtronic, Abbott Cardiac, BSC
    (MyCareLink / Merlin.net / Latitude NXT remain partnership_required=true until signed)

### Security
[ ] axe: zero critical/serious on /[lang]/portal/wearables, /sublas, /admin/.../wearables
[ ] OAuth CSRF: forged state → 400 (WR-7 green)
[ ] Readings isolation: Patient A cannot read Patient B's data (WR-5 green)
[ ] Token rotation: expired token triggers refresh; failure creates portal notification (no SMS)
[ ] Webhook signature validation: Garmin + all webhook platforms (integration test green)
[ ] Physician scope: expired relationship → 403 (WR-8 green)

### Testing
[ ] WR-1 through WR-9 green in CI (all branches)
[ ] All unit tests green (alert.service, his-sync.consumer, wearables.controller)

### iOS companion app (Apple Health dependency)
[ ] Apple Health adapter returns IOS_APP_REQUIRED until app is published
[ ] iOS app published on App Store before Apple Health live sync enabled
[ ] APPLE_HEALTH_BUNDLE_ID + APPLE_TEAM_ID set in production .env

### Final config
[ ] WEARABLES_ENABLED=true set in production .env
[ ] WEARABLES_PROVIDER=live set in production .env
[ ] WEARABLES_TOKEN_KEY: 64-char hex, rotated from dev key, stored in vault
[ ] WEARABLES_OAUTH_REDIRECT_BASE: production domain
```

---

## Done when

- [ ] OAuth token rotation tested (expired token → refreshed; failure → portal notification)
- [ ] CSRF: forged state → 400; reused state → 400; expired state → 400 (WR-7 green)
- [ ] Webhook signature: tampered Garmin payload → 401
- [ ] Readings isolation: cross-patient read → 403 (WR-5 green)
- [ ] Physician expired access → 403 (WR-8 green)
- [ ] `DPIA_WEARABLES_ADDENDUM.md` created with all vendor/SCC/retention info
- [ ] `RETENTION.md` updated with wearables table
- [ ] `LAUNCH_CHECKLIST.md §L9` updated with full gate checklist
- [ ] Consent re-confirmation banner shown after 12 months; sync suspended after 30-day grace
- [ ] axe: zero critical/serious on all 3 wearables pages
- [ ] WR-1 through WR-9 green in CI
- [ ] Config validator rejects `WEARABLES_PROVIDER=live` without `WEARABLES_ENABLED=true`
