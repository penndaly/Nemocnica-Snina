/**
 * Default clinical alert thresholds (Sprint W5), keyed by LOINC code.
 *
 * These are the fallback when no patient-specific `device_alert_thresholds` row
 * exists. Per-patient overrides are clinician-configurable (never hardcoded for a
 * patient) — see WearablesService.setThresholds. `null` means "no bound on that
 * side" (e.g. SpO2 has no high/critical-high).
 */
export interface ThresholdSet {
  high: number | null;
  low: number | null;
  criticalHigh: number | null;
  criticalLow: number | null;
}

export const DEFAULT_THRESHOLDS: Record<string, ThresholdSet> = {
  '14745-4': { high: 10.0, low: 3.9, criticalHigh: 15.0, criticalLow: 3.0 },  // Glucose mmol/l
  '8867-4':  { high: 120,  low: 40,  criticalHigh: 150,  criticalLow: 30 },   // Heart rate bpm
  '8480-6':  { high: 160,  low: 85,  criticalHigh: 180,  criticalLow: 70 },   // Systolic BP mmHg
  '8462-4':  { high: 100,  low: 50,  criticalHigh: 120,  criticalLow: 40 },   // Diastolic BP mmHg
  '59408-5': { high: null, low: 92,  criticalHigh: null, criticalLow: 88 },   // SpO2 %
};

export type AlertFlag = 'normal' | 'high' | 'low' | 'critical';
export type ExceededThreshold = 'high' | 'low' | 'critical_high' | 'critical_low' | null;

export interface AlertResult {
  flag: AlertFlag;
  exceeded: ExceededThreshold;
}

/** Classify a numeric value against a threshold set. Critical bounds win. */
export function classify(value: number, t: ThresholdSet): AlertResult {
  if (t.criticalHigh !== null && value >= t.criticalHigh) return { flag: 'critical', exceeded: 'critical_high' };
  if (t.criticalLow !== null && value <= t.criticalLow) return { flag: 'critical', exceeded: 'critical_low' };
  if (t.high !== null && value >= t.high) return { flag: 'high', exceeded: 'high' };
  if (t.low !== null && value <= t.low) return { flag: 'low', exceeded: 'low' };
  return { flag: 'normal', exceeded: null };
}
