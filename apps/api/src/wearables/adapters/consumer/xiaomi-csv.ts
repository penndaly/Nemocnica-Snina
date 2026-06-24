/**
 * Xiaomi / Mi Fitness GDPR-export CSV parser (pure — no I/O).
 *
 * The patient exports their data from Mi Fitness (Settings → Privacy → Export)
 * and uploads the resulting .zip. We parse three known CSVs (others ignored):
 *
 *   ACTIVITY_STAGE.csv  → steps      (55423-8)
 *   SLEEP_STAGE.csv     → sleep min  (93832-4)
 *   HEART_RATE.csv      → bpm        (8867-4)
 *
 * Malformed rows are skipped with a description (never throw — partial import is
 * acceptable). Files above MAX_ROWS are rejected by the caller before parsing.
 */
import type { RawReading } from '../../platform-adapter.interface';

export const MAX_ROWS = 10_000;

export interface XiaomiParseResult {
  readings: RawReading[];
  skipped: number;
  errors: string[];
}

interface ColumnSpec {
  metricType: string;
  unit: string;
  sk: string;
  en: string;
  valueColumn: string;
  /** Build the recorded-at timestamp from a CSV row. */
  timestamp: (row: Record<string, string>) => Date;
}

const FILE_SPECS: Record<string, ColumnSpec> = {
  'ACTIVITY_STAGE.csv': {
    metricType: '55423-8', unit: 'steps', sk: 'Kroky', en: 'Steps', valueColumn: 'steps',
    timestamp: (r) => new Date(`${r.date}T${r.startTime ?? '00:00:00'}`),
  },
  'SLEEP_STAGE.csv': {
    metricType: '93832-4', unit: 'min', sk: 'Spánok', en: 'Sleep', valueColumn: 'duration_min',
    timestamp: (r) => new Date(`${r.date}T${r.startTime ?? '00:00:00'}`),
  },
  'HEART_RATE.csv': {
    metricType: '8867-4', unit: 'bpm', sk: 'Tep', en: 'Heart rate', valueColumn: 'heartRate',
    timestamp: (r) => new Date(`${r.date}T${r.time ?? '00:00:00'}`),
  },
};

/** The base filename (without path) of a CSV we know how to parse. */
export function isKnownXiaomiCsv(filename: string): boolean {
  return base(filename) in FILE_SPECS;
}

function base(filename: string): string {
  return filename.split('/').pop() ?? filename;
}

function splitCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(',').map((c) => c.trim()));
}

/**
 * Parse one Xiaomi CSV file's text into readings. `errors` describes skipped
 * rows; `skipped` counts them. Unknown filenames yield an empty result.
 */
export function parseXiaomiCsv(filename: string, text: string): XiaomiParseResult {
  const spec = FILE_SPECS[base(filename)];
  const result: XiaomiParseResult = { readings: [], skipped: 0, errors: [] };
  if (!spec) return result;

  const rows = splitCsv(text);
  if (rows.length === 0) return result;

  const header = rows[0];
  const valueIdx = header.indexOf(spec.valueColumn);
  const dataRows = rows.slice(1);

  dataRows.forEach((cells, i) => {
    const rowNum = i + 2; // 1-based, +1 for header
    const row: Record<string, string> = {};
    header.forEach((h, idx) => (row[h] = cells[idx] ?? ''));

    const raw = valueIdx >= 0 ? cells[valueIdx] : '';
    const value = Number(raw);
    if (raw === '' || !Number.isFinite(value)) {
      result.skipped++;
      result.errors.push(`Row ${rowNum}: invalid ${spec.valueColumn} value "${raw}"`);
      return;
    }
    const recordedAt = spec.timestamp(row);
    if (Number.isNaN(recordedAt.getTime())) {
      result.skipped++;
      result.errors.push(`Row ${rowNum}: unparseable date`);
      return;
    }
    result.readings.push({
      metricType: spec.metricType,
      metricLabel: { sk: spec.sk, en: spec.en },
      valueNumeric: value,
      unit: spec.unit,
      recordedAt,
    });
  });

  return result;
}
