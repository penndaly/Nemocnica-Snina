# Claude Design — Transition Prompt
## Paste this as your first message in a new Claude Design chat

---

I'm continuing work on **Nemocnica Snina** (Snina Hospital) — a bilingual (SK/EN) patient portal + public hospital website. The project is already open here. Please read the following files before starting any design work:

1. `portal.html` — patient portal prototype (the main UI reference)
2. `assets/styles.css` — full design system (tokens, components, typography)
3. `assets/data.js` — seed data and content model
4. `assets/wearables-demo-data.js` — wearable device demo data
5. `CLAUDE.md` — project non-negotiables and stack overview

---

## What's already built

### Public site
All pages live at project root: `index.html`, `ambulancie.html`, `oddelenia.html`, `lekari.html`, `sluzby.html`, `diagnostika.html`, `aktuality.html`, `kontakt.html`, `zverejnovanie.html`, `admin.html`, `portal.html`, `teleconsult.html`, `telehealth.html`.

### Patient portal (`portal.html`)
Tabs: Prehľad · Telekonzultácie · Zdravotné záznamy · e-Recepty · Výsledky · **Wearables**

The **Wearables tab** includes:
- Connected devices grid (Abbott FreeStyle Libre 3 / CGM, Apple Watch Series 10, Withings ScanWatch 2)
- Unified recent readings timeline with Normal/High badges
- "Connect a device" panel with Medical and Fitness & Wellness tabs (18 platforms)
- GDPR consent notice linking to consent management page
- Fully bilingual SK/EN

### Wearables design prototypes (all at project root)
| File | What it shows |
|---|---|
| `portal.html` → Wearables tab | Full wearables tab: devices, readings, connect panel |
| `consent-management.html` | GDPR consent management (`/portal/wearables/sublas`): per-device toggles, audit trail, withdraw-all modal, disconnect modal |
| `wearables-connect-alerts.html` | **Connect Device OAuth modal** (7 states: platform grid → permissions → redirecting → success · partnership required · iOS required · manual upload) + **Alert Notifications** (bell badge, dropdown panel, critical banner) |

### Backend sprints (Claude Code, not Claude Design)
- **W1** ✅ committed on `main` (dacc17d) — DB schema, NestJS module, consent engine
- **W2** running — medical device OAuth adapters (Abbott, Dexcom, Withings, Omron; cardiac = partnership stubs)
- **W3** running — consumer adapters (Fitbit, Garmin, Samsung, Google Health; Apple = iOS stub; Xiaomi = manual upload)
- **W4–W6** pending — portal production wiring, alerts, FHIR HIS export, compliance

### Sprint files for Claude Code
All in `wearables-sprints/`:
- `SPRINT_W4_PORTAL_WIRING.md` — demo data removal, API client, portal tab, `/sublas` page, i18n
- `SPRINT_W4C_CONNECT_ALERTS_UI.md` — Connect Device modal + Alert notifications panel (frontend components)
- `SPRINT_W5_ALERTS_PHYSICIAN.md` — alert engine, FHIR export, physician view, threshold editor
- `SPRINT_W6_COMPLIANCE.md` — OAuth hardening, GDPR docs, WCAG AA, WR-1–9 E2E, launch gate

---

## Design system
- **Fonts:** Newsreader (headings, serif) + Mulish (body, UI)
- **Palette:** Medical blue (`--blue-700: #1e5290`) · Warm cream bg (`--bg: #faf6f0`) · Terracotta accent (`--terra: #c06a38`) · Green success · Amber caution · Red emergency
- **Key tokens:** `--radius: 14px` · `--shadow: 0 4px 14px rgba(44,40,32,.08)` · `--line: #e7ddcf`
- **Components:** `.card` / `.card-pad` · `.btn` / `.btn-primary` / `.btn-ghost` · `.badge-green/amber/red/blue/terra/gray` · `.chip` · `.sec-head` · `.eyebrow`
- **i18n:** `L({sk:'…', en:'…'})` helper; language toggle in site header; bilingual on every string

---

## Outstanding design tasks (pick one to start)

- **Physician wearables view** — clinician-facing patient summary: metric cards, 7-day alert timeline, per-device trend sparklines (SVG), threshold editor side panel — needed for Sprint W5
- **Admin wearables config** — CMS/admin page: per-patient device overview, bulk threshold editor, partnership status panel — needed for Sprint W5/W6
- **Partnership required state** — full page/modal for cardiac platforms (Medtronic, Abbott, BSC): status, contact info, "notify me" queue — partially prototyped in `wearables-connect-alerts.html`
- **iOS companion app screens** — SwiftUI-style mobile mockup: HealthKit onboarding, permission request, first-sync confirmation — needed for Sprint W3/W4
- **Wearables onboarding flow** — first-time patient walkthrough: what are wearables, why connect, which device, GDPR consent — portal empty state

---

The design system uses a warm, human community-hospital tone. Match the existing visual vocabulary precisely — cards, badges, chips, status colours, bilingual strings — before adding anything new.
