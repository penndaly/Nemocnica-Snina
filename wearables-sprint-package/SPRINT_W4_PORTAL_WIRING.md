# Sprint W4 — Patient Portal Production Wiring
## Nemocnica Snina · Wearables & Remote Monitoring

**Branch:** `feature/wearables-w4-portal-wiring`  
**Depends on:** W1 ✅ merged · W2 (Withings/Fitbit adapters) · W3 (Google Health adapter)  
**Design prototype:** `consent-management.html` + `portal.html` → Wearables tab  
**UI spec:** Match `portal.html` Wearables tab and `consent-management.html` pixel-for-pixel.

---

## Paste this into Claude Code before starting

```
Read the following files in full before writing any code:

1. portal.html (Wearables tab — lines ~280–390 in the inline script)
2. consent-management.html (W4 design prototype for /portal/wearables/sublas)
3. assets/wearables-demo-data.js (data shapes to replicate from real API)
4. apps/api/src/wearables/wearables.controller.ts (W1 — endpoint signatures)
5. apps/web/src/app/[lang]/portal/ (existing portal structure)
6. design_handoff_nemocnica_snina/TELEMEDICINE_BUILD_GUIDE.md §T1.4
   (portal tab pattern — follow the same structure for Wearables)

Execute Sprint W4 only. Stop and report Done-when criteria before starting W5.
```

---

## Non-negotiables (wearables-specific)

- No patient RC in plaintext; all patient references use opaque `patient_token`.
- Consent row (`device_consent`) must exist before any device data is read.
- `window.NS_WEARABLES_DEMO` must be `undefined` in production build.
- `WEARABLES_ENABLED=false` until W6 compliance gate (config validator enforces).
- Medical device data never touches `localStorage` — API responses only, React state only.

---

## Part A — Remove demo data shim

```
1. git rm assets/wearables-demo-data.js
2. In portal.html: remove <script src="assets/wearables-demo-data.js">
   (portal.html becomes a static design reference after W4 — no further runtime changes needed.)
3. Verify window.NS_WEARABLES_DEMO is undefined in the Next.js production build.
4. Commit: "feat(wearables): remove demo data shim — production API wired (W4)"
```

---

## Part B — API client (`apps/web/src/lib/wearables-api.ts`)

```typescript
// All calls use the patient JWT from next-auth session.
// Mirror shapes from assets/wearables-demo-data.js exactly so components need no changes.

getWearables(): Promise<WearablesResponse>
  → GET /api/wearables
  → { devices: WearableDevice[], available: AvailablePlatform[] }

connectDevice(platform: WearablePlatform): Promise<{ authUrl: string }>
  → POST /api/wearables/connect/:platform

disconnectDevice(deviceId: string): Promise<void>
  → DELETE /api/wearables/devices/:deviceId
  (triggers consent withdrawal + token revocation server-side)

getReadings(deviceId: string, from?: Date): Promise<DeviceReading[]>
  → GET /api/wearables/devices/:deviceId/readings

syncDevice(deviceId: string): Promise<{ jobId: string }>
  → POST /api/wearables/devices/:deviceId/sync

updateConsent(deviceId: string, payload: ConsentUpdatePayload): Promise<ConsentDto>
  → PUT /api/wearables/devices/:deviceId/consent
  → body: { type: 'physician_sharing' | 'his_export', granted: boolean }
  (data_storage consent can only be withdrawn via disconnectDevice)

getConsents(deviceId: string): Promise<ConsentDto[]>
  → GET /api/wearables/devices/:deviceId/consents

getConsentAuditLog(deviceId?: string): Promise<ConsentAuditEntry[]>
  → GET /api/wearables/consents/audit?deviceId=:deviceId
  → sorted by ts DESC; max 200 rows
```

---

## Part C — Portal Wearables tab (`apps/web/src/app/[lang]/portal/wearables/page.tsx`)

