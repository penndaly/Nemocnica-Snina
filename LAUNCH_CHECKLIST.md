# Nemocnica Snina — Go-Live Checklist

## Infrastructure
- [ ] EU-only hosting confirmed (VPS/cloud region = EU, e.g. Hetzner Falkenstein, OVH Strasbourg)
- [ ] TLS 1.3 enforced at load balancer / Nginx (Decree 179/2020)
- [ ] AES-256 at rest: PostgreSQL tablespace encryption or volume-level encryption enabled
- [ ] Redis AUTH password set and TLS transport enabled
- [ ] RabbitMQ TLS + strong password
- [ ] 3-2-1 backup: daily PostgreSQL dumps → 2 local + 1 geographically separate EU location
- [ ] Backup restore drill completed and documented

## Security
- [ ] All secrets in `.env` / secrets manager — no hardcoded values in code
- [ ] `JWT_SECRET` ≥ 64 random bytes
- [ ] All staff MFA secrets enrolled via TOTP setup flow
- [ ] Rate limiting verified under load (booking ≤5/min, login ≤10/min)
- [ ] VAPT pen-test commissioned + critical/high findings resolved
- [ ] CSP headers verified in browser network panel
- [ ] HSTS preload submitted at hstspreload.org
- [ ] Audit log rows verified immutable (attempt UPDATE/DELETE on `audit_log` → permission denied)
- [ ] Input validation on all API endpoints (NestJS ValidationPipe confirmed active)
- [ ] SQL injection: Prisma parameterized queries only (no raw SQL with interpolated user input)

## Compliance
- [ ] DPO has reviewed and approved privacy policy text at /[lang]/kontakt#gdpr
- [ ] Cookie banner copy DPO-approved (only functional cookies — no consent needed for strictly necessary)
- [ ] Data retention policy documented and implemented (booking records: 3 years, audit logs: 5 years)
- [ ] Data subject access + erasure tooling available to DPO
- [ ] NCZI registration complete for eDohody XML submission
- [ ] HIS integration tested end-to-end: booking confirmed → RabbitMQ → HIS sync verified
- [ ] HIS vendor confirms 20-year FHIR Encounter retention in writing (Act 576/2004 §24)

## CMS & Content
- [ ] All 7 departments seeded and reviewed by hospital communications
- [ ] All 8 clinics: bookingDays / bookingWindow / referral flags verified by medical secretary
- [ ] All 15 physicians: accepting status + langs confirmed by HR
- [ ] All 6 disclosures: real PDFs attached to CMS records
- [ ] Hospital singletons (phone numbers, addresses) verified accurate
- [ ] APS live feed from e-VÚC PSK API tested and fallback verified
- [ ] At least 1 news item published as real content

## Accessibility (Act 351/2022)
- [ ] axe DevTools / Lighthouse accessibility ≥ 95 on all public routes
- [ ] Skip-to-content link verified working (keyboard Tab on fresh load)
- [ ] High-contrast mode tested with Windows High Contrast and accessibility controls
- [ ] Screen reader (NVDA/VoiceOver) tested on: home, booking wizard, portal login
- [ ] Booking wizard fully keyboard-operable (no mouse required)
- [ ] All form error messages announced via role="alert"
- [ ] Accessibility statement at /[lang]/kontakt#pristupnost updated with audit date
- [ ] `lang` attribute correct on `<html>` for all 6 locales

## i18n & SEO
- [ ] All 6 locale routes return 200
- [ ] `hreflang` tags verified for every page (use hreflang checker tool)
- [ ] `x-default` pointing to /sk
- [ ] Sitemap.xml validated (all department slugs, all locales)
- [ ] robots.txt: /admin and /api disallowed
- [ ] MedicalOrganization JSON-LD validated at schema.org/validator
- [ ] Google Search Console: sitemap submitted

## Booking (most critical user flow)
- [ ] Booking rule enforcement verified manually for each clinic:
  - [ ] Trauma surgery: only Tue/Thu (bookingDays=[2,4])
  - [ ] Angiology: only Thu/Fri 13:00–14:00, referral required
  - [ ] Diabetology: bookable=false → no slots shown
  - [ ] Neurology: bookable=false → disabled button
  - [ ] General Surgery: Mon–Fri, LSPP €1.99 fee shown
