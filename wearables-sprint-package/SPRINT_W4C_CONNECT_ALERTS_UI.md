# Sprint W4c — Connect Device OAuth Flow & Alert Notifications UI
## Nemocnica Snina · Wearables & Remote Monitoring

**Branch:** `feature/wearables-w4-portal-wiring` (add to W4, alongside portal tab work)
**Design prototype:** `wearables-connect-alerts.html` — run this file and interact with it before writing any code.
**Scope:** Frontend-only. Backend endpoints (W4 API client, W5 alert engine) are defined in SPRINT_W4_PORTAL_WIRING.md and SPRINT_W5_ALERTS_PHYSICIAN.md. This sprint wires the UI components to those endpoints.

---

## Paste this into Claude Code before starting

```
Read the following files in full before writing any code:

1. wearables-connect-alerts.html — interactive prototype; every component, state,
   and transition is implemented here. Match it pixel-for-pixel.
2. consent-management.html — the /sublas consent page (already spec'd in W4 portal wiring).
3. portal.html — base portal vocabulary (cards, badges, nav, colour tokens).
4. assets/styles.css — full design token set.
5. apps/web/src/app/[lang]/portal/wearables/page.tsx (W4 portal tab, if already built).
6. apps/web/src/lib/wearables-api.ts (W4 API client, if already built).

Execute this sprint only. Stop and report Done-when criteria before continuing.
```

---

## Non-negotiables

- All modal states match the prototype exactly (step dots, colours, copy, icons).
- Partnership-required platforms NEVER initiate an OAuth redirect — they show the partnership state only.
- Apple Health NEVER initiates an OAuth redirect — iOS state only.
- Alert badge count = unread `portal_notifications` where `type='wearable_alert'` AND `read_at IS NULL`.
- Critical alerts (severity='critical') shown with red styling; high with amber — never colour-only (always include text label too, for WCAG).
- Modal focus trap: Escape key closes; focus returns to "Connect device" trigger button on close.

---

## Part A — Connect Device modal (`ConnectDeviceModal.tsx`)

```
Location: apps/web/src/components/wearables/ConnectDeviceModal.tsx

Props:
  open: boolean
  onClose: () => void
  availablePlatforms: AvailablePlatform[]   ← from GET /api/wearables response

State machine — match wearables-connect-alerts.html exactly:

  'platforms'   → platform grid (Medical / Fitness tabs)
  'perms'       → permissions review for selected platform
  'redirecting' → spinner; call connectDevice(platform) → get authUrl → window.location.href = authUrl
                  (prototype simulates 2s delay; production fires immediately)
  'success'     → shown after OAuth callback redirect back to /portal/wearables?connected=:platform
                  (detect via URL param on mount; show success step automatically)
  'partnership' → for platforms where partnership_required = true
  'ios'         → for Apple HealthKit (platform.id = 'apple_health')
  'upload'      → for AliveCor (manual PDF) and Xiaomi (manual .zip)
                  → upload modal calls POST /api/wearables/:platform/upload (multipart)

Step indicator (steps 1–4 with progress line):
  Platforms=1, Perms=2, Redirecting=3, Success=4
  partnership / ios / upload: no step dots (terminal special states)
  Completed steps show check icon; active step filled blue; future steps empty.

Platform grid (step 1):
  Medical tab | Fitness & Wellness tab
  3-column grid of PlatformCard:
    2-letter monogram (brand.slice(0,2).toUpperCase()) + brand + model + status badge
    Badges: "Dohoda/Agreement" (amber) | "iOS" (blue) | upload icon (neutral) | "Pripojené/Connected" (green)
    partnership_required → onClick shows 'partnership' step
    ios → onClick shows 'ios' step
    manual_upload → onClick shows 'upload' step
    connected → onClick closes modal (device already connected)
    normal → onClick advances to 'perms' step

Permissions (step 2):
  Large platform logo (52px monogram, blue bg)
  "Authorize [Platform]?" heading
  Scope list — one row per data type: check icon + bilingual label + LOINC code (muted)
  GDPR privacy line: lock icon + "Encrypted in transit · AES-256-GCM · EU servers · Physician only"
  Two buttons: "Späť/Back" (ghost) | "Autorizovať v [Platform]/Authorize in [Platform]" (primary)

Redirecting (step 3):
  Spinner (CSS animation, blue) + "Presmerovanie na [Platform]…/Opening [Platform] authorization…"
  Calls connectDevice(platform) → redirects to authUrl immediately
  Prototype shows 2s delay for demo purposes only

Success (step 4):
  Animated green check circle (scale-in keyframe from prototype CSS)
  "[Platform] pripojené!/[Platform] connected!"
  "Prvá synchronizácia prebieha…/First sync in progress…"
  "Zobraziť zariadenie/View device" button → closes modal → scrolls to new device card

Partnership state:
  Amber lock icon + heading + explanation paragraph
  Vendor contact email (from platform metadata, see SPRINT_W2 for contact list)
  "Späť/Back" (ghost) + "Upozorniť ma/Notify me" (primary, one-shot disable on click)
  Notify: POST /api/wearables/partnership-notify { platform } → 202 (no-op in dev)

iOS state:
  Blue phone icon + heading + explanation
  3-step numbered list (download → sign in → authorise HealthKit)
  App Store badge placeholder (ph div) with data-label="App Store badge"
  "Späť/Back" button

Upload state:
  Upload icon + heading + instruction (platform-specific: .zip for Xiaomi, PDF for AliveCor)
  Drag-and-drop zone: dashed border, hover state (blue bg), file icon + text + "Browse" button
  On file select: show progress bar → POST /api/wearables/:platform/upload →
    success: toast "Import dokončený/Import complete" + close modal
    error: inline error message in drop zone
  "Späť/Back" button

Accessibility:
  role="dialog" aria-modal="true" aria-labelledby="connectModalTitle"
  Focus trap (focus-trap-react or equivalent)
  Escape → onClose(); focus returns to trigger button
  Step dots: aria-label="Step N of 4" aria-current="step" on active dot
```

