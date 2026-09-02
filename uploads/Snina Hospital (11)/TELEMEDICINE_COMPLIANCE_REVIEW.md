# Telemedicine Compliance Review — Nemocnica Snina

**Scope:** Video consultation module (`teleconsult.html`, `TELEMEDICINE_ARCHITECTURE.md`, `TELEMEDICINE_DATA_MODEL.md`, `TELEMEDICINE_BUILD_GUIDE.md`, `TELEMEDICINE_CONFIG.md`).
**Regulations reviewed:** GDPR (EU) 2016/679 · Act 18/2018 · Act 576/2004 · Act 578/2004 · Act 153/2013 · Act 362/2011 · Decree 179/2020 · Act 351/2022 · NIS2 (EU) 2022/2555 · MDR (EU) 2017/745 · EHDS (EU) 2025/327 · eIDAS 910/2014.

**Severity legend:** 🔴 **Blocker** — illegal to go live without this · 🟡 **Required** — material gap, must close before launch · 🟢 **Advisory** — best practice / upcoming regulation.

---

## What is already correctly covered ✓

| Item | Where |
|---|---|
| Lawful basis Art. 9(2)(h) — health professional treatment | `TELEMEDICINE_ARCHITECTURE.md` |
| No recording by default; DPO gate (`TELEHEALTH_RECORDING_DPO_APPROVED`) | `TELEMEDICINE_ARCHITECTURE.md`, `TELEMEDICINE_CONFIG.md` |
| Separate telehealth GDPR consent at booking (medical record documentation per §18 Act 576/2004) | `TELEMEDICINE_README.md`, `TELEMEDICINE_BUILD_GUIDE.md` T1.1 |
| Data minimisation — opaque `patient_token`, no RČ in `telehealth_sessions` | `TELEMEDICINE_DATA_MODEL.md` |
| TLS 1.3 signaling (`wss://` enforced by config validator) | `TELEMEDICINE_ARCHITECTURE.md`, `TELEMEDICINE_CONFIG.md` |
| DTLS/SRTP for media streams | `TELEMEDICINE_ARCHITECTURE.md` |
| MFA for physician join | `TELEMEDICINE_ARCHITECTURE.md` |
| Immutable audit log covering all sensitive actions | `TELEMEDICINE_DATA_MODEL.md` |
| EU data residency for all infrastructure | `TELEMEDICINE_ARCHITECTURE.md` |
| WCAG 2.1 AA — room UI a11y spec | `TELEMEDICINE_ARCHITECTURE.md` |
| eID/OIDC patient identity verification | `TELEMEDICINE_ARCHITECTURE.md` |
| Clinical data in HIS via FHIR, not in our web DB | `TELEMEDICINE_DATA_MODEL.md` |
| Emergency services legal notice on telehealth.html | `telehealth.html` |
| Summary PDFs purged after 7 days (short-term cache only) | `TELEMEDICINE_DATA_MODEL.md` |
| Step-up 2FA for summary PDF download | `TELEMEDICINE_README.md` |

---

## 🔴 Blockers — illegal to go live without these

### B1 — GDPR Art. 35: Data Protection Impact Assessment (DPIA) is mandatory

**Regulation:** GDPR Art. 35(3)(b) — processing of special-category health data (Art. 9) on a large scale is listed as a category that systematically requires a DPIA. Healthcare video consultations fall squarely within this.

**Current state:** Not mentioned anywhere in the handoff package.

**Required action:**
- The DPO must complete a DPIA **before** the telemedicine module goes live. The DPIA must assess: purpose and necessity, risks to patients' rights and freedoms, safeguards (encryption, access controls, no recording), data flows (patient browser → LiveKit SFU → HIS via queue), sub-processors (LiveKit, PDF service), cross-border transfers.
- Add a DPIA completion gate to `LAUNCH_CHECKLIST.md §L9` alongside the existing gate items.
- The DPIA register entry must be maintained and reviewed annually or on any significant system change.

**Owner:** DPO · **Blocks:** TH-Pilot soft-launch.

---

### B2 — Act 362/2011 Z.z.: e-Prescriptions must route through NCZI eZdravie, not FHIR alone

**Regulation:** Act No. 362/2011 Z.z. (Medicines Act) §120 and the implementing eZdravie legislation require all prescriptions issued by Slovak healthcare providers to be submitted to the **NCZI eZdravie** electronic prescribing system. A FHIR `MedicationRequest` in the hospital HIS is not a valid legal Slovak prescription by itself.

**Current state:** `TELEMEDICINE_DATA_MODEL.md` describes post-call e-prescriptions as a FHIR `MedicationRequest` written to HIS. The NCZI eZdravie submission step is absent.

