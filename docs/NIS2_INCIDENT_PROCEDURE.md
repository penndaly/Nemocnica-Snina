# NIS2 Cybersecurity Incident Response Procedure
## Nemocnica Snina, s.r.o.

**Document version:** 1.0  
**Effective date:** 2026-06-21  
**Owner:** DPO + IT Lead  
**Review cycle:** Annual, or after any Severity Critical or High incident

---

## 1. Scope and regulatory basis

Nemocnica Snina, s.r.o. operates as an **essential entity** within the meaning of:

- **Directive (EU) 2022/2555 (NIS2)** — Article 3(1)(b): providers of healthcare services classified as essential entities in Member States.
- **Slovak Act 69/2018 on cybersecurity** (Zákon č. 69/2018 Z.z. o kybernetickej bezpečnosti), as amended, implementing NIS2 in Slovak law.

This procedure governs all cybersecurity incidents affecting the Nemocnica Snina patient portal, telemedicine platform, booking system, admin CMS, API, and supporting infrastructure. Compliance with this procedure is mandatory for all IT staff, the DPO, and contracted third-party operators.

---

## 2. Severity classification

| Severity | Definition | Examples |
|---|---|---|
| **Critical** | Full or near-total service outage; confirmed patient data breach; ransomware or destructive malware; HIS (Hospital Information System) unavailable; active exfiltration of personal or clinical data | Ransomware encrypting database volumes; confirmed unauthorised access to `bookings` or `telehealth_summaries` tables; HIS sync agent down with unsynced `his_synced = false` records; full web/API unavailability > 30 min |
| **High** | Partial but significant data exposure; telemedicine failure affecting a patient during an active consultation; authentication/MFA system compromise; RCE or privilege escalation vulnerability confirmed exploited in production | Single clinic's booking data exported by unauthorised party; LiveKit SFU failure mid-consultation; TOTP MFA bypass confirmed; SQL injection payload executed against the API |
| **Medium** | Single-service degradation without confirmed data exposure; failed HIS sync persisting > 1 hour; APS bus feed failure; suspected (unconfirmed) intrusion | RabbitMQ queue backlog > 1 hour with unsynced telehealth summaries; APS e-VÚC PSK feed returning errors; anomalous login pattern detected but not confirmed as compromise |
| **Low** | Minor service hiccup with no data impact, no patient harm, self-resolving or quickly resolved | Single failed SMS OTP delivery; transient 502 on one API route returning within 5 min; failed non-critical scheduled job |

---

## 3. Reporting timelines (NIS2 / Act 69/2018)

| Window | Action | Recipient |
|---|---|---|
| **0–24 hours** from detection | Initial alert notification — incident detected, nature, approximate scope, immediate containment measures taken | NKIBK (National Cyber Security Centre Slovakia) |
| **0–72 hours** from detection | Detailed incident report — confirmed scope, affected systems, data categories affected, patient impact assessment, timeline of events, containment status | NKIBK |
| **Ongoing until resolved** | Progress updates every **24 hours** — updated scope, additional findings, remediation status | NKIBK |
| **Within 1 month of closure** | Final post-incident report — root cause analysis, timeline, impact, remediation completed, control improvements | NKIBK + internal retention |

Timelines start from the moment IT Lead or DPO **becomes aware** of the incident — not from the moment of initial detection by automated tooling.

---

## 4. NKIBK contact details

