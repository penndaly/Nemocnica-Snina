/**
 * Telehealth seed — Sprint S6 (T0.1)
 *
 * Sets telehealth:true on pilot clinics (interne, fro, angiology) and their
 * physicians, and seeds the telehealth landing-page hero copy into the
 * pages-content singleton.
 *
 * Idempotent: PATCH is used for clinics/physicians (update by slug);
 * PUT is used for the singleton.
 *
 * Usage (after Strapi is running):
 *   STRAPI_URL=http://localhost:1337 \
 *   STRAPI_API_TOKEN=<admin-api-token> \
 *   npx ts-node apps/cms/seed/seed-telehealth.ts
 */

const BASE  = process.env['STRAPI_URL']       ?? 'http://localhost:1337';
const TOKEN = process.env['STRAPI_API_TOKEN'] ?? '';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api/${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function put(path: string, data: unknown): Promise<void> {
  const res = await fetch(`${BASE}/api/${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PUT ${path} failed: ${res.status} ${err}`);
  }
}

// Pilot clinic slugs that receive telehealth: true
const TELEHEALTH_CLINIC_SLUGS = ['interne', 'fro', 'angiology'];

async function enableTelehealthForClinic(slug: string) {
  const res = await get<{ data: Array<{ id: number; attributes: { slug: string } }> }>(
    `clinics?filters[slug][$eq]=${slug}&locale=sk`,
  );
  const clinic = res.data[0];
  if (!clinic) {
    console.warn(`  clinic not found: ${slug}`);
    return;
  }
  await put(`clinics/${clinic.id}`, { telehealth: true });
  console.log(`  clinic ${slug} → telehealth: true`);

  // Enable telehealth on physicians in this clinic
  const physRes = await get<{ data: Array<{ id: number; attributes: { name: string } }> }>(
    `physicians?filters[clinic][slug][$eq]=${slug}&locale=sk&pagination[pageSize]=100`,
  );
  for (const physician of physRes.data) {
    await put(`physicians/${physician.id}`, { telehealth: true });
    console.log(`    physician ${physician.attributes.name} → telehealth: true`);
  }
}

async function seedTelehealthPageHero() {
  await put('pages-content', {
    telehealthHeroBadge: 'Videokonzultácia · Video consultation',
    telehealthHeroTitle: 'Lekárska konzultácia online — z pohodlia domova',
    telehealthHeroSubtitle:
      'Poraďte sa s naším lekárom bezpečne a pohodlne cez video. Platné elektronické recepty, odporúčania a zdravotná dokumentácia — bez čakárne.',
  });
  console.log('  pages-content singleton → telehealth hero seeded (SK)');
}

async function main() {
  console.log('Sprint S6 — Telehealth seed\n');

  console.log('Clinics + physicians:');
  for (const slug of TELEHEALTH_CLINIC_SLUGS) {
    await enableTelehealthForClinic(slug);
  }

  console.log('\nTelehealth landing-page hero:');
  await seedTelehealthPageHero();

  console.log('\nDone. Run again safely — PATCH/PUT operations are idempotent.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