**Required action:**
- The post-call flow must include: physician issues prescription → API submits to NCZI eZdravie → eZdravie returns a prescription code → patient receives the code via SMS (same SMS gateway already in use for booking).
- The FHIR `MedicationRequest` in HIS should reference the NCZI prescription code (`identifier.system = 'urn:oid:nczi.ezdravia'`).
- `TELEMEDICINE_BUILD_GUIDE.md` Phase T3.1 must be updated to include the eZdravie prescription submission step.
- Confirm with Hospital IT that the NCZI eZdravie integration (already partially scoped in Phase 7.2 of `BUILD_GUIDE.md`) covers teleconsultation encounter types.

**Owner:** Hospital IT + Backend · **Blocks:** Any teleconsult that issues a prescription.

---

### B3 — Act 576/2004 Z.z. §24: Medical record retention — 20 years, not 5

**Regulation:** Act No. 576/2004 Z.z. §24(2) — medical documentation must be retained for **20 years** after the last record entry (adults). Special cases: deceased patients 20 years after death; minors until they reach age 38.

**Current state:** `TELEMEDICINE_DATA_MODEL.md` states `telehealth_sessions: retain 5 years`. While the document correctly notes that `telehealth_summaries` is a cache and the HIS holds the authoritative FHIR Encounter, this distinction is not formally enforced — nothing currently confirms the HIS will retain FHIR Encounters for 20 years.

**Required action:**
1. Clarify in `RETENTION.md` (and `TELEMEDICINE_DATA_MODEL.md`) that `telehealth_sessions` in our DB is **operational metadata, not a medical record** — it tracks session state for the portal and audit trail. The statutory 20-year retention obligation falls on the FHIR `Encounter` in HIS.
2. Add a contractual/SLA requirement with the HIS vendor confirming that FHIR Encounter records will be retained for 20 years per §24.
3. Ensure `telehealth_summaries.his_encounter_id` is always populated before the summary cache is eligible for purge — never purge a summary whose HIS sync has not been confirmed (`his_synced = false`).
4. Update `LAUNCH_CHECKLIST.md §L7` to include: HIS vendor confirms 20-year retention of FHIR Encounter records for teleconsultations.

**Owner:** Hospital IT (HIS vendor SLA) + DPO (RETENTION.md) · **Blocks:** Go-live sign-off.

---

## 🟡 Required — material gaps, must close before launch

### R1 — NIS2 Directive (EU) 2022/2555: Hospitals are essential entities

**Regulation:** NIS2 Directive, transposed into Slovak law via Act No. 69/2018 Z.z. (Cybersecurity Act) as amended. Hospitals are **essential entities** under Annex I (Health sector). Telemedicine significantly expands the platform's attack surface and triggers review.

**Obligations not yet fully specified:**
- **Risk management:** A cybersecurity risk assessment covering the telemedicine module must be documented and submitted to NKIBK (National Cyber Security Centre) as part of the annual security report.
- **Significant incident reporting:** Significant cybersecurity incidents must be reported to NKIBK within **24 hours** (initial alert) and **72 hours** (detailed report). A "significant incident" includes: unauthorized access to patient video sessions, exposure of session tokens, HIS sync failures caused by a security event.
- **Supply chain security:** LiveKit (if using livekit.io cloud) must be assessed as a supply chain entity. Confirm: does LiveKit have an EU-compliant security programme? Is there a contract clause covering security incident notification?

**Required action:**
- Add NIS2 incident reporting procedure to `PRODUCTION_ARCHITECTURE.md` (who reports, what triggers a report, NKIBK contact).
- Add telemedicine-specific risk items to the cybersecurity risk register.
- Add supply chain DPA/security assessment for LiveKit to the accounts table in `CONFIG_AND_ENV.md`.
- Add to L6 pen-test scope: NIS2 Article 21 technical measures verification (MFA ✓, encryption ✓, access control ✓, incident detection coverage for the video module).

---

### R2 — GDPR Art. 28: Data Processing Agreements required for LiveKit and PDF service

**Regulation:** GDPR Art. 28 — any third-party processor handling personal (and especially special-category) data must have a signed DPA with the controller before processing begins. Video streams and medical summaries are both special-category health data.

**Current state:** LiveKit and the PDF generation service are listed as infrastructure accounts (15 and 16 in `TELEMEDICINE_CONFIG.md`) but no DPA requirement is called out.

**Required action:**
- **LiveKit (cloud option):** Obtain a signed DPA from livekit.io before go-live. Confirm EU data residency and no third-country transfers. If livekit.io's parent company processes data in the US, Standard Contractual Clauses (SCCs) are required.
- **LiveKit (self-hosted):** No DPA needed (no third-party processor), but the operator still processes health data — the internal data processing record must reflect this.
- **PDF generation service (Gotenberg or equivalent):** Obtain DPA if externally hosted. If self-hosted EU, document in the internal processing register.
- Update `CONFIG_AND_ENV.md` accounts table rows 15 and 16 with a "DPA required: Yes" column.
- List both sub-processors in the privacy notice on `kontakt.html #gdpr`.

