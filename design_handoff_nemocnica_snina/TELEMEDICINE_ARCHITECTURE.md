# Telemedicine Architecture — Nemocnica Snina

Extends `PRODUCTION_ARCHITECTURE.md`. Read that document first — all stack decisions, compliance requirements, and integration patterns apply in full. This document covers only the telemedicine-specific additions.

---

## Video infrastructure

### Recommended provider: LiveKit (self-hosted, EU)
| Decision | Rationale |
|---|---|
| **LiveKit** (open-source WebRTC SFU) | Self-hostable within the existing EU cloud region; no media leaves our EU boundary (Decree 179/2020); open protocol; EU SaaS option available (`livekit.io/cloud`, EU region). |
| EU data residency | Video streams are routed through the SFU in the same EU region as the rest of the platform. No media transits third-country infrastructure without a DPA/SCC in place. |
| No recording by default | `TELEHEALTH_RECORDING_ENABLED=false` at startup. Recording requires explicit DPO sign-off and a separate consent flow; the config validator must reject `RECORDING_ENABLED=true` without `RECORDING_DPO_APPROVED=true`. |
| Fallback | If LiveKit is unavailable: show a "video service temporarily unavailable" message in the waiting room with the clinic phone number. Never silently drop the patient — always surface a recovery path. |

**Alternative**: Daily.co (EU region), Whereby Embedded, or Twilio Video (EU data residency with a Data Processing Agreement). The architecture is provider-agnostic: the API layer issues short-lived provider-specific JWT tokens; swapping providers requires only a new token adapter.

**TURN server geography (GDPR Art. 46):** WebRTC falls back to TURN relay when direct peer-to-peer fails (common on hospital networks). If TURN servers are outside the EU, health-related audio/video transits non-EU infrastructure. Set `LIVEKIT_TURN_REGION=eu` (or the equivalent LiveKit node selector) to restrict ICE candidates to EU-resident TURN servers. The config validator must assert this in production. For livekit.io cloud, confirm EU-only TURN in the DPA. Add TURN geography verification to the L6 pen-test scope.

**Data Processing Agreement (GDPR Art. 28):** LiveKit (cloud option) and the PDF generation service are data processors handling special-category health data. A signed DPA is required before go-live. If LiveKit's parent company processes data in the US, Standard Contractual Clauses (SCCs) are additionally required. Self-hosted LiveKit has no external DPA requirement but must appear in the internal data processing register.

### WebRTC signaling flow
```
Patient browser                     API (NestJS)                    LiveKit SFU (EU)
     |                                   |                                |
     |-- GET /telehealth/join/:id ------->|                                |
     |                                   |-- verify eID session           |
     |                                   |-- check session.status         |
     |                                   |-- issue patient_join_token     |
     |<-- { token, roomId, wsUrl } ------|                                |
     |                                   |                                |
     |-- LiveKit SDK connect(wsUrl, token)-------------------------------->|
     |<---------------------------------------------- WebRTC established--|
     |                                   |                                |
Physician browser                        |                                |
     |-- GET /telehealth/join/:id?role=physician --|                       |
     |                                   |-- verify staff session + MFA  |
     |                                   |-- issue physician_join_token   |
     |<-- { token, roomId, wsUrl } ------|                                |
     |-- LiveKit SDK connect ------------------------------------------>|
     |<---------------------------------------------- WebRTC established--|
```

**Session state transitions** (server-side, enforced by the API):
```
scheduled → waiting (patient joins waiting room)
waiting   → active  (physician admits patient; API emits room.admit event)
active    → ended   (either party ends call, or session TTL expires)
scheduled → no_show (patient never joined within +15 min grace period)
any       → cancelled (via booking cancellation flow)
```

### Token issuance rules
- Tokens are issued **only to authenticated users**: patient via eID/OIDC session; physician via staff OIDC + MFA.
- Tokens are **short-lived** (default `TELEHEALTH_SESSION_TTL_SECONDS=3600`; issue 10 min before `scheduled_at`).
- Each token is **single-use per session**: revoked on `ended` or `cancelled`. A re-join (e.g. refresh during active call) issues a new token via a `/rejoin` endpoint, rate-limited to prevent abuse.
- Token issuance writes to `audit_log`: `{ actor: patientToken|staffId, action: 'telehealth.token.issued', entity: sessionId }`.

