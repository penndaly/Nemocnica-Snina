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
