# DPIA Addendum — Wearables & Remote Monitoring
## Data controller: Nemocnica Snina, s.r.o.

> Sprint W6 deliverable. Extends the platform DPIA for the wearables &
> remote-monitoring module. Must be reviewed and signed by the DPO before
> `WEARABLES_ENABLED=true` in production (see LAUNCH_CHECKLIST.md §L9).

### Lawful basis
Special category health data (GDPR Art. 9) — explicit consent (Art. 9(2)(a)).
Per-device, per-purpose consent is captured (`data_storage` required;
`physician_sharing` and `his_export` optional) and is withdrawable at any time via
`/portal/wearables/sublas`. No automated clinical decisions are made (Art. 22 N/A).

### Data categories

| Data | Category | LOINC / standard | Retention |
|---|---|---|---|
| CGM glucose readings | Art. 9 health | 14745-4 | 90 days or until FHIR export |
| ECG waveforms | Art. 9 health | 11524-6 | 90 days or until FHIR export |
| Pacemaker telemetry | Art. 9 health | custom | Partnership agreement required |
| Blood pressure | Art. 9 health | 85354-9 / 8480-6 / 8462-4 | 90 days or until FHIR export |
| Heart rate | Art. 9 health | 8867-4 | 90 days or until FHIR export |
| SpO₂ | Art. 9 health | 59408-5 | 90 days or until FHIR export |
| Steps / activity | Lifestyle | 55423-8 | 90 days |
| OAuth tokens (encrypted) | Technical | — | Until revoked |
| Consent audit rows | Legal evidence | — | 5 years (Art. 5(2)) |

Patient identity is never stored in wearables tables — only the opaque
`patient_token` (eID-derived), mirroring `telehealth_sessions`. OAuth access /
refresh tokens are AES-256-GCM encrypted at rest (`WEARABLES_TOKEN_KEY`).

### Third-party processors (signed DPA required before live sync)

| Vendor | Platform | EU hosting | DPA status | SCC required |
|---|---|---|---|---|
| Abbott | FreeStyle Libre 3 | ✅ EU (LibreView EU) | ⬜ pending | No |
| Dexcom | G7 / ONE+ | ✅ EU sandbox | ⬜ pending | No |
| Withings | Health API | ✅ FR | ⬜ pending | No |
| Fitbit / Google | Fitbit Web API | ❌ US | ⬜ pending | ✅ Yes — SCCs required |
| Garmin | Health API | ❌ US | ⬜ pending | ✅ Yes — SCCs required |
| Samsung | Samsung Health | ❌ US | ⬜ pending | ✅ Yes — SCCs required |
| Huawei | Health Kit | ❌ CN | ⬜ BLOCKED | ✅ BLOCKED until EU adequacy |
| Meta | Wellbeing API | ❌ US | ⬜ pending | ✅ Yes — SCCs required |

Until each DPA/SCC is in place the platform must remain on `WEARABLES_PROVIDER=mock`
or `partnership_required=true`. Huawei live sync is blocked until an EU adequacy
decision or signed SCCs.

### Automated decisions
Alert thresholds flag readings for **human physician review only**. No automated
clinical decisions are taken. Art. 22 does not apply.

### Cardiac implant platforms (partnership required)
Medtronic MyCareLink, Abbott Merlin.net, Boston Scientific Latitude NXT remain
`partnership_required=true` (adapters refuse `connect`) until signed vendor
partnership agreements are in place. Contacts:
- mycarelink-api@medtronic.com
- cardiovascular.digital@abbott.com
- rpmpartner@bsci.com

### Security measures (implemented in W6)
- OAuth state CSRF protection (HMAC-signed, one-time, TTL'd, platform-bound).
- OAuth token rotation before expiry; refresh failure raises an in-app
  notification (no SMS — avoids leaking device existence to a phone).
- Webhook HMAC-SHA1 signature verification (constant-time) + per-IP rate limiting;
  raw token values are never logged (body hash only).
- Physician access scoped to an active care relationship within
  `WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS`; cross-patient reads are rejected.
- Critical-alert SMS contains only the device label + first 8 chars of the
  opaque token — never the RC or full token.