---

## API surface (NestJS additions)

### `TelehealthModule` (new NestJS module)

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /telehealth/sessions` | staff (clinician/admin) | list sessions for physician's schedule |
| `POST /telehealth/sessions` | internal (from booking service) | create session on booking confirmed |
| `GET /telehealth/sessions/:id` | patient (own session) or staff | session metadata |
| `POST /telehealth/sessions/:id/join` | patient or staff | verify auth, issue join token |
| `POST /telehealth/sessions/:id/admit` | physician only | transition `waiting → active` |
| `POST /telehealth/sessions/:id/end` | patient or physician | transition `active → ended`; emit `telehealth.session.ended` to queue |
| `POST /telehealth/sessions/:id/intake` | patient | submit pre-call intake form |
| `GET /telehealth/sessions/:id/summary` | patient (own, step-up 2FA) or staff | fetch post-call summary |
| `GET /telehealth/sessions/:id/summary/pdf` | patient (own, step-up 2FA) or staff | download summary PDF |

### `telehealth.session.ended` queue event
Published to RabbitMQ when a session ends. The HIS sync agent consumes it and writes:
1. A FHIR `Encounter` (status=finished, class=VR).
2. Any `MedicationRequest` (e-prescription) attached to the session.
3. Any `Appointment` (proposed follow-up).
4. A `ClinicalImpression` from the physician's note.

Idempotency: keyed on `session_id`. A replay writes nothing if `telehealth_sessions.his_synced = true`.

---

## Pre-call device check (client-side)
On navigating to the room URL, before rendering the waiting room:
1. Request `getUserMedia({ video: true, audio: true })`.
2. If denied: show a full-screen error card ("Camera or microphone access denied — please allow in your browser settings") with the clinic phone number.
3. If granted: run a 5-second local echo test; show green "Your device is ready" status.
4. Persist permission result in `sessionStorage` (key `th_device_ok`) so a reload within the session doesn't re-prompt.

---

## Security & compliance additions

### GDPR delta for video
- **DPIA mandatory (Art. 35):** Processing special-category health data via video at scale requires a Data Protection Impact Assessment before go-live. The DPO must complete the DPIA covering: purpose/necessity, risks, safeguards, data flows (browser → LiveKit SFU → HIS via queue), sub-processors, cross-border transfer assessment. Add DPIA completion as a gate item in `LAUNCH_CHECKLIST.md §L9`. The DPIA must be reviewed annually and on any significant system change.
- **Lawful basis**: Article 9(2)(h) — medical diagnosis/treatment by a health professional.
- **Separate telehealth consent**: collected at Step 4 of the booking wizard; stored in `booking_consents` table with `consent_type = 'telehealth_medical_record'`. Mandatory; booking cannot be confirmed without it.
- **No recording by default**: video streams are never persisted. The post-call `telehealth_summaries.clinical_note` is text authored by the physician, not a transcript. If the hospital ever decides to enable recording, this requires: DPO sign-off, a separate opt-in consent from the patient, and a retention schedule. `TELEHEALTH_RECORDING_ENABLED` is enforced `false` by the config validator in production unless `TELEHEALTH_RECORDING_DPO_APPROVED=true` is also set.
- **Data minimisation**: `patient_token` in `telehealth_sessions` is an opaque session-scoped token; never the RČ or full personal identifier. Patient identity lives in the eID/OIDC layer and the HIS.
- **Summary PDFs**: generated server-side; stored temporarily (7 days, then purged per `RETENTION.md`) at a path accessible only via the authenticated download endpoint. Download writes an `audit_log` entry.

### Decree 179/2020 delta
- All video streams transit TLS 1.3 (SRTP inside DTLS over WebRTC). The SFU must enforce this; the API rejects tokens if `LIVEKIT_URL` is not `wss://`.
- Physician join requires MFA (same requirement as all staff actions).
- Every state transition, token issuance, intake submission, and summary download writes to the immutable `audit_log`.

