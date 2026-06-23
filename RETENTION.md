# Data Retention Policy — Nemocnica Snina

This document describes how long each category of personal data is retained on the **web tier**, the lawful basis for each period, and what happens when a data-subject erasure request (Art. 17 GDPR) is processed.

Clinical records (diagnoses, medications, lab results) are held by the Hospital Information System (HIS) and are outside the scope of this document. For clinical records, contact the HIS data controller.

---

## Retention schedule

| Data category | Table(s) | Retention period | Lawful basis | Erasure handling |
|---|---|---|---|---|
| Booking records (name, phone, RC hash, slot) | `bookings` | **5 years** from booking date | Act 431/2002 (Accounting Act) — financial transaction record | Anonymized on DSAR erasure: name → `[ERASED]`, phone → `000000000`, RC hash → `[ERASED]`. Slot/date/clinic retained for financial reconciliation. |
| New-patient applications (eDohody) | `onboarding_applications` | **5 years** from application date | Act 431/2002; healthcare contract formation | Anonymized on erasure: name/RC/phone/email cleared. Physician ID and status retained. |
| SMS OTP records | `sms_otps` | **90 days** after expiry | Legitimate interest (security incident investigation) | Deleted by scheduled job at 90 days. Purged immediately on erasure request. |
| Staff user accounts | `staff_users` | Duration of employment + **1 year** | Contract necessity (employment) | Deactivated on termination; deleted on request after 1-year retention. |
| Audit log entries | `audit_log` | **5 years** (append-only) | Decree 179/2020 — immutable security audit trail; cannot be shortened | **Retained through erasure requests.** Entries referencing a subject's data are kept but the subject's identifier is not stored in audit entries (only booking/application IDs). |
| GDPR consent records | stored in `bookings.gdprConsent` | Same as booking record | Legal obligation (GDPR Art. 7(1) — demonstrate consent) | Retained through erasure (consent proof must outlive the booking). |

---

## Erasure process

1. DPO receives a verified Art. 17 request from the data subject.
2. Admin-role operator opens `/admin/gdpr`, enters the subject's RC.
3. System anonymizes all matching records (see table above) in a single transaction.
4. An immutable audit log entry is written recording: operator, timestamp, rows anonymized, rows retained with reason.
5. The operator downloads the erasure result and retains it as evidence of compliance.
6. The operator notifies the subject in writing.

For clinical records: the operator forwards the request to the HIS data controller separately.

---

## Scheduled jobs

| Job | Table | Action | Frequency |
|---|---|---|---|
| OTP cleanup | `sms_otps` | `DELETE WHERE expiresAt < NOW() - INTERVAL '90 days'` | Daily |
| Booking anonymization sweep | `bookings` | Anonymize where `createdAt < NOW() - INTERVAL '5 years'` | Monthly |
| Application sweep | `onboarding_applications` | Same | Monthly |

These jobs run under the `ns_app` role. They do **not** touch `audit_log`.

---

## Cross-border transfers

All personal data is processed within the EU (hosting EU, Decree 179/2020). No data is transferred to third countries. Google Cloud Translation processes only non-personal UI strings (department names, UI labels) — not patient data.

---

## Medical records (HIS obligation)

> FHIR Encounter in HIS = 20 years (Act 576/2004 §24) — this is the HIS vendor's obligation; our DB holds operational metadata only.

The Nemocnica Snina web/API tier does **not** hold the authoritative medical record. Clinical records (diagnoses, medications, lab results, FHIR Encounter resources generated during in-person and telehealth consultations) are held by the Hospital Information System (HIS) and governed by Act 576/2004 §24, which mandates a minimum 20-year retention period. The HIS vendor must confirm this obligation in writing before go-live (see LAUNCH_CHECKLIST.md §L7).

---

## Telehealth data retention

Sprint S6 addition. **Critical distinction (Act 576/2004 §24):** the rows in our PostgreSQL DB are operational metadata. The authoritative medical record is the FHIR Encounter written to HIS.

