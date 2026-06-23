# Production Architecture — Nemocnica Snina

This document recommends how to build the production system that the prototype represents. It synthesises the two planning documents (Google Cloud / multilingual plan + the technical architecture report) into concrete, Claude-Code-ready guidance. Treat the prototype as the front-end spec; treat this as the back-end + integration spec.

## Recommended stack
- **Frontend:** Next.js (App Router) + React + TypeScript. SSR/SSG for SEO and fast first paint; locale-prefixed routes (`/sk`, `/en`, …) for proper `hreflang`. Tailwind CSS (port the prototype tokens into `tailwind.config`) or CSS variables — either works; the prototype already isolates all tokens.
- **Headless CMS:** Strapi (Node/TS, self-hostable in EU) or Drupal (strong granular permissions, common in healthcare). The CMS owns all public content. Map the prototype's `assets/admin.js` `SCHEMAS`/`SINGLETONS` and `DATA_MODEL.md` directly into CMS collection types. Decoupling public content from patient data improves the security posture.
- **Application/API:** Node.js (NestJS) or Laravel (PHP). Laravel is common in SK enterprise and has solid XML/SOAP support for NCZI. Exposes booking, onboarding (eDohody), and patient-portal APIs.
- **Database:** PostgreSQL (appointments, users, bookings, audit log). Redis (Memorystore) for sessions + caching clinic availability and translated strings.
- **Infra:** Host within the EU (Decree 179/2020). Nginx load balancing/edge cache; CDN for static + translated HTML. TLS 1.3 in transit, AES-256 at rest. Encrypted daily backups, 3-2-1, geo-separate EU location.

> The prototype's `localStorage` `DB` (`assets/data.js`) is the stand-in for "CMS + PostgreSQL via API". Replace every `DB.*` call with API/CMS queries.

## Multilingual (6 languages: sk, cs, pl, hu, uk, en)
- Use ISO 639-1 codes; locale-prefixed URLs (`hospital.eu/uk/…`) — **not** cookie/IP redirection (Googlebot won't index hidden locales).
- Inject reciprocal `<link rel="alternate" hreflang="x">` per page.
- Translation pipeline: Google Cloud Translation **Advanced (v3)** / Adaptive (LLM) for high-risk clinical text; **Custom Glossaries** to lock brand/department/clinical terms; aggressive caching (Redis app-layer + CDN edge) to control cost. SK/EN are authored by hand (already in `data.js`); machine-assist the other four with human review for clinical pages.
- The prototype's `{sk,en}` field shape generalises to `{sk,cs,pl,hu,uk,en}` — extend `L()` and the CMS locale set; no structural change.

## Core functional modules (from the audit)
1. **Promotional portal (CMS):** dynamic news/alerts, doctor directory with "Accepting new patients" + spoken languages, department/clinic pages, virtual tour slots. Prototype covers all of these.
2. **Intelligent scheduling:** OTP/SMS auth, **referral (výmenný lístok) validation** for specialist clinics, **clinic-specific time-slot rules** (already modelled — see `clinics[].bookingDays`, `bookingWindow`, `referral`, `status`), unique booking ID via SMS, one-click cancel. Validate `rodné číslo` with the modulo-11 algorithm.
3. **New-patient onboarding (eDohody):** capacity check → digital application → staff review (accept/reject) → on accept, generate the **NCZI eDohoda XML** (Patient RC, insurer code, doctor code, validity date) and notify patient to sign (eID).
4. **Results & portal:** 2FA-protected lab-result PDF download; patient portal mapped to **FHIR R4** resources (Condition / MedicationRequest / Observation — names already used in `portal.html`).

## Integrations
- **HIS:** no direct web→HIS DB writes. Web booking → API Gateway → **async queue (RabbitMQ)** → internal sync agent → HIS via **HL7 v2 / FHIR**. Queue so bookings survive outages.
- **NCZI:** eObjednanie (REST/FHIR) for future national-scheduling sync; eDohody XML schema as above.
- **e-VÚC (Prešov region / PSK):** consume the regional API to display the live **APS "who's on duty"** schedule — zero manual maintenance, legally accurate. (`pages.aps` in the prototype is the placeholder for this.)
- **SMS gateway:** booking confirmations, reminders (48–72h prior), cancel links, OTP.
- **Payments:** PCI-compliant gateway for paid certificates/documents and any LSPP fees.

## Security & compliance (non-negotiable)
- **GDPR + Act 18/2018:** lawful basis (contract necessity for booking; Art. 9 safeguards for health data), granular opt-in consent, data minimisation (keep only name/contact/booking time on the web tier; clinical detail stays in HIS).
- **Cybersecurity Decree 179/2020:** TLS 1.3, AES-256 at rest, **MFA for all admin/clinician accounts**, immutable audit log (who accessed which record, when).
- **Accessibility Act (351/2022):** WCAG 2.1 AA — keyboard nav, screen-reader support, contrast, high-contrast toggle + text-resize widget, ARIA on all forms (esp. booking). The prototype is built to AA; keep it there.

## Suggested phasing
1. **Discovery & infra (wk 1–4):** confirm HIS API capabilities, EU hosting, DPO drafts privacy/cookie text. Stand up CMS + DB; import `data.js` as seed.
2. **Core build (wk 5–12):** promotional pages + doctor directory (from prototype); scheduling engine with per-clinic rules; SMS gateway.
3. **Advanced + testing (wk 13–16):** eDohody XML; VAPT pen-test; automated a11y audits (WAVE/Lighthouse).
4. **Pilot & launch (wk 17–20):** train reception/secretariat on admin; soft-launch booking for one clinic (FRO); full launch.

## Mapping cheat-sheet (prototype → production)
| Prototype | Production |
|---|---|
| `assets/data.js` `SEED` | DB seed / CMS initial content |
| `assets/admin.js` `SCHEMAS` | CMS collection/content-type definitions |
| `DB.list/find/upsert/remove` | REST/GraphQL endpoints + repository layer |
| `Site.mount()` chrome | shared layout component + i18n provider |
| booking `state` machine | server-validated booking service + availability lock + SMS token |
| `portal.html` mock records | FHIR R4 client against Cloud Healthcare API / HIS |
| admin password `admin` | OIDC + MFA, role-based access (editor / clinician / admin) |
