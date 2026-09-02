# Sprint W5 — Clinical Alerts, Physician View & FHIR Export
## Nemocnica Snina · Wearables & Remote Monitoring

**Branch:** `feature/wearables-w5-alerts-physician`  
**Depends on:** W4 ✅ merged (portal wired, consent management live)  
**Design references:**
- `portal.html` — portal notification bell (to extend for wearable alerts)
- `design_handoff_nemocnica_snina/TELEMEDICINE_BUILD_GUIDE.md §T3.1` (HIS queue pattern)
- Alert thresholds schema defined in W1 (`device_alert_thresholds` table)

---

## Paste this into Claude Code before starting

```
Read the following files in full before writing any code:

1. apps/api/src/wearables/wearables.service.ts (W1 stubs to implement)
2. apps/api/src/wearables/wearables.controller.ts (W1 — add physician endpoint)
3. apps/api/src/his/his-sync.consumer.ts (pattern for HIS RabbitMQ consumer)
4. design_handoff_nemocnica_snina/TELEMEDICINE_BUILD_GUIDE.md §T3.1 (FHIR queue topology)
5. apps/api/src/wearables/ (all W1 files — understand the full module)
6. portal.html (notification area, if present, to extend for alert badges)

Execute Sprint W5 only. Stop and report Done-when criteria before starting W6.
```

---

## Non-negotiables

- Critical alerts (glucose, HR, BP at critical thresholds) must emit SMS within 60 s.
- FHIR Observation export is idempotent: if `fhir_observation_id` already set, skip.
- Readings with `fhir_observation_id` are NEVER deleted, even on consent withdrawal.
- Physician view gated by: `share_with_physician=true` AND `device_consent physician_sharing=granted` AND active appointment relationship within `WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS` (default 90 days).
- Threshold changes: clinician role only; every change writes `audit_log`.
- No raw patient identifiers (RC) on any alert SMS or log line.

---

## Part A — Alert engine (`apps/api/src/wearables/alert.service.ts`)

```typescript
evaluateReading(reading: DeviceReading, device: WearableDevice): AlertResult
  1. Load device_alert_thresholds for (patient_token, metric_type).
     Fallback to DEFAULT_THRESHOLDS if no patient-specific row exists.
  2. Compare value_numeric against thresholds (high, low, critical_high, critical_low).
  3. Return: { flag: 'normal'|'high'|'low'|'critical', exceeded: ThresholdType|null }
  4. If flag='critical': emit wearables.alert.critical to RabbitMQ (immediate routing key).
  5. If flag='high'|'low' AND share_with_physician=true:
       batch into wearables.alert.batch (aggregated digest every 15 min).

// Seed these defaults via apps/api/prisma/seed.ts:
DEFAULT_THRESHOLDS = {
  '14745-4': { high:10.0, low:3.9, critical_high:15.0, critical_low:3.0 },  // Glucose mmol/l
  '8867-4':  { high:120,  low:40,  critical_high:150,  critical_low:30  },  // Heart rate bpm
  '8480-6':  { high:160,  low:85,  critical_high:180,  critical_low:70  },  // Systolic BP mmHg
  '8462-4':  { high:100,  low:50,  critical_high:120,  critical_low:40  },  // Diastolic BP mmHg
  '59408-5': { high:null, low:92,  critical_high:null,  critical_low:88 },  // SpO2 %
}

// Hook evaluateReading into the sync pipeline:
// In WearablesService.processSyncedReadings(): call evaluateReading for each new reading.
```

---

## Part B — Alert RabbitMQ consumers (`apps/api/src/wearables/alert.consumer.ts`)

```typescript
// Queue: wearables.alert.critical (immediate, priority routing)
// Triggered by evaluateReading when flag='critical'
@RabbitSubscribe({ exchange: 'ns.wearables', routingKey: 'wearables.alert.critical' })
async handleCriticalAlert(msg: CriticalAlertPayload):
  1. Look up physician phone (via appointment relationship → physicians table).
  2. SmsService.send(physician.phone,
       `[Nemocnica Snina] KRITICKÉ: ${device.device_label} — ${metric} ${value}${unit}. Pacient: ${patient_token.slice(0,8)}…`)
     (never include full patient_token or RC in SMS)
  3. Create portal notification:
       portal_notifications INSERT (patient_token, type='wearable_alert', severity='critical',
         device_id, metric_type, value, flag, created_at)
  4. audit_log: action='wearable_alert_critical', actor='system', meta={metric,value,flag}

// Queue: wearables.alert.batch (15-min aggregated digest)
@RabbitSubscribe({ exchange: 'ns.wearables', routingKey: 'wearables.alert.batch' })
async handleBatchAlerts(msg: BatchAlertPayload):
  - Group by physician; send one digest SMS per physician per 15-min window.
  - Max 3 readings listed per SMS; append "…and N more" if exceeded.
  - audit_log: action='wearable_alert_batch', count=N
```