---

### R3 — GDPR Art. 13/14: Patients must be informed of telemedicine-specific data processing

**Regulation:** GDPR Art. 13 — information must be provided at the time of data collection. The booking wizard collects telemedicine-specific data (video session, intake form, clinical summary path to HIS) beyond what the base GDPR notice covers.

**Current state:** The booking wizard has a telehealth consent checkbox but no link to a telemedicine-specific privacy notice covering: what is recorded (nothing unless DPO approves), what reaches HIS (FHIR Encounter), sub-processors (LiveKit, PDF service), retention periods.

**Required action:**
- Add a "Telehealth privacy notice" link adjacent to the telehealth consent checkbox in Step 4 of the booking wizard.
- The notice (a sub-section of the kontakt.html #gdpr page, or a separate `/[lang]/telehealth/sukromie` page) must cover: controller identity, lawful basis (Art. 9(2)(h)), what data flows where (browser → SFU → HIS via queue), sub-processors (with names), no recording default, retention, patient rights (Art. 15–22), DPO contact.
- Update `TELEMEDICINE_BUILD_GUIDE.md` T1.1 to include creation of this notice.

---

### R4 — TURN server geography must be enforced, not just signaling URL

**Regulation:** GDPR Art. 46 — personal data transfers to third countries require appropriate safeguards. A WebRTC TURN relay server outside the EU would route health-related audio/video through non-EU infrastructure.

**Current state:** `TELEMEDICINE_ARCHITECTURE.md` validates `LIVEKIT_URL` starts with `wss://` but says nothing about TURN server geography. When direct peer-to-peer WebRTC fails (common on hospital/corporate networks), all media is relayed through TURN servers. If those are in the US, health data leaves the EU.

**Required action:**
- Add env var `LIVEKIT_TURN_REGION=eu` (or equivalent LiveKit configuration that restricts ICE candidates to EU-region TURN servers).
- Config validator: assert that TURN server URLs, if separately configurable, resolve to EU IP ranges (or to the same self-hosted EU server).
- For livekit.io cloud: confirm in writing (or in the DPA) that EU-region deployments use EU-only TURN servers.
- Add to `TELEMEDICINE_CONFIG.md` and update the pen-test scope to include: verify that all ICE candidates offered during a call are EU-resident.

---

### R5 — Minors: no consent or access mechanism defined (GDPR Art. 8, Act 576/2004 §6)

**Regulation:** GDPR Art. 8 — online services require parental consent for under-16s in Slovakia. Act 576/2004 §6 — consent for healthcare for minors (under 18) is given by the legal representative; for 15–17-year-olds the minor co-consents.

**Current state:** The booking wizard and portal have no age check or guardian consent flow.

**Required action (minimum viable):**
- Add an age confirmation step to the telemedicine booking wizard (Step 4): "I confirm I am 16 or older, or my legal guardian is present and consenting on my behalf."
- For patients identified via eID as under 16: block direct telemedicine booking and display a message directing them to book an in-person appointment or contact the clinic.
- Document the guardian-consent procedure in the staff editing runbook for clinicians who encounter a minor in a video session.
- Longer term: build a full guardian-delegation flow in the portal.

---

### R6 — EU MDR 2017/745: scope exclusion must be documented

**Regulation:** EU Medical Device Regulation 2017/745 — software that makes or aids clinical decisions (diagnosis, monitoring, treatment) may qualify as a medical device (Class IIa or higher), requiring CE marking, QMS, and Notified Body involvement.

**Current state:** The platform is human-to-human consultation software. No automated diagnostic or treatment-decision features are present. However, this exclusion is not formally documented.

**Required action:**
- The hospital's Quality/Regulatory department must produce a brief MDR scope determination document confirming the teleconsult software is excluded from MDR as a "general purpose software" used as a communication tool, not as a medical device (per MDCG 2019-11 guidance).
- This document must be retained as evidence and reviewed any time a new feature is added (e.g., if AI transcription or clinical decision support is ever introduced, a new MDR determination is required).
- Add this as a gate item in `LAUNCH_CHECKLIST.md §L9`: "MDR scope exclusion document signed by Quality/Regulatory."

---

## 🟢 Advisory — best practice and upcoming regulations

### A1 — European Health Data Space (EHDS) — Regulation (EU) 2025/327

EHDS entered into force in March 2025 with a phased application schedule. Key obligations relevant to telemedicine:
- **Primary use (MyHealth@EU):** Patient health data (including teleconsultation records) will eventually be required to be available for cross-border exchange in HL7 FHIR R4 format via the national MyHealth@EU node (NCZI). The platform's FHIR-first architecture is already well-positioned for this.
- **Secondary use:** Pseudonymised health data may be made available for research/policy via the Health Data Access Body. This will require the DPO to expand the DPIA and privacy notice when EHDS secondary use obligations apply to the hospital.
- **Action now:** No immediate changes required. However, ensure the FHIR Encounter resource for teleconsultations uses EHDS-aligned terminology codes (SNOMED CT encounter types) so that future EHDS export jobs can include these records without a data migration.

### A2 — Act 153/2013 Z.z.: Confirm NCZI eZdravie supports teleconsultation encounter type

The NCZI eZdravie system (National Health Information System) is the authoritative Slovak health record system. Confirm with NCZI that:
- Teleconsultation encounters (`class: VR`) are an accepted encounter type in the eZdravie FHIR implementation guide.
- The FHIR Encounter resources submitted via the HIS sync agent conform to the Slovak FHIR Implementation Guide (SKHIS IG) profile.
If eZdravie does not yet support virtual encounter types, a workaround (e.g., classifying as an outpatient encounter with a telemedicine note) must be agreed with NCZI before go-live.

### A3 — eIDAS 2.0 / EUDI Wallet (Regulation (EU) 2024/1183)

The European Digital Identity (EUDI) Wallet will provide an alternative eID mechanism across EU member states. Slovensko.sk eID will interface with the EUDI Wallet framework. No immediate action required, but when eID integration is updated (post-L1), ensure the OIDC client is designed to accept EUDI Wallet assertions in addition to the current Slovensko.sk eID, to avoid a future rework.

### A4 — Accessibility Act 351/2022 update expected

The Slovak Ministry of Finance is expected to publish updated technical standards for the Accessibility Act in 2025/2026, potentially raising requirements above WCAG 2.1 AA to WCAG 2.2. The video consultation room UI should be audited against WCAG 2.2 criteria (especially 2.5.3 Label in Name, 3.2.6 Consistent Help) in addition to the current WCAG 2.1 AA target.

---

## Summary action table

| # | Severity | Owner | Blocks | Action |
|---|---|---|---|---|
| B1 | 🔴 Blocker | DPO | TH-Pilot | DPIA before go-live; add to L9 gate |
| B2 | 🔴 Blocker | Hospital IT + Backend | Prescriptions | NCZI eZdravie submission in post-call flow |
| B3 | 🔴 Blocker | Hospital IT + DPO | L9 sign-off | HIS vendor confirms 20-year FHIR Encounter retention |
| R1 | 🟡 Required | Security + Backend | L6 pen-test | NIS2 incident reporting procedure; LiveKit supply chain assessment |
| R2 | 🟡 Required | DPO + Ops | TH-Pilot | DPAs for LiveKit and PDF service; update privacy notice |
| R3 | 🟡 Required | Backend + DPO | T1.1 build | Telehealth-specific privacy notice; link from booking wizard |
| R4 | 🟡 Required | Ops + Backend | L6 pen-test | TURN server EU geography enforcement; config validator |
| R5 | 🟡 Required | Backend | T1.1 build | Age check in booking wizard; minor access block |
| R6 | 🟡 Required | Quality/Regulatory | L9 gate | MDR scope exclusion document |
| A1 | 🟢 Advisory | Backend | — | Use EHDS-aligned SNOMED CT codes in FHIR Encounter |
| A2 | 🟢 Advisory | Hospital IT | — | Confirm NCZI eZdravie supports VR encounter type |
| A3 | 🟢 Advisory | Backend | — | Design OIDC client to accept EUDI Wallet future |
| A4 | 🟢 Advisory | Frontend | — | Audit room UI against WCAG 2.2 |

---

## Build guide task additions

The following items must be added to `TELEMEDICINE_BUILD_GUIDE.md`:

**Phase T3.2 additions:**
- B1: Add "DPIA completion confirmed" to `LAUNCH_CHECKLIST.md §L9` gate.
- B2: Extend Phase T3.1 with NCZI eZdravie prescription submission step.
- B3: Add HIS vendor 20-year retention confirmation to `LAUNCH_CHECKLIST.md §L7`.
- R1: Add NIS2 incident reporting procedure to `PRODUCTION_ARCHITECTURE.md`.
- R2: Add DPAs to accounts table rows 15–16 in `CONFIG_AND_ENV.md`.
- R3: Add telehealth privacy notice page to T1.2 build scope.
- R4: Add `LIVEKIT_TURN_REGION` env var and config validator check.
- R5: Add minor access block to T1.1 build scope.
- R6: Add MDR scope exclusion document to L9 gate.
