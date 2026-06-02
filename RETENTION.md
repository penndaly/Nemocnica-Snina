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
