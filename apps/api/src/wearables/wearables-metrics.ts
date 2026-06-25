/**
 * Metric catalogue (Sprint A4) — bridges the LOINC codes the alert engine keys on
 * to the human labels shown in the admin "Default thresholds" table. The global
 * threshold table (wearable_global_thresholds) is keyed by `loinc`.
 */
export interface MetricCatalogEntry {
  loinc: string;
  key: string; // semantic id used in the admin UI / docs
  label: string;
  unit: string;
}

export const METRIC_CATALOG: MetricCatalogEntry[] = [
  { loinc: '14745-4', key: 'glucose_mmol', label: 'Glucose', unit: 'mmol/l' },
  { loinc: '8867-4', key: 'heart_rate_bpm', label: 'Heart rate', unit: 'bpm' },
  { loinc: '8480-6', key: 'systolic_bp_mmhg', label: 'Systolic BP', unit: 'mmHg' },
  { loinc: '8462-4', key: 'diastolic_bp_mmhg', label: 'Diastolic BP', unit: 'mmHg' },
  { loinc: '59408-5', key: 'spo2_pct', label: 'SpO₂', unit: '%' },
];

export function metricByLoinc(loinc: string): MetricCatalogEntry | undefined {
  return METRIC_CATALOG.find((m) => m.loinc === loinc);
}

/** Accept either the LOINC code or the semantic key; return the LOINC code. */
export function resolveMetricKey(input: string): string | undefined {
  const byLoinc = METRIC_CATALOG.find((m) => m.loinc === input);
  if (byLoinc) return byLoinc.loinc;
  const byKey = METRIC_CATALOG.find((m) => m.key === input);
  return byKey?.loinc;
}