- [ ] RC validation: invalid RC rejected at step 4
- [ ] GDPR consent: cannot confirm without checkbox
- [ ] Referral consent: shown only for referral=true clinics
- [ ] SMS OTP: confirmation SMS received on real phone
- [ ] Cancel link in SMS works and frees slot
- [ ] Double-booking prevented: two concurrent requests for same slot → second gets 400
- [ ] Reminder SMS fires 48h before appointment (scheduler configured)
- [ ] HIS queue: booking.confirmed event visible in RabbitMQ management UI

## Monitoring — APS staleness alert (L5, Sprint S2)

The APS cache TTL is controlled by `APS_CACHE_TTL_SECONDS` (default 600 s / 10 min).
The live PSK feed is fetched on cache miss; on failure the Redis or in-memory cached
value is served. If both are unavailable, the static fallback is returned (`isFallback: true`).

**Alert rule:** trigger a P2 alert if the APS cache age exceeds 2× TTL (> 20 minutes by default).

Prometheus / Datadog alert (pseudo-code):
```
alert: ApsCacheStale
expr: (time() - aps_last_live_fetch_unix) > (APS_CACHE_TTL_SECONDS * 2)
for: 1m
labels: { severity: warning }
annotations:
  summary: "APS schedule stale for > {{ $value | humanizeDuration }}"
  description: |
    PSK APS live feed has not refreshed for > 2× TTL. Browser receives isFallback:true.
    Check PSK_APS_API_URL reachability and REDIS_URL health.
```

Uptime monitor (Better Uptime / Uptime Robot):
- Monitor `GET ${APP_BASE_URL}/api/aps` every 5 minutes.
- Assert HTTP 200 and JSON `schedule` array length ≥ 1.
- Alert if `isFallback: true` persists > 20 minutes.

- [ ] APS staleness alert configured (trigger at cache age > 2× APS_CACHE_TTL_SECONDS, default 20 min)
- [ ] Uptime monitor on `/api/aps` asserting parseable `schedule` array with ≥ 1 entry

## Soft launch (FRO first)
- [ ] Enable booking only for FRO (Rehabilitation) in CMS
- [ ] Reception staff trained on admin CMS (walkthrough of add/edit/delete for all collections)
- [ ] Staff MFA enrolled for all admin accounts
- [ ] Monitoring: uptime alert configured (e.g. Uptime Robot → SMS/email on 5xx)
- [ ] Error tracking configured (e.g. Sentry DSN set in env)
- [ ] On-call runbook documented: who to contact if booking goes down

## Full launch
- [ ] All clinics enabled in CMS
- [ ] All 6 locales: cs/pl/hu/uk machine-translated + clinical pages human-reviewed
- [ ] Google Cloud Translation glossary configured (brand terms, clinic names, ICD codes)
- [ ] Performance: Lighthouse ≥ 90 on Performance/SEO/Best-Practices/Accessibility
- [ ] Press release / announcement news item published in CMS

---

## GDPR — DSAR/Erasure (L8 items)

- [ ] DSAR access (Art. 15) tested end-to-end on production build: export runs, JSON downloaded, audit entry created
- [ ] DSAR erasure (Art. 17) tested end-to-end: anonymization runs, retained-with-reason documented, audit entry created
- [ ] RETENTION.md linked from /kontakt#gdpr
- [ ] Cookie notice live on /kontakt#cookies (strictly-necessary only, no consent banner)
- [ ] GDPR text on /kontakt#gdpr DPO-approved
- [ ] Accessibility statement on /kontakt#pristupnost updated with L3 axe audit date and result
- [ ] Staff editing runbook (docs/STAFF_EDITING_RUNBOOK.md) delivered to hospital communications

---

## Pen-test scope additions — telemedicine (L6, Sprint S10)

These items extend the VAPT scope to cover the video module. All findings must be closed before the telemedicine L9 gate.

