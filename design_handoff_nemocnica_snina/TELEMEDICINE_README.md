# Handoff: Nemocnica Snina — Telemedicine & Telehealth Module

## Overview
This package extends the Nemocnica Snina platform with **telemedicine and telehealth services**: secure video consultations between patients and physicians, a pre-consultation intake flow, post-consultation summary and e-prescription handoff, and a physician scheduling console. It integrates directly into the existing booking wizard, patient portal, admin CMS, and HIS queue.

> **Read the base handoff first.** This module is additive — it does not replace any existing feature. All design tokens, components, conventions, and compliance requirements from `README.md`, `PRODUCTION_ARCHITECTURE.md`, `DATA_MODEL.md`, and `CLAUDE.md` apply in full. This document covers only the delta.

## Prototype files
| File | What it shows |
|---|---|
| `telehealth.html` | Public-facing telehealth landing page (how it works, eligible clinics, requirements, CTA) |
| `teleconsult.html` | Video consultation room — 3 states (waiting room / active call / post-call) × 2 views (patient / physician); prototype state bar at top |

The room is a standalone full-page UI (no site header/footer). It loads `assets/data.js` and `assets/site.js` for helpers only.

---

## Information architecture — new routes
| Prototype file | Purpose | Production route |
|---|---|---|
| `telehealth.html` | Telehealth public landing | `/[lang]/telehealth` |
| `teleconsult.html` | Video consultation room | `/[lang]/telehealth/konzultacia/[sessionId]` |
| *(booking wizard extension)* | "Video consultation" appointment type in objednanie | `/[lang]/objednanie?mode=telehealth` |
| *(portal extension)* | Scheduled teleconsults tab in patient portal | `/[lang]/portal` (existing) → new "Teleconsultations" nav item |
| *(admin extension)* | Telehealth clinic config + physician availability | `/admin` (existing) → new "Telehealth" section |

---

## Screen specs

### Public landing (`telehealth.html`)
- **Page hero** (2-col grid, 1.15fr / .85fr): left = eyebrow "Telezdravotníctvo" (terra), H1, lede, two CTAs ("Join consultation" primary + "Book telehealth appointment" ghost); right = decorative dark video-room mockup (dark card, `--blue-900`, two mock video tiles + controls bar).
- **How it works** (`--bg-2` band): eyebrow + H2 + 3-step horizontal grid (number in Newsreader `--blue-200`, icon tile `--blue-50`, step title H3, body muted). Steps: 01 Book online / 02 Complete intake form / 03 Consult.
- **Eligible clinics** (`.grid.grid-2`): filtered from `DB.list("clinics")` by `telehealth:true`. Each card = video icon tile + specialty eyebrow + clinic name + rule text + "Video consultation" chip (`--blue-50`/`--blue-700`) + optional referral chip + "Book" CTA.
- **Requirements** (2×2 grid on `--bg-2`): Device / Connection / eID verification / Eligible conditions. Each item = icon tile + title H4 + body.
- **Legal note**: amber left-border callout — "does not replace emergency services; call 112; recorded in medical record per GDPR / Act 18/2018."
- **CTA band** (`.band-blue`): "Ready to start?" + "Patient portal" (primary) + "Book appointment" (ghost).

### Video consultation room (`teleconsult.html`)
**Shell**: full-page dark UI (`#0d1f35`), no site nav. Three layers:
1. **Top bar** — hospital mark + "Nemocnica Snina · Telezdravotníctvo", session label, status dot (amber pulsing = waiting; green = active; gray = ended), elapsed timer.
2. **Stage** — video tiles + state overlays + optional doctor side panel.
3. **Controls bar** — 5 controls: Mic (toggleable), Camera (toggleable), Share screen, Messages, End call (red).

**States** (controlled by `data-state` on `.room`):
| State | Stage shows | Controls |
|---|---|---|
| `waiting` | Waiting overlay (physician avatar, pulsing dots, appointment card); video tiles dimmed | Disabled (pointer-events:none) |
| `active` | Main tile (physician) + PiP (self); overlays hidden | Fully active |
| `postcall` | Post-call overlay (check icon, summary items, action buttons); video tiles dimmed | Disabled |

