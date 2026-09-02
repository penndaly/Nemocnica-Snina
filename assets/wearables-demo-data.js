/* =========================================================
   WEARABLES DEMO DATA — Nemocnica Snina Patient Portal
   =========================================================
   ⚠️  PROTOTYPE ONLY — REMOVE FOR PRODUCTION
   ─────────────────────────────────────────────────────────
   To remove:
     1. Delete this file.
     2. Remove the <script src="assets/wearables-demo-data.js"> line from portal.html.
     3. Replace the synchronous WEARABLES reference in the portal script with
        the async API fetch (see Sprint W4 in SPRINT_BACKLOG_WEARABLES.md).

   Production endpoint this replaces:
     GET /api/wearables?patient=me
     → { devices: WearableDevice[], available: AvailablePlatform[] }

   Response shape is identical to the WEARABLES constant below.
   See SPRINT_BACKLOG_WEARABLES.md § W1 for the full schema.
   ========================================================= */

// Sentinel — production code can guard on this:
//   if (!window.NS_WEARABLES_DEMO) { /* fetch from API */ }
window.NS_WEARABLES_DEMO = true;

/* ── Demo: 3 devices pre-connected for patient Jozef Mak ─────────────────
   Chosen to match his active diagnoses (hypertension I10, T2DM E11):
     w1  Abbott FreeStyle Libre 3  — continuous glucose monitor (CGM)
     w2  Apple Watch Series 10     — heart rate / ECG / steps / SpO₂
     w3  Withings ScanWatch 2      — blood pressure / sleep
   ─────────────────────────────────────────────────────────────────────── */
