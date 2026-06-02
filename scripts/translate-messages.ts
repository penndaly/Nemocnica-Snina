/**
 * Translates apps/web/src/messages/sk.json into cs/pl/hu/uk using
 * Google Cloud Translation API v3.
 *
 * Usage:
 *   GOOGLE_CLOUD_PROJECT=my-project \
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *   npx ts-node --project tsconfig.base.json scripts/translate-messages.ts
 *
 * Keys that should NOT be translated (proper nouns, codes) are preserved.
 * A glossary named "ns-medical-glossary" is applied when available — create
 * it in Cloud Console with terms like "rodné číslo", "eDohoda", "Nemocnica
 * Snina", "APS", "GDPR" etc. to stop the translator mangling them.
 *
 * The script writes the translated files in-place and prints a diff summary.
 * Run it again at any time — it is idempotent if sk.json hasn't changed.
 */

import fs from 'fs';
import path from 'path';
import { TranslationServiceClient } from '@google-cloud/translate';

const PROJECT  = process.env['GOOGLE_CLOUD_PROJECT'] ?? '';
const LOCATION = 'global';
const GLOSSARY_ID = process.env['TRANSLATION_GLOSSARY_ID'] ?? 'ns-medical-glossary';
const GLOSSARY_NAME = PROJECT
  ? `projects/${PROJECT}/locations/${LOCATION}/glossaries/${GLOSSARY_ID}`
  : '';

// Keys whose values must never be translated (kept verbatim from sk.json).
// These are proper nouns or technical strings.
const DO_NOT_TRANSLATE = new Set([
  'brand.name',   // "Nemocnica Snina" — proper noun
  'brand.sub',    // subtitle — translated manually
  'footer.admin', // admin label — keep SK; admin is staff-only
]);

const TARGETS: Array<{ locale: string; bcp47: string }> = [
  { locale: 'cs', bcp47: 'cs' },
  { locale: 'pl', bcp47: 'pl' },
  { locale: 'hu', bcp47: 'hu' },
  { locale: 'uk', bcp47: 'uk' },
];

const MESSAGES_DIR = path.resolve(__dirname, '../apps/web/src/messages');
const SK_FILE      = path.join(MESSAGES_DIR, 'sk.json');

// ── Helpers ────────────────────────────────────────────────

/** Flatten a nested object into dotted key → value pairs */
function flatten(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

/** Rebuild a nested object from dotted key → value pairs */
function unflatten(flat: Record<string, string>): unknown {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]!;
      if (typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]!] = val;
  }
  return out;
}

// ── Main ───────────────────────────────────────────────────

async function main() {
  if (!PROJECT) {
    console.error('GOOGLE_CLOUD_PROJECT is not set — aborting.');
    process.exit(1);
  }

  const client = new TranslationServiceClient();
  const skRaw  = JSON.parse(fs.readFileSync(SK_FILE, 'utf-8')) as unknown;
  const flat   = flatten(skRaw);

  // Split keys into translatable and verbatim
  const toTranslate  = Object.entries(flat).filter(([k]) => !DO_NOT_TRANSLATE.has(k));
  const verbatimKeys = Object.entries(flat).filter(([k]) =>  DO_NOT_TRANSLATE.has(k));
  const texts        = toTranslate.map(([, v]) => v);

  for (const { locale, bcp47 } of TARGETS) {
    console.log(`\nTranslating → ${bcp47} ...`);

    const [response] = await client.translateText({
      parent:         `projects/${PROJECT}/locations/${LOCATION}`,
      contents:       texts,
      mimeType:       'text/plain',
      sourceLanguageCode: 'sk',
      targetLanguageCode: bcp47,
      ...(GLOSSARY_NAME ? {
        glossaryConfig: {
          glossary: GLOSSARY_NAME,
          ignoreCase: true,
        },
      } : {}),
    });

    const translations =
      GLOSSARY_NAME
        ? (response.glossaryTranslations ?? response.translations ?? [])
        : (response.translations ?? []);

    const translatedFlat: Record<string, string> = {};

    toTranslate.forEach(([key], i) => {
      translatedFlat[key] = translations[i]?.translatedText ?? flat[key]!;
    });
    verbatimKeys.forEach(([key, val]) => {
      translatedFlat[key] = val;
    });

    const nested = unflatten(translatedFlat);
    const outPath = path.join(MESSAGES_DIR, `${locale}.json`);
    fs.writeFileSync(outPath, JSON.stringify(nested, null, 2) + '\n', 'utf-8');
    console.log(`  Written ${outPath}`);
  }

  console.log('\nDone. Review the output files and commit.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
