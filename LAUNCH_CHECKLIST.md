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