const WEARABLES = {

  /* connected devices (FHIR DeviceUseStatement + Observation stream) */
  devices: [
    {
      id:       "w1",
      brand:    "Abbott",
      model:    "FreeStyle Libre 3",
      type:     "cgm",          /* continuous glucose monitor */
      category: "medical",
      status:   "active",
      icon:     "glucose",
      lastSync: new Date(Date.now() - 5 * 60000).toISOString(),
      readings: [
        {
          time:   new Date(Date.now() - 5 * 60000).toISOString(),
          metric: { sk: "Glukóza", en: "Glucose" },
          value:  "5.8",
          unit:   "mmol/l",
          flag:   "normal"   /* FHIR Observation LOINC 14745-4 */
        },
        {
          time:   new Date(Date.now() - 65 * 60000).toISOString(),
          metric: { sk: "Glukóza", en: "Glucose" },
          value:  "7.2",
          unit:   "mmol/l",
          flag:   "normal"
        }
      ]
    },
    {
      id:       "w2",
      brand:    "Apple",
      model:    "Watch Series 10",
      type:     "smartwatch",
      category: "consumer",
      status:   "active",
      icon:     "watch",
      lastSync: new Date(Date.now() - 12 * 60000).toISOString(),
      readings: [
        {
          time:   new Date(Date.now() - 12 * 60000).toISOString(),
          metric: { sk: "Tepová frekvencia", en: "Heart rate" },
          value:  "72",
          unit:   "bpm",
          flag:   "normal"   /* FHIR Observation LOINC 8867-4 */
        },
        {
          time:   new Date(Date.now() - 30 * 60000).toISOString(),
          metric: { sk: "Kroky (dnes)", en: "Steps (today)" },
          value:  "1 240",
          unit:   "",
          flag:   "normal"   /* FHIR Observation LOINC 55423-8 */
        },
        {
          time:   new Date(Date.now() - 2 * 3600000).toISOString(),
          metric: { sk: "EKG", en: "ECG" },
          value:  "Sinus rhythm",
          unit:   "",
          flag:   "normal"   /* FHIR Observation LOINC 11524-6 */
        },
        {
          time:   new Date(Date.now() - 8 * 3600000).toISOString(),
          metric: { sk: "SpO\u2082", en: "SpO\u2082" },
          value:  "97",
          unit:   "%",
          flag:   "normal"   /* FHIR Observation LOINC 59408-5 */
        }
      ]
    },
    {
      id:       "w3",
      brand:    "Withings",
      model:    "ScanWatch 2",
      type:     "hybrid",
      category: "consumer",
      status:   "active",
      icon:     "heart",
      lastSync: new Date(Date.now() - 45 * 60000).toISOString(),
      readings: [
        {
          time:   new Date(Date.now() - 45 * 60000).toISOString(),
          metric: { sk: "Krvn\u00fd tlak", en: "Blood pressure" },
          value:  "128/82",
          unit:   "mmHg",
          flag:   "normal"   /* FHIR Observation LOINC 85354-9 */
        },
        {
          time:   new Date(Date.now() - 8 * 3600000).toISOString(),
          metric: { sk: "Sp\u00e1nok", en: "Sleep" },
          value:  "6h 40min",
          unit:   "",
          flag:   "normal"   /* FHIR Observation LOINC 93831-6 */
        }
      ]
    }
  ],

  /* ── All supported platforms — shown in "Connect a device" panel ──── */
  available: [

    /* ── Medical-grade devices ─────────────────────────────────────── */
    /* CGM — continuous glucose monitors */
    { brand: "Abbott",            model: "FreeStyle Libre 3 / 2+",        category: "medical",  type: "cgm"       },
    { brand: "Dexcom",            model: "G7 / ONE+",                     category: "medical",  type: "cgm"       },
    { brand: "Medtronic",         model: "Guardian 4 CGM",                category: "medical",  type: "cgm"       },
    /* Cardiac implants — remote telemonitoring */
    { brand: "Medtronic",         model: "MyCareLink (pacemaker)",        category: "medical",  type: "pacemaker" },
    { brand: "Abbott",            model: "Merlin.net (ICD / PM)",         category: "medical",  type: "pacemaker" },
    { brand: "Boston Scientific", model: "Latitude NXT",                  category: "medical",  type: "pacemaker" },
    /* ECG */
    { brand: "AliveCor",          model: "KardiaMobile 6L",               category: "medical",  type: "ecg"       },
    /* Blood pressure */
    { brand: "Withings",          model: "BPM Connect Pro",               category: "medical",  type: "bp"        },
    { brand: "Omron",             model: "Evolv / Complete",              category: "medical",  type: "bp"        },

    /* ── Consumer / fitness platforms ──────────────────────────────── */
    /* Note: Apple HealthKit requires a native iOS companion app.       */
    /* Google / Samsung use Health Connect (Android 9+).               */
    /* Huawei requires EMUI/HarmonyOS Health Kit SDK.                  */
    /* Xiaomi has no public OAuth API; data via GDPR export endpoint.  */
    /* Meta Ray-Ban activity data is limited to steps + light activity. */
    { brand: "Apple",    model: "Watch (watchOS Health)",        category: "consumer", type: "smartwatch" },
    { brand: "Samsung",  model: "Galaxy Watch (Samsung Health)", category: "consumer", type: "smartwatch" },
    { brand: "Google",   model: "Pixel Watch (Google Health)",   category: "consumer", type: "smartwatch" },
    { brand: "Fitbit",   model: "Sense / Charge (Google Fit)",   category: "consumer", type: "fitness"    },
    { brand: "Garmin",   model: "Health Sync (Connect IQ)",      category: "consumer", type: "fitness"    },
    { brand: "Huawei",   model: "Watch GT / Band (Health App)",  category: "consumer", type: "smartwatch" },
    { brand: "Xiaomi",   model: "Smart Band / Watch (Mi Fit)",   category: "consumer", type: "fitness"    },
    { brand: "Withings", model: "ScanWatch / Body+",             category: "consumer", type: "hybrid"     },
    { brand: "Meta",     model: "Ray-Ban Smart Glasses",         category: "consumer", type: "other"      }
  ]
};