**Views** (controlled by `data-view` on `.room`):
| View | Main tile | PiP | Side panel |
|---|---|---|---|
| `patient` | Physician | Self | Hidden |
| `doctor` | Patient | Self | Visible — intake summary, actions |

**Doctor side panel** (260px, dark overlay, right edge): patient identity card (name, RČ, insurer), intake questionnaire answers (reason, medications, symptoms, last BP), "Issue e-prescription" + "Suggest follow-up" buttons.

**Post-call overlay**: white card, green check icon, consultation summary items (clinical note badge, e-prescription badge, follow-up badge). Patient view → "View in portal" + "Book follow-up"; Physician view → "Back to schedule".

---

## Interactions & behavior
- **Booking wizard extension**: on `objednanie.html?mode=telehealth` (or `?clinic=X&mode=telehealth`), Step 1 shows only telehealth-capable clinics; Step 3 shows time slots labeled "Video"; Step 4 adds a camera/mic check callout and a telehealth-specific GDPR consent clause (video in medical record, no third-party recording).
- **Portal extension**: a "Teleconsultations" section lists upcoming video appointments with a "Join" button (active 10 min before the scheduled start). Past teleconsults show a "View summary" action.
- **Room join flow**: eID identity confirmation on load → pre-call device check (camera/mic permissions) → waiting room → physician admits patient → active call.
- **Timer**: counted from `th_start` in `sessionStorage`; persists across refreshes so a reload doesn't lose the running clock.
- **State persistence**: `th_room_state` in `sessionStorage` — refreshing the room page restores the last state.
- **Admin config**: a "Telehealth" section in the CMS admin lets the operator toggle `telehealth:bool` per clinic and `telehealth:bool` per physician, and set `telehealthWindow` (e.g. "Mon–Fri 09:00–12:00").

---

## Component extensions (additions to `assets/styles.css`)
The room UI uses its own inline `<style>` block (`teleconsult.html`). No changes to the shared design system are needed for the prototype; in production, add to `packages/ui`:
- `.video-tile` — dark tile with avatar fallback
- `.ctrl-btn` — circular control button with off-state (`.ctrl-off`) and end-call variant (`.ctrl-end`)
- `.room-bar`, `.room-stage`, `.room-controls` — room shell layout
- `.waiting-card`, `.postcall-card` — overlay card variants
- `.side-panel-inner` — physician intake summary panel

New icon tokens added in `teleconsult.html` script: `video`, `video-off`, `mic`, `mic-off`, `phone-off`, `message-square`, `share-2`, `wifi`, `monitor`, `clipboard`. Add these to `ICON` in `assets/site.js` (or `lucide-react` equivalents in production).

---

## Booking wizard — delta spec
**Step 1 (Clinic)**: filter to `telehealth:true` clinics only when `mode=telehealth`. Show "Video consultation available" chip on each clinic card.
**Step 2 (Date)**: same date-generation logic as existing (bookingDays). Label the window with `telehealthWindow` if it differs from the in-person window.
**Step 3 (Time)**: slots labeled "Video" instead of physical room.
**Step 4 (Details)**: add below the standard form:
- Camera/mic check callout (green chip "Your device supports video calls" / amber "Please allow camera access").
- Telehealth GDPR consent checkbox (mandatory, separate from the base GDPR consent): _"Súhlasím so zavedením záznamu z videokonzultácie do mojej zdravotnej dokumentácie v súlade s §18 zákona č. 576/2004 Z. z."_
**Step 5 (Confirm)**: confirmation card includes a "Join consultation" button (active from 10 min before start) linking to `/telehealth/konzultacia/[sessionId]`.

---

## Patient portal — delta spec
Add a **"Teleconsultations"** item to the left portal nav (between "Overview" and "Health records"). Content:
- **Upcoming** tab: cards per scheduled teleconsult — physician name, specialty, date/time, "Join" button (active 10 min before start), "Cancel" link.
- **Past** tab: cards per completed teleconsult — date, physician, duration, "View summary" + "Download summary PDF" (step-up 2FA gated, same as lab-result PDFs).
- Empty states with appropriate messages and a "Book telehealth appointment" CTA.