> **[TO BE FILLED BY OPS before go-live]**
>
> NKIBK — Národné centrum kybernetickej bezpečnosti SK-CERT  
> Email: nkibk@nbu.gov.sk  
> Phone: +421 2 6869 2344  
> Incident reporting portal: [https://www.nbu.gov.sk/kyberneticka-bezpecnost/sk-cert/](https://www.nbu.gov.sk/kyberneticka-bezpecnost/sk-cert/)

Confirm current contact details with NKIBK at least annually. This section must be updated with direct contact names before the platform goes live.

---

## 5. Internal escalation chain

**Joint incident owners: DPO and IT Lead.** Both must be notified immediately on any Severity Critical or High incident. Neither may act unilaterally on patient data decisions during an incident.

| Role | Responsibility | Contact |
|---|---|---|
| **IT Lead** | Technical containment, forensics, infrastructure isolation, vendor engagement | [TO BE FILLED BY OPS] |
| **DPO (Data Protection Officer)** | GDPR Art. 33/34 assessment, NKIBK notification, patient notification decision | [TO BE FILLED BY OPS] |
| **Hospital Director** | Executive approval for patient notification, media response, HIS vendor escalation | [TO BE FILLED BY OPS] |
| **Legal Counsel** | Regulatory liaison, liability assessment | [TO BE FILLED BY OPS] |
| **HIS Vendor Contact** | HIS-side containment, FHIR Encounter integrity verification | [TO BE FILLED BY OPS] |

**On-call paging:** For out-of-hours Critical incidents, IT Lead and DPO must both be reachable by phone. Confirm on-call rotation is documented in the ops runbook.

---

## 6. Incident response phases

### Phase 1 — Detection and triage (0–2 hours)

1. Incident detected via monitoring alert, staff report, or user complaint.
2. IT Lead assesses severity using the classification table in §2.
3. If Severity Critical or High: DPO notified immediately; Hospital Director notified within 1 hour.
4. Incident log opened (append-only; no entries may be deleted).
5. Initial containment action taken (isolate affected service, revoke compromised credentials, disable affected endpoint).

### Phase 2 — Containment and assessment (2–24 hours)

1. Scope confirmed: which systems, which data categories, which patients (if any).
2. NKIBK initial alert sent (0–24h window; see §3).
3. Evidence preserved: database dumps, log snapshots, network captures. Do not overwrite or delete logs.
4. GDPR Art. 33 assessment: does the incident constitute a personal data breach? If yes, formal breach record opened.
5. If GDPR Art. 34 applies (high risk to patient rights and freedoms): patient notification decision made (see §7).

### Phase 3 — Detailed reporting (24–72 hours)

1. Detailed incident report submitted to NKIBK (72h window; see §3).
2. Affected services partially or fully restored with enhanced monitoring.
3. Any compromised credentials rotated; MFA tokens re-enrolled where affected.

### Phase 4 — Recovery and monitoring

1. Full service restoration verified by end-to-end functional testing.
2. Enhanced logging and alerting maintained for 30 days post-incident.
3. 24-hour update cycle to NKIBK continued until incident is officially closed.

---

## 7. Patient notification (GDPR Art. 34)

A data breach must be communicated **directly to affected patients** when it is likely to result in a **high risk to their rights and freedoms**. This includes, but is not limited to:

- Confirmed exfiltration of booking records containing name, phone, or RC hash.
- Confirmed exposure of telemedicine intake or summary data.
- Breach of `staff_users` credentials enabling access to patient-linked records.

**Notification must be made without undue delay** after the decision to notify is taken jointly by the DPO and Hospital Director.

Content of patient notification (GDPR Art. 34(2)):
1. Name and contact details of the DPO.
2. Description of the nature of the breach.
3. Likely consequences of the breach.
4. Measures taken or proposed to address the breach.
5. Recommended protective steps the patient can take.

Notification channel: registered email address on file for portal users; postal letter for booking-only patients without portal accounts.

---

## 8. Telemedicine-specific incident triggers

The following events related to the telemedicine module are automatically classified as **High or Critical** and must be escalated immediately to IT Lead and DPO:

| Trigger | Default severity | Notes |
|---|---|---|
| LiveKit SFU failure during an active patient consultation | High | Physician must be notified to contact patient via phone backup |
| `TELEHEALTH_RECORDING_ENABLED` flag set to `true` in any environment without DPO approval (`TELEHEALTH_RECORDING_DPO_APPROVED=true`) | Critical | Unlawful recording; immediate rollback required; DPO must assess whether any recording occurred |
| TURN server confirmed as routing patient video/audio outside the EU | Critical | GDPR Art. 46 violation; session must be terminated; DPO must assess breach under Art. 33 |
| `patient_token` exposed in logs, error responses, or client-side output | High | Assess whether `patient_token` can be correlated to a real identity; if yes, escalate to Critical |
| `telehealth_summaries` rows with `his_synced = false` found in a purge batch | Critical | Abort purge immediately; escalate to HIS vendor; clinical record may be at risk of loss |
| MFA re-verification bypassed at physician join endpoint | Critical | Potential impersonation; audit all sessions joined without valid MFA re-verify |

---

## 9. Post-incident (within 30 days of closure)

1. **Post-mortem conducted** by IT Lead and DPO — written report covering: timeline, root cause, contributing factors, patient impact, control gaps identified.
2. **Runbook updated** — any procedure that failed or was unclear during the incident is updated before the post-mortem is filed.
3. **Affected controls retested** — penetration test or targeted security test of the control that failed (e.g. if auth was bypassed, retest auth hardening).
4. **Report filed** — post-mortem stored in append-only incident log; copy to Hospital Director and Legal Counsel.
5. **NKIBK final report submitted** (see §3, 1-month window).

---

## 10. Document control

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-06-21 | IT Lead / DPO | Initial draft — Sprint S4 compliance documentation |

This document must be reviewed annually and after any Severity Critical or High incident. Approval signatures:

```
Signed (IT Lead): ___________________   Date: ___________

Signed (DPO):     ___________________   Date: ___________

Signed (Director): __________________   Date: ___________
```
