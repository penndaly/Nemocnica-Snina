/**
 * Machine-translate Strapi CMS content (SK → cs/pl/hu/uk) via Google Cloud Translation v3.
 *
 * IMPORTANT — CLINICAL SAFETY RULE:
 *   All machine-translated entries are created as DRAFTS in Strapi (enforced by
 *   the lifecycle hook in apps/cms/src/index.js).
 *   Human review is REQUIRED before any translated content can be published.
 *   The script prints a checklist of entries that need review after it runs.
 *
 * Prerequisites:
 *   - Strapi is running and STRAPI_API_TOKEN is set (admin token with create+update)
 *   - GOOGLE_CLOUD_PROJECT + credentials are configured
 *   - Google Cloud Translation glossary "ns-medical-glossary" exists with:
 *     Nemocnica Snina, eDohody, APS, LSPP, HIS, FHIR, GDPR, RC, SVaLZ, VšZP
 *
 * Usage:
 *   GOOGLE_CLOUD_PROJECT=my-project \
 *   STRAPI_URL=http://localhost:1337 \
 *   STRAPI_API_TOKEN=<admin-token> \
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *   npx ts-node --project tsconfig.base.json scripts/translate-cms-content.ts
 *
 *   Add --dry-run to preview without writing to Strapi.
 *   Add --collection=departments to translate a single collection.
 */

import { TranslationServiceClient } from '@google-cloud/translate';

const PROJECT   = process.env['GOOGLE_CLOUD_PROJECT'] ?? '';
const LOCATION  = 'global';
const GLOSSARY_ID = process.env['TRANSLATION_GLOSSARY_ID'] ?? 'ns-medical-glossary';
const GLOSSARY_NAME = PROJECT
  ? `projects/${PROJECT}/locations/${LOCATION}/glossaries/${GLOSSARY_ID}`
  : '';

const STRAPI_URL = process.env['STRAPI_URL']      ?? 'http://localhost:1337';
const TOKEN      = process.env['STRAPI_API_TOKEN'] ?? '';
const DRY_RUN    = process.argv.includes('--dry-run');
const ONLY_COL   = process.argv.find((a) => a.startsWith('--collection='))?.split('=')[1];

const TARGETS: Array<{ locale: string; bcp47: string }> = [
  { locale: 'cs', bcp47: 'cs' },
  { locale: 'pl', bcp47: 'pl' },
  { locale: 'hu', bcp47: 'hu' },
  { locale: 'uk', bcp47: 'uk' },
];

// Collections + localizable text fields
const COLLECTIONS: Array<{ api: string; fields: string[] }> = [
  { api: 'departments', fields: ['name', 'short', 'summary', 'desc', 'visiting', 'leadRole'] },
  { api: 'clinics',     fields: ['name', 'specialty', 'location', 'bookingRule'] },
  { api: 'services',    fields: ['name', 'desc'] },
  { api: 'news-items',  fields: ['tag', 'title', 'body'] },
  { api: 'facilities',  fields: ['name', 'kind', 'desc'] },
];

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

async function fetchAll(api: string): Promise<Array<{ id: number; attributes: Record<string, unknown> }>> {
  const res = await fetch(`${STRAPI_URL}/api/${api}?locale=sk&pagination[pageSize]=100`, { headers });
  if (!res.ok) throw new Error(`Strapi GET ${api}: HTTP ${res.status}`);
  return ((await res.json()) as { data: Array<{ id: number; attributes: Record<string, unknown> }> }).data;
}

async function upsertLocale(api: string, skId: number, locale: string, data: Record<string, string>): Promise<void> {
  if (DRY_RUN) { console.log(`  [dry-run] would POST /api/${api}/${skId}/localizations locale=${locale}`); return; }

  // Check if localization already exists
  const checkRes = await fetch(`${STRAPI_URL}/api/${api}/${skId}?locale=${locale}`, { headers });
  if (checkRes.ok) {
    // Exists — update (PATCH)
    const existing = ((await checkRes.json()) as { data: { id: number } }).data;
    await fetch(`${STRAPI_URL}/api/${api}/${existing.id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ data: { ...data, locale } }),
    });
  } else {
    // Create localization
    await fetch(`${STRAPI_URL}/api/${api}/${skId}/localizations`, {
      method: 'POST', headers,
      body: JSON.stringify({ ...data, locale }),
    });
  }
}

async function translateTexts(client: TranslationServiceClient, texts: string[], targetBcp47: string): Promise<string[]> {
  if (!texts.length) return [];
  const parent = `projects/${PROJECT}/locations/${LOCATION}`;

  const [response] = await client.translateText({
    parent,
    contents: texts,
    mimeType: 'text/plain',
    sourceLanguageCode: 'sk',
    targetLanguageCode: targetBcp47,
    ...(GLOSSARY_NAME ? {
      glossaryConfig: { glossary: GLOSSARY_NAME, ignoreCase: true },
    } : {}),
  });

  const translations = GLOSSARY_NAME
    ? (response.glossaryTranslations ?? response.translations ?? [])
    : (response.translations ?? []);

  return translations.map((t) => t.translatedText ?? '');
}

async function main() {
  if (!PROJECT) { console.error('GOOGLE_CLOUD_PROJECT not set'); process.exit(1); }
  if (!TOKEN)   { console.error('STRAPI_API_TOKEN not set');      process.exit(1); }

  if (DRY_RUN) console.log('DRY RUN — nothing will be written to Strapi.\n');
  if (!GLOSSARY_NAME) console.warn('WARNING: No glossary configured. Medical terms may be mistranslated.\n');

  const client = new TranslationServiceClient();
  const reviewNeeded: string[] = [];

  const collections = ONLY_COL
    ? COLLECTIONS.filter((c) => c.api === ONLY_COL)
    : COLLECTIONS;

  for (const { api, fields } of collections) {
    console.log(`\n── ${api} ──`);
    const entries = await fetchAll(api);

    for (const entry of entries) {
      const attrs = entry.attributes;
      const texts = fields.map((f) => String(attrs[f] ?? ''));

      for (const { locale, bcp47 } of TARGETS) {
        const translated = await translateTexts(client, texts, bcp47);
        const data: Record<string, string> = {};
        fields.forEach((f, i) => { data[f] = translated[i] ?? ''; });

        await upsertLocale(api, entry.id, locale, data);
        console.log(`  ${locale}: ${api}/${entry.id} → draft (needs review)`);
        reviewNeeded.push(`${api}[${entry.id}] ${locale}`);
      }
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`CLINICAL REVIEW REQUIRED for ${reviewNeeded.length} entries:`);
  console.log('These entries are in DRAFT status in Strapi.');
  console.log('A human reviewer must verify clinical accuracy and publish each entry.');
  console.log(`${'─'.repeat(60)}`);
  reviewNeeded.forEach((r) => console.log(`  ✗ ${r}`));
  console.log('\nOpen Strapi admin → Content Manager → select a locale → review → Publish.');
}

main().catch((err) => { console.error(err); process.exit(1); });
