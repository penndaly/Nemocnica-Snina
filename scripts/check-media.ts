/**
 * CI gate for assets/img/index.json — run via:
 *   npx ts-node --project tsconfig.base.json scripts/check-media.ts
 *
 * Checks (any failure exits 1, printing every offending slot — not just the
 * first one, so a single CI run surfaces the whole punch list):
 *   1. index.json parses as JSON.
 *   2. Every entry's src/webp/avif file actually exists under assets/img/.
 *   3. Every entry has both sk and en alt text (non-empty).
 *   4. No file exceeds its weight budget — 400 KB for hero-ratio slots
 *      (21/6, 21/8, or explicitly listed as a hero id), 250 KB otherwise.
 *      Checked against the .avif variant, since that's what actually ships.
 *   5. No `doc-*` entry exists — physician portraits stay real-photo-only
 *      (IMG_1_PLACEHOLDER_PHOTOGRAPHY.md §2), never a placeholder slot.
 */
import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const IMG_DIR = join(__dirname, '..', 'design_handoff_nemocnica_snina', 'assets', 'img');
const INDEX_PATH = join(IMG_DIR, 'index.json');

const HERO_IDS = new Set([
  'home-campus', 'about-hero', 'patients-hero', 'careers-hero', 'education-hero',
  'departments-hero', 'clinics-hero', 'diagnostics-hero', 'services-hero',
  'physicians-hero', 'news-hero', 'contact-hero', 'telehealth-hero',
  'booking-hero', 'teleconsult-hero', 'disclosure-hero',
]);
const HERO_BUDGET_KB = 400;
const INPAGE_BUDGET_KB = 250;

interface MediaEntry {
  src: string;
  webp: string;
  avif: string;
  alt: { sk?: string; en?: string };
  pos?: string;
  placeholder?: boolean;
  credit?: string;
}

const errors: string[] = [];

if (!existsSync(INDEX_PATH)) {
  console.error(`FAIL: ${INDEX_PATH} does not exist.`);
  process.exit(1);
}

let index!: Record<string, MediaEntry>;
try {
  index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
} catch (e) {
  console.error(`FAIL: assets/img/index.json does not parse: ${(e as Error).message}`);
  process.exit(1);
}

for (const [slotId, entry] of Object.entries(index)) {
  if (slotId.startsWith('doc-')) {
    errors.push(`${slotId}: doc-* slots must never appear in index.json (physician portraits are real-photo-only, IMG_1 §2)`);
    continue;
  }

  for (const key of ['src', 'webp', 'avif'] as const) {
    const rel = entry[key];
    if (!rel) {
      errors.push(`${slotId}: missing "${key}" field`);
      continue;
    }
    const abs = join(IMG_DIR, rel);
    if (!existsSync(abs)) {
      errors.push(`${slotId}: ${key} file not found: assets/img/${rel}`);
    }
  }

  if (!entry.alt?.sk?.trim()) errors.push(`${slotId}: missing sk alt text`);
  if (!entry.alt?.en?.trim()) errors.push(`${slotId}: missing en alt text`);

  if (entry.avif) {
    const avifPath = join(IMG_DIR, entry.avif);
    if (existsSync(avifPath)) {
      const kb = statSync(avifPath).size / 1024;
      const budget = HERO_IDS.has(slotId) ? HERO_BUDGET_KB : INPAGE_BUDGET_KB;
      if (kb > budget) {
        errors.push(`${slotId}: avif is ${kb.toFixed(0)} KB, over the ${budget} KB budget (${HERO_IDS.has(slotId) ? 'hero' : 'in-page'} slot)`);
      }
    }
  }
}

if (errors.length) {
  console.error(`FAIL: ${errors.length} media check violation(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`OK: ${Object.keys(index).length} media entries checked, 0 violations.`);