```
SSR: getWearables() called server-side (patient session required; redirect /[lang]/login if absent).
Refresh: SWR polling every 60 s for last_sync_at updates only; full refetch on manual sync.

Three sections — match portal.html Wearables tab exactly:

1. Connected devices grid (3-col → 2-col → 1-col):
   WearableDeviceCard per device:
   ┌─────────────────────────────────────────────────────────────┐
   │ [icon] Brand  Model               ● Active  [Medical badge] │
   │ ─────────────────────────────────────────────────────────── │
   │ Metric A label          7.2 mmol/l                          │
   │ Metric B label          72 bpm                              │
   │ ─────────────────────────────────────────────────────────── │
   │ ↺ synced 5 min ago   [✓ Share with physician]               │
   └─────────────────────────────────────────────────────────────┘
   - "Share with physician" checkbox → optimistic update → updateConsent(id, {type:'physician_sharing', granted})
   - "Sync now" button → syncDevice(id) → poll device_sync_jobs/jobId until status='completed' (max 30 s, 2 s interval)
   - partnership_required=true → badge "Agreement required" + disable sync; onClick shows contact modal
   - sync_status='error' → amber badge + last error tooltip

2. Recent readings timeline (unified, all devices, DESC):
   ReadingTimelineRow: time-ago | dot (green/amber/red) | metric | value+unit | device chip | flag badge
   - dot colour: normal=green, high/low=amber, critical=red
   - fhir_observation_id set → "In HIS" chip (blue, small)
   - Show last 20 readings; "Load more" button appends 20 more

3. Connect a device panel (collapsible, default closed):
   Medical tab | Fitness & Wellness tab — match portal.html wr-avail-grid
   PlatformCard per available platform (brand, model, 2-letter monogram):
   - Normal → onClick calls connectDevice(platform) → window.location.href = authUrl
   - partnership_required → "Agreement required" badge; onClick shows PartnershipModal
     (contact email, status note, not an OAuth redirect)
   - manual_upload_only (AliveCor, Xiaomi) → "Upload data" button → UploadModal
     → multipart POST /api/wearables/:platform/upload (PDF for AliveCor, .zip for Xiaomi)
     → progress bar + success/error states

4. GDPR consent notice (always visible, bottom of tab):
   "Wearable integration is fully optional. Data shared exclusively with your treating physician.
   Withdraw consent at any time."
   Link → /[lang]/portal/wearables/sublas (consent management page)
```

---

## Part D — Consent management page (`apps/web/src/app/[lang]/portal/wearables/sublas/page.tsx`)

```
Implement the full design from consent-management.html.
SSR: load all device_consent rows for the patient; redirect to login if no session.

Sections:
1. Page header with breadcrumb (Portal > Wearables > Consent management)
2. GDPR rights banner (dismissible; state in sessionStorage 'ns_gdpr_banner')
3. Per-device consent card (one card per connected device):
   - Device header: icon + brand + model + Active badge + Medical badge (if category=medical)
   - Three consent rows (data_storage, physician_sharing, his_export):
     - data_storage: always-on badge ("Active") — withdraw only via Disconnect button
     - physician_sharing + his_export: toggle → optimistic update → updateConsent()
       → aria-live="polite" feedback on change ("Consent updated")
     - Each row shows: granted date/time if granted, "Not active" if not
   - "Disconnect device" button → ConfirmDisconnectModal (design: cm-overlay in consent-management.html)
     → disconnectDevice(id) → device removed from list → audit entry added
4. Consent audit trail table:
   Columns: Date & time | Device | Consent type | Action | IP (hash)
   - action="granted" → green badge; action="withdrawn" → amber badge
   - "Audit trail is immutable — append-only (GDPR Art. 5(2))" footer note
5. "Withdraw all consent" CTA (top-right + bottom of page):
   → WithdrawAllModal (design: cm-overlay in consent-management.html)
   → reason dropdown (optional) → withdraws all non-required consents for all devices
   → audit entries written for each withdrawal

Accessibility:
- All toggles: aria-label="[Consent type] — [Brand] [Model]"
- Modal: role="dialog" aria-modal="true" aria-labelledby; focus trapped on open; Esc closes
- Confirm buttons: aria-describedby pointing to consequence list
```