- [ ] **Join-token isolation:** verify patient A cannot use their token to join session S2 (different session); verify token TTL (`TELEHEALTH_SESSION_TTL_SECONDS`) is enforced by LiveKit room
- [ ] **Session-state enforcement:** verify illegal status transitions (e.g. cancelled → active) are rejected at API and DB layer
- [ ] **Physician endpoint RBAC:** verify patients cannot call `/admit`, `/recording`, or admin session-cancel endpoints (expect 403)
- [ ] **Recording gate:** verify `POST /api/telehealth/sessions/:id/recording` returns 403 when `TELEHEALTH_RECORDING_ENABLED=false`
- [ ] **Consent gate:** verify `/api/telehealth/sessions/:id/join` returns 403 with `reason: consent_required` when no `telehealth_medical_record` consent on the booking
- [ ] **NIS2/R1 — TURN server geography:** verify all ICE candidates during a call resolve to EU-resident IP ranges (no US/AP/SA TURN relay)
- [ ] **NIS2/R1 — Incident detection:** confirm monitoring covers unauthorized video session access, join-token replay, HIS sync failure caused by a security event
- [ ] **NIS2 Article 21 technical measures:** verify MFA (physician join), encryption (wss://, DTLS/SRTP), and access control for physician schedule and admin session views
- [ ] **Minor access block:** verify patients under 16 (eID birthdate claim) cannot obtain a join token (expect 403 `minor_blocked`)
- [ ] **Supply-chain (LiveKit):** confirm LiveKit DPA covers security incident notification; confirm EU-only TURN in writing or DPA

---

## Compliance documentation gate (L9 items)

These items must be signed off before go-live. All documents must be complete, signed where indicated, and filed in the project compliance folder.

**Base platform:**
- [ ] RETENTION.md updated; HIS vendor 20-year retention confirmed in writing (Act 576/2004 §24)
- [ ] NIS2_INCIDENT_PROCEDURE.md: NKIBK contact filled, internal escalation contacts (IT Lead, DPO, Director, Legal, HIS vendor) named with phone numbers
- [ ] MDR_SCOPE_EXCLUSION.md: signed by Quality/Regulatory Lead

**Telemedicine module (Sprint S10):**
- [ ] **DPIA completed and signed by DPO** (GDPR Art. 35 — mandatory for health-data video processing at scale) *Owner: DPO*
- [ ] **HIS vendor confirms 20-year FHIR Encounter retention** for teleconsultations in writing (Act 576/2004 §24) — see also §L7 above *Owner: Hospital IT*
- [ ] **DPAs signed for LiveKit** (cloud option) and PDF generation service (GDPR Art. 28) — include EU data residency, no third-country transfer, or SCCs if LiveKit parent entity is US *Owner: DPO + Ops*
- [ ] **MDR scope exclusion document for telehealth software** signed by Quality/Regulatory Lead (EU MDR 2017/745, MDCG 2019-11 guidance) — see `docs/MDR_SCOPE_EXCLUSION.md` *Owner: Quality/Regulatory*
- [ ] **NIS2 incident reporting procedure documented** and NKIBK contact registered; telemedicine-specific triggers added — see `docs/NIS2_INCIDENT_PROCEDURE.md` *Owner: Security + DPO*
- [ ] **NCZI eZdravie teleconsultation encounter type confirmed** with Hospital IT: eZdravie accepts VR encounter class; FHIR MedicationRequest identifier conforms to SKHIS IG *Owner: Hospital IT*
- [ ] **LiveKit DPA confirms EU-only TURN servers** (GDPR Art. 46 — no health-data transit through non-EU relay) or self-hosted EU TURN deployed *Owner: Ops*
- [ ] **`TELEHEALTH_RECORDING_ENABLED=false`** verified in production config *Owner: DevOps*
- [ ] **Telehealth pen-test items** (L6 scope above) all closed *Owner: Security*
- [ ] **Consent + retention compliance verified** for video data: telehealth_medical_record consent stored on every telehealth booking; his_synced guard verified on telehealth_summaries

---

---

## Telemedicine L9 gate (Sprint S11)

All items below must be confirmed before enabling telehealth for any clinic in production.

**Automated (CI must be green):**
- [ ] SPEC TH-1 (Telehealth booking wizard) — all locales green in CI
- [ ] SPEC TH-2 (Patient waiting room) — green in CI
- [ ] SPEC TH-3 (Physician admit → active call) — green in CI
- [ ] SPEC TH-4 (Post-call summary + HIS sync) — green in CI
- [ ] SPEC TH-5 (Security: token isolation, recording gate, consent gate) — green in CI
- [ ] SPEC TH-6 (Admin telehealth config) — green in CI
- [ ] TH-A1/TH-A2 Accessibility — zero axe critical/serious on telehealth routes

**Infrastructure:**
- [ ] `TELEHEALTH_RECORDING_ENABLED=false` confirmed in production config *Owner: DevOps*
- [ ] `TELEHEALTH_PROVIDER=livekit` (not mock) in production *Owner: DevOps*
- [ ] `LIVEKIT_TURN_REGION=eu` set and config validator confirms non-US region *Owner: Ops*
- [ ] Telehealth monitoring dashboards live: session join rate, admission latency, post-call HIS sync DLQ queue depth *Owner: Ops*
- [ ] Alert added: HIS sync DLQ depth > 0 for telehealth events triggers P1 *Owner: Ops*

**Compliance (from T3.2 and compliance review):**
- [ ] DPIA completed and signed by DPO (GDPR Art. 35) *Owner: DPO*
- [ ] HIS vendor confirms 20-year FHIR Encounter retention for VR encounters in writing *Owner: Hospital IT*
- [ ] DPA signed with LiveKit (cloud) and PDF service (GDPR Art. 28) *Owner: DPO + Ops*
- [ ] MDR scope exclusion document signed by Quality/Regulatory Lead *Owner: Quality*
- [ ] NIS2 incident reporting procedure updated with telemedicine triggers *Owner: Security*
- [ ] NCZI eZdravie VR encounter type confirmed with Hospital IT *Owner: Hospital IT*

---

## TH-Pilot soft-launch plan (Sprint S11)

**Goal:** Validate telemedicine in a real production environment with a controlled cohort before rolling out to all enabled clinics.

**Phase 1 — FRO only (2-week burn-in):**
1. Enable `telehealth: true` for FRO (Rehabilitačné oddelenie) only via Admin → Telehealth → Clinics toggle.
2. Assign 2–3 physicians with `telehealth: true` in Admin → Telehealth → Physicians.
3. Soft-announce to a small cohort of returning patients (outbound SMS via the existing SMS gateway: ops task).
4. Monitor daily:
   - Session join rate (target ≥ 90% of booked sessions reach "active" within +5 min of scheduled_at)
   - Admission latency P50/P95 (physician → patient admitted)
   - Post-call HIS sync DLQ depth (target: 0 outstanding > 1 hour)
   - Patient satisfaction (optional — short form via SMS after consultation)
5. Review after 2 weeks: if no P0/P1 incidents and HIS sync rate ≥ 99%, proceed to Phase 2.

**Phase 2 — All telehealth:true clinics:**
- Toggle `telehealth: true` for remaining eligible clinics (interne, angiologicka) via admin.
- Announce publicly via news item in CMS.
- Enable telehealth link in the main nav if not already live (SiteHeader nav item was added in S7).

**Rollback:**
- Disable `telehealth: true` per clinic via Admin → Telehealth → Clinics toggle (immediate effect, no deploy).
- Sessions already in "active" or "waiting" are unaffected until they end naturally.

---

## Appendix — DSAR Operator Procedure

**Who can run this:** Admin-role staff only. MFA is required. Every action is written to the immutable audit log.

**Step-by-step — Right of Access (Art. 15):**

1. Log in to `/admin` with your admin account + TOTP code.
2. Navigate to **GDPR** in the admin sidebar.
3. Enter the subject's **rodné číslo** (birth number) in the RC field. The field is masked — use Show/Hide to verify the entry.
4. Click **Exportovať údaje** (Export data).
5. The system searches all booking and onboarding records matching the RC hash. This may take 10–30 seconds.
6. When the export is ready, click **Stiahnuť JSON** (Download JSON). Save the file.
7. The JSON contains: all bookings, onboarding applications, and audit entries referencing those records.
8. **Note in the response:** "Clinical records (diagnoses, medications, lab results) are held by the Hospital Information System (HIS) and are outside the scope of this export." Inform the subject to contact the HIS data controller for clinical records.
9. Send the JSON to the subject (encrypted if by email).

**Step-by-step — Right to Erasure (Art. 17):**

1. Verify the subject's identity and confirm you have a lawful basis for erasure (no legitimate overriding interest, no legal retention obligation applies to THIS subject's records).
2. Log in to `/admin` → **GDPR**.
3. Enter the subject's RC.
4. Read the **Čl. 17 — Právo na výmaz** section carefully. Check the confirmation checkbox: "I confirm I have verified the subject's identity and have a legal basis for erasure."
5. Click **Anonymizovať údaje** (Anonymize data).
6. The system anonymizes: `patientName → [ERASED]`, `patientPhone → 000000000`, `patientRcHash → [ERASED]` in all matching bookings and onboarding applications.
7. **Records that are retained (not erased) with reason:**
   - Audit log entries (5-year retention, Decree 179/2020 — immutable, cannot be deleted)
   - Financial records in bookings (5-year retention, Act 431/2002)
8. An audit log entry is created recording: operator email, timestamp, rows anonymized, rows retained with reason, and the erasure confirmation flag.
9. Download the erasure result JSON as evidence.
10. Notify the subject in writing that erasure was completed, listing what was erased and what was retained with legal basis.

**Contact for escalation:** sekretariat@nemocnicasnina.sk / IT department