---

## Part B — Alert notifications panel (`AlertPanel.tsx` + `AlertBell.tsx`)

```
Location: apps/web/src/components/wearables/AlertBell.tsx
          apps/web/src/components/wearables/AlertPanel.tsx

AlertBell:
  Bell icon button (lucide-react: Bell, 19px)
  Red badge: unread count (hidden when 0)
  Positioned in portal-header card, to the left of the logout button
  onClick → toggles AlertPanel open/closed
  aria-label="Upozornenia (N neprečítaných)/Alerts (N unread)"

AlertPanel (dropdown off bell, 360px wide):
  position: absolute; top: calc(100% + 10px); right: 0
  Header row: "Upozornenia/Alert notifications" + "Označiť všetky/Mark all read" button
    Mark all read → PATCH /api/notifications/read-all?type=wearable_alert
  Alert list (max-height: 280px, overflow-y: auto):
    AlertRow per notification, sorted severity DESC then created_at DESC:
      Severity dot (9px circle): critical=red with red-50 ring, high=amber with amber-50 ring
      Severity label pill: "KRITICKÉ/CRITICAL" (red-50 bg) or "ZVÝŠENÉ/HIGH" (amber-50 bg)
      Metric name + value + unit
      Device name · time-ago (relative)
      Read rows: opacity .6, no background tint
  Footer: "Zobraziť všetky merania/View all readings →" link → /[lang]/portal/wearables
  Close on outside click (useOnClickOutside hook)
  Close on Escape key
  aria-live="polite" on panel for screen reader announcement on open

SWR polling: refetch unread count every 60s (GET /api/notifications/unread-count?type=wearable_alert)

Critical alert banner (in WearablesPage, above device grid):
  Shown when any notification has severity='critical' AND read_at IS NULL in last 24h
  Red full-width banner card:
    Alert triangle icon + "Kritické upozornenie/Critical alert" label (bold)
    · Device name · Metric + value + unit (bold) · time-ago
    "Zobraziť merania/View readings" button (white ghost, right side) → scrolls to timeline
  Dismiss: clicking "View readings" marks that specific notification read
    → PATCH /api/notifications/:id/read

Also add wearable alert badge to "Wearables" sidebar nav item:
  <Badge variant="critical">{unreadCount}</Badge> when unreadCount > 0
  Same unread count from SWR hook above (shared state, not two fetches)
```

---

## Part C — i18n additions

