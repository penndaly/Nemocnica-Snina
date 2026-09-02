# Wearables Sprint Package — Nemocnica Snina
## Design prototype + Claude Code sprint prompts for W4–W6

---

## Contents

| File | Purpose |
|---|---|
| `SPRINT_W4_PORTAL_WIRING.md` | Production Next.js portal tab + consent management page |
| `SPRINT_W5_ALERTS_PHYSICIAN.md` | Alert engine · FHIR export · Physician view |
| `SPRINT_W6_COMPLIANCE.md` | Security hardening · GDPR docs · WCAG AA · Launch gate |

Design prototype files (in the project root):

| File | Purpose |
|---|---|
| `consent-management.html` | W4 UI reference — `/portal/wearables/sublas` |
| `portal.html` | Full portal prototype — Wearables tab at bottom of nav |

---

## Sprint sequence

```
W1 ✅ committed on main (f6b03a2)
   └─ feature/wearables-w2-medical-adapters  ─┐ (parallel)
   └─ feature/wearables-w3-consumer-adapters ─┤
                                              │
              W4 (portal wiring) ◄────────────┘  merge W2 first, then W3
                   │                              (conflict in wearables.module.ts — expected)
              W5 (alerts + physician)
                   │
              W6 (compliance gate) → WEARABLES_ENABLED=true in prod
```

## How to use each sprint file

Paste the contents of the `## Paste this into Claude Code before starting` block
at the top of each sprint file into a new Claude Code chat. That block tells
Claude Code exactly which files to read, then lists all tasks in order.

Each sprint ends with a **Done when** checklist. Review that checklist before
merging the branch and starting the next sprint.

---

## Key design decisions captured in prototypes

### `consent-management.html`

Implements the GDPR consent management page (`/portal/wearables/sublas`) with:
- **Three consent types per device:** `data_storage` (required, locked) · `physician_sharing` (toggle) · `his_export` (toggle)
- **Consent toggle colour coding:** data_storage = blue · physician_sharing = green · his_export = terracotta
- **Withdraw all** — confirmation modal with consequence list + optional reason dropdown
- **Disconnect device** — separate modal; triggers token revocation + soft-delete of unexported readings
- **Audit trail** — append-only table (GDPR Art. 5(2)); badge: green=granted, amber=withdrawn
- **GDPR rights banner** — dismissible; cites Art. 7 · 17 · 21
- **Fully bilingual** SK/EN; matches portal.html visual vocabulary exactly

### `portal.html` Wearables tab

Reference for connected devices grid, readings timeline, connect-device panel,
and privacy notice linking to the consent management page.

---

## Non-negotiables (shared across all sprints)

- No patient RC in plaintext; always use opaque `patient_token`.
- No medical device data in `localStorage` — API responses only.
- Consent `device_consent` row required before any device data is read.
- `FHIR device_readings` with `fhir_observation_id` are never deleted.
- Cardiac implant platforms (Medtronic / Abbott / BSC) remain `partnership_required=true` until vendor agreements are signed.
- `WEARABLES_ENABLED=false` in production until W6 compliance gate passes.
- EU hosting only (GDPR · Decree 179/2020). Huawei blocked until adequacy decision.
- axe: zero critical/serious violations on all wearables pages before launch.

---

## W2 + W3 merge note

Both branches add adapter registrations to `wearables.module.ts`. Merge W2 first
into W4's base, then W3. The conflict is predictable and mechanical:

```typescript
// W2 adds:
MedicalAdaptersModule,

// W3 adds:
ConsumerAdaptersModule,

// Merged:
MedicalAdaptersModule,
ConsumerAdaptersModule,
```