### MDR scope (EU) 2017/745
The teleconsult software is a human-to-human communication tool, not a medical device. It does not make autonomous clinical decisions, diagnose conditions, or recommend treatment without physician authorship. This exclusion must be formally documented by the hospital's Quality/Regulatory department (per MDCG 2019-11 guidance) and added as a gate item in `LAUNCH_CHECKLIST.md §L9`. If AI features (transcription, decision support) are ever added, a new MDR scope determination is required before those features ship.

### NIS2 (EU) 2022/2555 — Hospitals are essential entities
Hospitals fall under NIS2 Annex I (Health sector) as essential entities. Telemedicine-specific additions:
- **Incident reporting:** significant cybersecurity incidents (unauthorized session access, token exposure, HIS sync failure caused by a security event) must be reported to NKIBK within **24 hours** (initial alert) and **72 hours** (detailed report).
- **Supply chain security:** LiveKit (cloud) must be assessed as a supply chain entity; include security incident notification obligations in the contract.
- **Risk register:** add telemedicine-specific risk items (video interception, token replay, TURN server misconfiguration) to the cybersecurity risk register submitted to NKIBK.

### NCZI eZdravie — e-Prescriptions (Act 362/2011)
Slovak law requires all prescriptions to be submitted to the **NCZI eZdravie** electronic prescribing system — a FHIR `MedicationRequest` in HIS alone is not a legally valid prescription. Post-call prescription flow: physician issues prescription via the room UI → API submits to NCZI eZdravie → eZdravie returns a prescription code → patient receives code via SMS. The FHIR `MedicationRequest` in HIS must reference the NCZI prescription code (`identifier.system = 'urn:oid:nczi.ezdravia'`). Confirm with Hospital IT that the existing NCZI integration (BUILD_GUIDE Phase 7.2) covers teleconsultation encounter types.

### Pen-test scope additions (for L6)
Add to the existing VAPT scope:
- Token issuance endpoint: can a patient join another patient's session by guessing/replaying a token?
- Room admission: can a patient self-admit without physician action?
- Summary PDF: can a patient access another patient's PDF?
- Provider room: can an unauthenticated WebSocket connect to the LiveKit room directly (bypassing our token)?

---

## Accessibility — room UI (WCAG 2.1 AA)
- All control buttons have `aria-label` and `aria-pressed` (toggled state for mic/camera).
- Focus is managed on overlay transitions (waiting → active: focus moves to the end-call button; active → postcall: focus moves to the primary action button).
- The room works without video (audio-only fallback): if camera fails, the physician tile shows the avatar initials (already implemented as `.tile-avatar` fallback).
- Keyboard: Tab through controls, Space/Enter to activate, Escape to end call (with confirmation dialog).
- Screen reader: `aria-live="polite"` region for session status changes ("Physician has joined", "Call ended").

---

## Minors (GDPR Art. 8, Act 576/2004 §6)
Patients under 16 cannot consent to online services under GDPR Art. 8 (Slovak threshold: 16). Act 576/2004 §6 requires healthcare consent for minors to be given by the legal representative (parental consent); 15–17-year-olds co-consent. The booking wizard must:
- Block telemedicine booking for eID-verified patients under 16 with a redirect to in-person booking or clinic contact.
- For 16–17-year-olds: include a guardian co-presence confirmation checkbox.
- Document the in-session minor procedure in the staff editing runbook.

## Phasing
| Phase | Scope | Unlock |
|---|---|---|
| **TH-Pilot** | One clinic (FRO — existing soft-launch pilot); patient + physician views; no recording | Alongside or immediately after the FRO full launch |
| **TH-Rollout** | All `telehealth:true` clinics/physicians | After TH-Pilot burn-in (2–4 weeks clean) |
| **TH-Advanced** | Structured intake form, post-call PDF generation, e-prescription from video, NCZI teleconsultation reporting | Post-rollout |