```json
"wearables": {
  "connectModal": {
    "title":        { "sk": "Pripojiť zariadenie",           "en": "Connect a device" },
    "medicalTab":   { "sk": "Medicínske",                    "en": "Medical" },
    "fitnessTab":   { "sk": "Fitness & Wellness",            "en": "Fitness & Wellness" },
    "authorizeIn":  { "sk": "Autorizovať v {{platform}}",    "en": "Authorize in {{platform}}" },
    "redirecting":  { "sk": "Presmerovanie na {{platform}}…","en": "Opening {{platform}} authorization…" },
    "connected":    { "sk": "{{platform}} pripojené!",       "en": "{{platform}} connected!" },
    "syncStarting": { "sk": "Prvá synchronizácia prebieha…", "en": "First sync in progress…" },
    "viewDevice":   { "sk": "Zobraziť zariadenie",           "en": "View device" },
    "partnership":  { "sk": "Vyžaduje sa partnerská dohoda", "en": "Partnership agreement required" },
    "notifyMe":     { "sk": "Upozorniť ma pri dostupnosti",  "en": "Notify me when available" },
    "iosRequired":  { "sk": "Vyžaduje sa iOS aplikácia",     "en": "iOS companion app required" },
    "manualUpload": { "sk": "Manuálny import dát",           "en": "Manual data import" },
    "browseFile":   { "sk": "Vybrať súbor",                  "en": "Browse" },
    "dragFile":     { "sk": "Presuňte súbor sem",            "en": "Drag file here" }
  },
  "alerts": {
    "panelTitle":   { "sk": "Upozornenia",                   "en": "Alert notifications" },
    "markAllRead":  { "sk": "Označiť všetky",                "en": "Mark all read" },
    "viewAll":      { "sk": "Zobraziť všetky merania",       "en": "View all readings" },
    "critical":     { "sk": "KRITICKÉ",                      "en": "CRITICAL" },
    "high":         { "sk": "ZVÝŠENÉ",                       "en": "HIGH" },
    "criticalBanner":{ "sk": "Kritické upozornenie",         "en": "Critical alert" },
    "viewReadings": { "sk": "Zobraziť merania",              "en": "View readings" }
  }
}
```

---

## Part D — Tests (Playwright)

```
WR-C1  Open Connect modal → Medical tab shows 9 platforms; Fitness tab shows 9 platforms.
WR-C2  Click Fitbit → permissions step shown with Fitbit scopes →
        "Authorize" → redirecting state → mock callback → success state → modal close.
WR-C3  Click Medtronic MyCareLink → partnership state (no OAuth redirect fired).
WR-C4  Click Apple Watch → iOS state (no OAuth redirect fired).
WR-C5  Click AliveCor → upload state → drop .pdf file →
        POST /api/wearables/alivecor/upload called → success toast shown.
WR-C6  Escape key closes modal; focus returns to "Connect device" button.
WR-C7  axe on open modal: zero critical/serious violations.

WR-A1  Bell badge shows unread count from API (mock: 3 unread).
WR-A2  Click bell → panel open; click outside → panel closes.
WR-A3  "Mark all read" → PATCH called → badge count becomes 0.
WR-A4  Critical alert present → red banner visible above device grid.
WR-A5  Click "View readings" on banner → notification marked read → banner hidden.
WR-A6  SWR polling: inject new critical notification via API → badge updates within 65s.
WR-A7  axe on open panel: zero critical/serious violations.
```

---

## Done when

- [ ] ConnectDeviceModal renders all 7 states matching wearables-connect-alerts.html
- [ ] Partnership + iOS states never fire OAuth redirect
- [ ] Upload state posts to correct endpoint; shows progress + success toast
- [ ] Success state shown on return from OAuth callback (URL param detection)
- [ ] AlertBell shows correct unread count from API; SWR polls every 60s
- [ ] AlertPanel opens/closes correctly; mark-all-read fires API call
- [ ] Critical banner visible when severity='critical' unread alert exists
- [ ] Banner dismisses on "View readings" click; notification marked read
- [ ] i18n strings present for SK + EN
- [ ] WR-C1 through WR-C7 and WR-A1 through WR-A7 green
- [ ] axe: zero critical/serious on modal and panel