---

## Part C — FHIR Observation export (extend `apps/api/src/his/his-sync.consumer.ts`)

```typescript
// Consume: wearables.readings.synced
// Emitted by sync job (W2/W3) after each successful platform sync.

@RabbitSubscribe({ exchange: 'ns.wearables', routingKey: 'wearables.readings.synced' })
async exportToFhir(msg: ReadingsSyncedPayload):
  For each reading where share_with_physician=true AND fhir_observation_id IS NULL:

    Build FHIR R4 Observation:
    {
      resourceType: 'Observation',
      status: 'final',
      category: [{ coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: device.category === 'medical' ? 'vital-signs' : 'activity'
      }]}],
      code: { coding: [{ system: 'http://loinc.org', code: reading.metric_type }] },
      subject: { reference: 'Patient/' + patient_fhir_id },
      effectiveDateTime: reading.recorded_at,
      valueQuantity: { value: reading.value_numeric, unit: reading.unit,
                       system: 'http://unitsofmeasure.org' },
      device: { display: device.device_label }
    }

    POST to HIS FHIR R4 endpoint (same base URL as T3.1).
    On 2xx: UPDATE device_readings SET fhir_observation_id = response.id WHERE id = reading.id
    On failure: write to DLQ (max 3 retries, exponential backoff); NEVER delete reading.
    Idempotent guard: SELECT fhir_observation_id WHERE id = reading.id; skip if not null.

  // Purge guard (GDPR retention):
  // Readings with consent withdrawn AND fhir_observation_id IS NULL AND
  // created_at < NOW() - INTERVAL 'WEARABLES_GDPR_RETENTION_DAYS days'
  // → soft-delete (set superseded_by = self, do not hard delete)
```

---

## Part D — Physician API endpoint (extend `apps/api/src/wearables/wearables.controller.ts`)

```typescript
// GET /api/wearables/physician/:patientToken  (clinician JWT required)
// Returns wearable summary for a specific patient.

getPhysicianView(patientToken: string, physicianId: string):
  1. Validate: physician has appointment OR telehealth session with patientToken
     within last WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS days.
     If not: throw ForbiddenException('PHYSICIAN_ACCESS_DENIED').
  2. Validate: device_consent type='physician_sharing' granted=true exists for patient.
  3. For each device where share_with_physician=true:
     - Most recent 10 readings (sorted by recorded_at DESC)
     - Alerts in last 7 days (from portal_notifications where type='wearable_alert')
     - fhir_observation_id export status per reading
  4. Return: PhysicianWearableViewDto

// PUT /api/wearables/physician/:patientToken/thresholds  (clinician JWT, role=physician)
setThresholds(patientToken, metric_type, thresholds: ThresholdPayload):
  - Upsert device_alert_thresholds row.
  - audit_log: action='threshold_updated', actor=physicianId, meta=thresholds
  - Throw ForbiddenException if role !== 'physician'.
```

---

## Part E — Physician portal page (`apps/web/src/app/admin/patients/[patientToken]/wearables/page.tsx`)