---

## Part E — Navigation

```
apps/web/src/app/[lang]/portal/layout.tsx:
  Add "Wearables" to sidebar nav between "Lab results" and any future items.
  Show device count badge: <Badge>{connectedDevices.length}</Badge> if > 0.
  Use watch icon (lucide-react: Watch).

Portal breadcrumb in sublas page: use existing breadcrumb component; add third level.
```

---

## Part F — i18n strings (`apps/web/src/messages/sk.json` + `en.json`)

```json
"wearables": {
  "title": { "sk": "Nositeľné zariadenia", "en": "Wearables & Devices" },
  "optional": { "sk": "Voliteľné", "en": "Optional" },
  "connectDevice": { "sk": "Pripojiť zariadenie", "en": "Connect device" },
  "shareWithPhysician": { "sk": "Zdieľať s lekárom", "en": "Share with physician" },
  "recentReadings": { "sk": "Posledné merania", "en": "Recent readings" },
  "syncNow": { "sk": "Synchronizovať", "en": "Sync now" },
  "inHis": { "sk": "V zdravotnom zázname", "en": "In health record" },
  "medicalTab": { "sk": "Medicínske", "en": "Medical" },
  "fitnessTab": { "sk": "Fitness & Wellness", "en": "Fitness & Wellness" },
  "privacyNotice": { "sk": "Správa súhlasov", "en": "Manage consent" },
  "partnershipRequired": { "sk": "Vyžaduje sa dohoda", "en": "Agreement required" },
  "consent": {
    "title": { "sk": "Správa súhlasov GDPR", "en": "GDPR Consent management" },
    "storeReadings": { "sk": "Ukladanie meraní", "en": "Store readings" },
    "shareWithPhysician": { "sk": "Zdieľanie s lekárom", "en": "Share with physician" },
    "hisExport": { "sk": "Export do FHIR záznamu", "en": "Export to FHIR record" },
    "withdrawAll": { "sk": "Odvolať všetky súhlasy", "en": "Withdraw all consent" },
    "disconnect": { "sk": "Odpojiť zariadenie", "en": "Disconnect device" },
    "auditTrail": { "sk": "Auditný záznam súhlasov", "en": "Consent audit trail" },
    "granted": { "sk": "Udelené", "en": "Granted" },
    "withdrawn": { "sk": "Odvolané", "en": "Withdrawn" }
  }
}
```
Machine-translate cs/pl/hu/uk — mark clinical/consent strings for human review.

---

## Part G — E2E tests (Playwright)

```
WR-W4-1  Wearables tab renders with 3 connected devices (mock API, WEARABLES_PROVIDER=mock).
WR-W4-2  "Share with physician" toggle: optimistic update visible → API call → refreshed from server.
WR-W4-3  "Connect device" → Fitbit → redirected to mock authUrl → callback → device appears.
WR-W4-4  partnership_required platform (Medtronic) → shows "Agreement required" modal, no OAuth redirect.
WR-W4-5  Consent management (/sublas): withdraw physician_sharing for Apple Watch →
          audit row added → toggle now unchecked → physician view loses that device.
WR-W4-6  Disconnect device → ConfirmModal → confirmed → device removed → audit entries written.
WR-W4-7  axe: zero critical/serious on /[lang]/portal/wearables and /sublas.
```

---

## Done when

- [ ] `window.NS_WEARABLES_DEMO` is `undefined` in production build
- [ ] Wearables tab renders connected devices from live API (mock provider)
- [ ] Connect Device OAuth redirect works for Fitbit + Withings sandbox
- [ ] `updateConsent()` persists to `device_consent` table; audit_log written
- [ ] Consent management page matches `consent-management.html` design
- [ ] Withdraw-all disconnects all devices + revokes tokens + writes audit
- [ ] Disconnect device removes from list + fires `revokeToken()`
- [ ] i18n strings present for SK + EN on all new components
- [ ] WR-W4-1 through WR-W4-7 green
- [ ] axe: zero critical/serious on wearables + sublas pages