| Data category | Table(s) | Retention period | Lawful basis | Notes |
|---|---|---|---|---|
| Video session metadata | `telehealth_sessions` | **5 years** from session `created_at` | Act 576/2004 — healthcare operational records | Operational metadata only. FHIR Encounter in HIS (20 years) is the authoritative medical record. `patient_token` is opaque — no RČ or personal identifier stored. |
| Pre-call intake questionnaire | `telehealth_intake` | **5 years** (with session) | Act 576/2004 — pre-consultation questionnaire | Pre-call questionnaire; no diagnosis or clinical assessment stored. Clinical detail goes to HIS via FHIR. |
| Post-call summary PDF files (`pdf_path`) | `telehealth_summaries.pdf_path` | **7 days** after `his_synced = true` | Portal display cache — HIS is the authoritative copy | `pdf_path` files are purged 7 days after successful HIS sync. **Never purge if `his_synced = false`.** |
| Post-call summary rows | `telehealth_summaries` | **5 years** from `created_at` | Act 576/2004 | DB rows retained 5 years; only `pdf_path` files are subject to the 7-day purge. |
| FHIR Encounter (teleconsultation) | HIS (external) | **20 years** (Act 576/2004 §24) | Act 576/2004 §24 — medical record | HIS vendor obligation. Must be confirmed in writing before go-live (see LAUNCH_CHECKLIST.md §L7). |
| FHIR MedicationRequest (e-prescription) | HIS + NCZI eZdravie | **20 years** | Act 362/2011 — prescription record | NCZI eZdravie is the legally valid prescription. FHIR is the HIS copy. |
| Video join tokens | `sessionStorage` (browser) | Ephemeral — session end | Data minimisation (GDPR Art. 5(1)(e)) | Never persisted to DB or server storage beyond session lifetime. |

**Non-negotiable guard (DB-level + application-layer):**

> `telehealth_summaries` rows where `his_synced = false` must **never** be eligible for purge — these hold the only copy of the clinical record until HIS sync completes. Any scheduled job must check `his_synced = true` before purging `pdf_path` files or cascade-deleting the parent session row.

### Telehealth scheduled jobs

| Job | Table | Action | Frequency | Guard |
|---|---|---|---|---|
| PDF file purge | `telehealth_summaries` | Delete `pdf_path` files where `his_synced = true` AND session `ended_at < NOW() - INTERVAL '7 days'` | Daily | Skip all rows where `his_synced = false`; raise alert on any skipped rows |
| Session/intake sweep | `telehealth_sessions`, `telehealth_intake` | Anonymise/delete where `created_at < NOW() - INTERVAL '5 years'` | Monthly | Abort and alert if linked `telehealth_summaries.his_synced = false` |
| Summary sweep | `telehealth_summaries` | Delete where `created_at < NOW() - INTERVAL '5 years'` AND `his_synced = true` | Monthly | Never touch rows where `his_synced = false` |

## Wearables & remote monitoring data retention (Sprint W6)

| Data | Retention | Basis |
|---|---|---|
| `device_readings` (no consent) | 0 days | Deleted on consent withdrawal |
| `device_readings` (consented, not synced) | 90 days | `WEARABLES_GDPR_RETENTION_DAYS` |
| `device_readings` (FHIR synced) | Indefinite | Authoritative copy held in HIS — never deleted here |
| `device_consent` audit rows | 5 years | GDPR accountability (Art. 5(2)) |
| OAuth tokens (AES-256-GCM encrypted) | Until revoked | Technical necessity |
| Alert SMS content | 30 days | Incident investigation |

### Wearables scheduled jobs

| Job | Table | Action | Frequency | Guard |
|---|---|---|---|---|
| Reading purge | `device_readings` | Soft-delete (`superseded_by = self`) where consent withdrawn AND `fhir_observation_id IS NULL` AND `created_at < NOW() - INTERVAL 'WEARABLES_GDPR_RETENTION_DAYS days'` | Daily | NEVER touch rows where `fhir_observation_id` is set |
| Consent re-confirmation | `wearable_devices` | Flag devices with `connected_at < NOW() - 12 months` and no consent event in 12 months; suspend (`sync_status = 'pending'`) after a 30-day grace | Daily | Notification raised before suspension |