```
SSR: getPhysicianView(patientToken) — throws 403 if physician has no relationship.

Layout (4 sections):

1. Summary cards row — one card per metric type across all devices:
   [Glucose: 5.8 mmol/l · normal] [HR: 72 bpm · normal] [BP: 128/82 mmHg · normal]
   Each card: latest value + flag badge + device name + "X min ago"
   Critical flag → card border-top: 4px solid var(--red)

2. Alert history timeline — last 7 days:
   Each alert row: time-ago · device · metric · value · severity badge (critical/high/low)
   Empty state: "No alerts in the last 7 days" with green check icon

3. Per-device panel (one collapsible per device):
   - Device header + Active/Error badge + last sync time
   - Trend sparkline (SVG, 24 most recent readings, min/max normalised 0–100%)
     Draw as an SVG polyline; dots at high/critical readings (amber/red fill)
   - Last 10 readings table: time | metric | value | unit | flag | FHIR status
   - "Export to HIS" button (manual trigger):
     → POST /api/wearables/devices/:id/export-fhir → poll until fhir_observation_id set
     → button becomes disabled + "In HIS" chip on each row exported

4. Threshold editor side panel (slide-in, width 360px):
   Opens via "Set thresholds" button (top-right)
   One threshold group per connected metric type:
   ┌─────────────────────────────────────┐
   │ Glucose (LOINC 14745-4) mmol/l      │
   │ High:          [10.0]               │
   │ Low:           [3.9 ]               │
   │ Critical high: [15.0]               │
   │ Critical low:  [3.0 ]               │
   └─────────────────────────────────────┘
   Save button → PUT /api/wearables/physician/:token/thresholds
   Confirmation toast on success; audit_log written server-side.
   Non-physician role → button hidden; endpoint returns 403.
```

---

## Part F — Portal notification panel (extend existing portal UI)

```
Add alert notification bell to portal header (lucide-react: Bell).
Badge count = unread portal_notifications where type='wearable_alert' AND read_at IS NULL.
Dropdown panel (max-height 400px, scroll):
  Each alert: severity icon + device + metric + value + time-ago
  Mark as read on panel open: PATCH /api/notifications/read-all?type=wearable_alert
  "View all in Wearables" link → /[lang]/portal/wearables

Add wearable alert state to the portal Overview tab:
  If any critical alert in last 24h → show red banner card at top of overview:
  "Critical wearable alert — [Glucose 15.1 mmol/l · Abbott Libre · 2h ago] — View readings →"
```

---

## Part G — Tests

```
Unit tests (alert.service.spec.ts):
  - evaluateReading: glucose 15.1 mmol/l → flag='critical', emits wearables.alert.critical
  - evaluateReading: glucose 9.0 mmol/l → flag='high', emits wearables.alert.batch
  - evaluateReading: glucose 5.8 mmol/l → flag='normal', emits nothing
  - evaluateReading: patient-specific threshold (8.0 high) overrides default (10.0)
  - SpO2 94% → flag='low'; SpO2 87% → flag='critical'

Unit tests (his-sync.consumer.spec.ts):
  - FHIR export: reading without fhir_observation_id → Observation POSTed → id saved
  - FHIR export: idempotent — reading WITH fhir_observation_id → no second POST
  - FHIR export: 3 consecutive 5xx → DLQ written; reading NOT deleted
  - FHIR export: consent withdrawn + fhir_observation_id set → reading preserved

Unit tests (wearables.controller.spec.ts):
  - Physician with no appointment relationship → 403 PHYSICIAN_ACCESS_DENIED
  - Physician with expired relationship (91 days) → 403
  - Physician with active relationship → 200 with devices
  - Non-physician role → PUT /thresholds → 403

E2E (Playwright):
  WR-W5-1  Critical glucose reading injected (16.0 mmol/l) →
           wearables.alert.critical consumed → SmsService mock called →
           alert badge appears in physician portal (poll max 10 s).
  WR-W5-2  Sync produces new reading → wearables.readings.synced →
           FHIR sandbox has Observation with LOINC 14745-4 →
           device_readings.fhir_observation_id populated.
           Re-run → idempotent (no duplicate Observation).
  WR-W5-3  Physician sets glucose high threshold to 8.0 →
           audit_log row present → reading at 8.5 triggers alert.
  WR-W5-4  Physician with no relationship (different patient token) → 403.
```

---

## Done when

- [ ] `evaluateReading` correctly classifies all threshold cases
- [ ] Critical alert emits SMS via SmsService mock within 60 s of reading insertion
- [ ] FHIR Observations written to HIS sandbox with correct LOINC codes
- [ ] FHIR export idempotent (WR-W5-2 green)
- [ ] Physician view gated by appointment relationship (WR-W5-4 green)
- [ ] Threshold editor saves + writes audit_log; non-physician blocked
- [ ] Portal notification bell shows unread alert count
- [ ] WR-W5-1 through WR-W5-4 green
- [ ] All unit tests green
