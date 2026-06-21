# MDR 2017/745 Scope Exclusion Statement
## Nemocnica Snina Patient Portal & Telemedicine Platform

**Document version:** 1.0  
**Effective date:** 2026-06-21  
**Owner:** Quality / Regulatory Lead  
**Review cycle:** Annual, or upon any change to platform functionality listed in §3 (Scope review triggers)

---

## 1. Statement of exclusion

This software — comprising the Nemocnica Snina patient-facing web portal, appointment booking system, administrative CMS, and telemedicine (video consultation) module — is a **human-to-human communication and administrative coordination tool**.

It does **not** perform any autonomous clinical decision-making, diagnostic, therapeutic, or monitoring functions.

Accordingly, this software is **excluded from the scope of Regulation (EU) 2017/745 on medical devices (MDR)** per MDCG Guidance 2019-11 ("Guidance on qualification and classification of software in Regulation (EU) 2017/745 — MDR and Regulation (EU) 2017/746 — IVDR"), section 3.

No CE marking under MDR is required for this software in its current configuration.

---

## 2. Evidence: what this software does and does not do

### 2.1 What this software does (in-scope functions)

The following functions are implemented in the platform:

| Function | Description |
|---|---|
| **Appointment booking** | Patients select a clinic, physician, and available time slot. Booking rules (days, windows, referral requirement) are validated server-side. No clinical recommendation is made. |
| **SMS OTP confirmation** | One-time-password authentication for booking confirmation. |
| **New-patient application (eDohody)** | Administrative form for patient registration. Submitted to hospital staff for review; no automated clinical decision is made. |
| **Video consultation facilitation** | A secure video channel (LiveKit SFU, EU-hosted) is established between a named physician and a verified patient. The platform connects the two parties — it does not interpret, analyse, or advise on clinical content. |
| **Pre-consultation intake questionnaire** | Patients submit free-text symptoms and current medications. This information is displayed to the physician — it is not processed by any algorithm. |
| **Post-call summary display** | Physician-authored clinical notes are displayed in the patient portal after a consultation. The notes are authored entirely by the licensed physician. |
| **Clinical record display (read-only)** | FHIR R4 resources (Condition, MedicationRequest, Observation) from the Hospital Information System are displayed to the authenticated patient. The platform does not modify or derive clinical conclusions from this data. |
| **Administrative CMS** | Hospital staff manage content (department pages, physician profiles, news). No clinical function. |
| **Staff admin tools** | Booking management, GDPR data subject request handling, audit log review. No clinical function. |

### 2.2 What this software explicitly does NOT do

The following functions are **not implemented** and are **explicitly excluded** from the platform architecture:

| Excluded function | Rationale |
|---|---|
| Clinical decision support algorithms | No rule engine, scoring system, or recommendation engine acts on patient data. |
| Diagnostic analysis (including AI/ML) | No model, classifier, or algorithm interprets symptoms, imaging, lab values, or any clinical input to produce a diagnosis or differential. |
| Autonomous treatment recommendations | All clinical recommendations are made exclusively by the licensed physician during or after a consultation. The platform transmits those recommendations — it does not generate them. |
| Therapeutic control functions | The platform does not control, adjust, or interact with any therapeutic device or infusion system. |
| Vital-sign monitoring or alerting | Self-reported vitals in the intake form are free-text notes passed to the physician — they are not parsed, monitored, or used to trigger clinical alerts. |
| Prognostic modelling | No mortality, risk, or disease-progression models are implemented. |
| Drug interaction or dosage calculation | No pharmacological computation is performed. |
| Diagnostic imaging analysis | No imaging data is processed, displayed, or analysed by the platform. |

---

## 3. Regulatory basis for exclusion

- **MDCG Guidance 2019-11**, Section 3.3: Software that is intended only for administrative or communication purposes does not constitute a medical device under MDR.
- **MDR 2017/745 Article 2(1)**: A medical device must be "intended by the manufacturer to be used ... for the purpose of ... diagnosis, prevention, monitoring, prediction, prognosis, treatment or alleviation of disease." None of the functions listed in §2.1 satisfy this criterion; all clinical purposes are fulfilled by the licensed physician, not the software.
- **MDCG Guidance 2019-11**, Section 3.5: "Software that is only used to display data without any transformation of the data does not qualify as a medical device."

---

## 4. Scope review triggers

This exclusion statement must be **reviewed and re-evaluated** if any of the following changes are introduced to the platform:

1. **Integration of AI/ML clinical decision support** — any model that analyses patient-provided data (symptoms, vitals, intake text, imaging) and returns a clinical suggestion, diagnosis, or risk score.
2. **Automated diagnostic imaging analysis** — integration with any DICOM viewer or imaging AI service where the platform processes or annotates imaging data.
3. **Therapeutic control functions** — integration with any device that adjusts treatment parameters (e.g. insulin pump, infusion controller, CPAP adjustment) based on platform data.
4. **Autonomous alerting on vital-sign thresholds** — any feature that parses patient-reported or device-reported vitals and sends a clinical alert without physician intervention.
5. **Predictive risk scoring** — any feature that produces a numeric or categorical risk score for a clinical outcome (e.g. readmission risk, fall risk, deterioration index).

If any of the above is planned, the Quality/Regulatory Lead must initiate a fresh MDR qualification assessment **before development begins**, in accordance with MDCG Guidance 2019-11 §4.

---

## 5. Version control and annual review

This document is reviewed annually by the Quality/Regulatory Lead and confirmed as accurate. Review history:

| Version | Review date | Reviewer | Outcome |
|---|---|---|---|
| 1.0 | 2026-06-21 | [TO BE SIGNED — see §6] | Initial exclusion confirmed |

---

## 6. Signature

This statement is issued by the Quality/Regulatory Lead of Nemocnica Snina, s.r.o., who confirms that the software described herein has been evaluated against MDR 2017/745 and MDCG Guidance 2019-11 and is excluded from the scope of that Regulation in its current configuration.

```
Signed: ___________________   Date: ___________
Quality / Regulatory Lead, Nemocnica Snina, s.r.o.
```

This statement must be retained as part of the technical file and made available to competent authorities upon request.
