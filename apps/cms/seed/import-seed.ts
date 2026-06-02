/**
 * Strapi seed importer — reads SEED from design_handoff and POSTs
 * each record to the Strapi REST API as SK locale entries.
 *
 * Usage (after Strapi is running):
 *   STRAPI_URL=http://localhost:1337 \
 *   STRAPI_API_TOKEN=<admin-api-token> \
 *   npx ts-node apps/cms/seed/import-seed.ts
 *
 * Idempotent: checks if an entry with the same slug already exists
 * and skips it. Run again safely.
 */

// Import SEED from the web package (already ported as TypeScript)
import { SEED } from '../../apps/web/src/lib/seed';

const BASE  = process.env['STRAPI_URL']       ?? 'http://localhost:1337';
const TOKEN = process.env['STRAPI_API_TOKEN'] ?? '';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

async function post(path: string, data: unknown): Promise<{ id: number }> {
  const res = await fetch(`${BASE}/api/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST ${path} failed: ${res.status} ${err}`);
  }
  return (await res.json() as { data: { id: number } }).data;
}

async function findBySlug(path: string, slug: string): Promise<number | null> {
  const res = await fetch(`${BASE}/api/${path}?filters[slug][$eq]=${slug}&locale=sk`, { headers });
  const json = await res.json() as { data: Array<{ id: number }> };
  return json.data[0]?.id ?? null;
}

async function upsert(path: string, slug: string, data: unknown): Promise<number> {
  const existing = await findBySlug(path, slug);
  if (existing) {
    console.log(`  skip (exists): ${path}/${slug}`);
    return existing;
  }
  const created = await post(path, data);
  console.log(`  created: ${path}/${slug} → id ${created.id}`);
  return created.id;
}

async function main() {
  console.log('Seeding Strapi from design_handoff SEED…');

  // ── Departments ────────────────────────────────────────
  console.log('\nDepartments:');
  const deptIds: Record<string, number> = {};
  for (const dept of SEED.departments) {
    const id = await upsert('departments', dept.id, {
      name:      dept.name.sk,
      short:     dept.short.sk,
      slug:      dept.id,
      lead:      dept.lead,
      leadRole:  dept.leadRole.sk,
      deputy:    dept.deputy,
      deputyRole:dept.deputyRole?.sk,
      beds:      dept.beds,
      phone:     dept.phone,
      email:     dept.email,
      delivery:  dept.delivery,
      featured:  dept.featured,
      summary:   dept.summary.sk,
      desc:      dept.desc.sk,
      facilities:dept.facilities.sk ?? [],
      visiting:  dept.visiting.sk,
      locale:    'sk',
    });
    deptIds[dept.id] = id;
  }

  // ── Clinics ───────────────────────────────────────────
  console.log('\nClinics:');
  const clinicIds: Record<string, number> = {};
  for (const clinic of SEED.clinics) {
    const id = await upsert('clinics', clinic.id, {
      name:         clinic.name.sk,
      slug:         clinic.id,
      specialty:    clinic.specialty.sk,
      doctor:       clinic.doctor,
      nurse:        clinic.nurse,
      location:     clinic.location.sk,
      phone:        clinic.phone,
      status:       clinic.status,
      bookable:     clinic.bookable,
      referral:     clinic.referral,
      acceptingNew: clinic.acceptingNew ?? false,
      bookingDays:  clinic.bookingDays ?? [],
      bookingWindow:clinic.bookingWindow,
      schedule:     clinic.schedule.sk ?? [],
      bookingRule:  clinic.bookingRule.sk,
      fee:          clinic.fee?.sk,
      opened:       clinic.opened,
      locale:       'sk',
    });
    clinicIds[clinic.id] = id;
  }

  // ── Physicians ────────────────────────────────────────
  console.log('\nPhysicians:');
  for (const p of SEED.physicians) {
    await upsert('physicians', p.id, {
      name:       p.name,
      slug:       p.id,
      role:       p.role.sk,
      bio:        p.bio.sk,
      accepting:  p.accepting,
      langs:      p.langs,
      department: p.dept  ? deptIds[p.dept]   : undefined,
      clinic:     p.clinic ? clinicIds[p.clinic] : undefined,
      locale:     'sk',
    });
  }

  // ── Services ──────────────────────────────────────────
  console.log('\nServices:');
  for (const s of SEED.services) {
    await upsert('services', s.id, {
      name:       s.name.sk,
      slug:       s.id,
      desc:       s.desc.sk,
      icon:       s.icon,
      department: s.dept     ? deptIds[s.dept]    : undefined,
      clinic:     s.clinic   ? clinicIds[s.clinic] : undefined,
      locale:     'sk',
    });
  }

  // ── Facilities ────────────────────────────────────────
  console.log('\nFacilities:');
  for (const f of SEED.facilities) {
    await upsert('facilities', f.id, {
      name:     f.name.sk,
      slug:     f.id,
      lead:     f.lead,
      phone:    f.phone,
      kind:     f.kind.sk,
      desc:     f.desc.sk,
      features: f.features.sk ?? [],
      locale:   'sk',
    });
  }

  // ── News ──────────────────────────────────────────────
  console.log('\nNews:');
  for (const n of SEED.news) {
    await upsert('news-items', n.id, {
      date:   n.date,
      type:   n.type,
      tag:    n.tag.sk,
      title:  n.title.sk,
      body:   n.body.sk,
      slug:   n.id,
      locale: 'sk',
    });
  }

  // ── Disclosures ───────────────────────────────────────
  console.log('\nDisclosures:');
  for (const d of SEED.disclosures) {
    const existing = await findBySlug('disclosures', d.id);
    if (!existing) {
      await post('disclosures', {
        documentId: d.id,
        type:       d.type.sk,
        partner:    d.partner,
        value:      d.value,
        date:       d.date,
        locale:     'sk',
      });
      console.log(`  created: disclosures/${d.id}`);
    } else {
      console.log(`  skip (exists): disclosures/${d.id}`);
    }
  }

  console.log('\nSeed complete.');
}

main().catch((err) => { console.error(err); process.exit(1); });
