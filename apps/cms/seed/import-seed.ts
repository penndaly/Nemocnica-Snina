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
import { SEED } from '../../web/src/lib/seed';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// MEDIA-1: the placeholder photo manifest + files ship with the web app.
const IMG_DIR = join(__dirname, '..', '..', 'web', 'public', 'img');
const MANIFEST = JSON.parse(readFileSync(join(__dirname, '..', '..', 'web', 'src', 'lib', 'media-manifest.json'), 'utf8')) as Record<string, unknown>;
// Hero slots that reuse another slot's file — keep in step with apps/web/src/lib/media.ts SLOT_ALIASES.
const SLOT_ALIASES: Record<string, string> = {
  'home-campus': 'about-hero', 'patients-hero': 'patients-room', 'contact-hero': 'news-hero', 'telehealth-hero': 'teleconsult-hero',
};

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

// disclosures don't have a `slug` field — they're keyed by `documentId` (the
// human document number, e.g. "ZML-2024-051"), so they need their own lookup.
async function findByDocumentId(path: string, documentId: string): Promise<number | null> {
  const res = await fetch(`${BASE}/api/${path}?filters[documentId][$eq]=${documentId}&locale=sk`, { headers });
  const json = await res.json() as { data: Array<{ id: number }> };
  return json.data[0]?.id ?? null;
}

async function putSingleton(path: string, data: unknown, locale?: string): Promise<void> {
  const qs = locale ? `?locale=${locale}` : '';
  const res = await fetch(`${BASE}/api/${path}${qs}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PUT ${path}${qs} failed: ${res.status} ${err}`);
  }
  console.log(`  set: ${path}${locale ? ` (${locale})` : ''}`);
}

/** Upload one file to the Strapi media library; returns its id. Idempotent by name. */
async function uploadImage(fileName: string, alt: string): Promise<number | null> {
  const file = join(IMG_DIR, fileName);
  if (!existsSync(file)) { console.warn(`  missing file, skipped: ${fileName}`); return null; }
  const existing = await fetch(`${BASE}/api/upload/files?filters[name][$eq]=${encodeURIComponent(fileName)}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (existing.ok) {
    const found = (await existing.json()) as Array<{ id: number }>;
    if (found[0]) return found[0].id;
  }
  const form = new FormData();
  form.append('files', new Blob([readFileSync(file)], { type: 'image/webp' }), fileName);
  form.append('fileInfo', JSON.stringify({ name: fileName, alternativeText: alt, caption: '' }));
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: form });
  if (!res.ok) throw new Error(`upload ${fileName} failed: ${res.status} ${await res.text()}`);
  const [uploaded] = (await res.json()) as Array<{ id: number }>;
  console.log(`  uploaded: ${fileName} → media ${uploaded!.id}`);
  return uploaded!.id;
}

async function findBySlot(slot: string): Promise<number | null> {
  const res = await fetch(`${BASE}/api/media-slots?filters[slot][$eq]=${slot}`, { headers });
  if (!res.ok) return null;
  const json = (await res.json()) as { data: Array<{ id: number }> };
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

  // ── Media slots (MEDIA-1) ─────────────────────────────
  // Page-hero photos as CMS rows the admin can replace / hide / un-hide.
  // dept-<id> files go on Department.image below instead of a slot row.
  console.log('\nMedia slots:');
  const mediaIds: Record<string, number | null> = {};
  const manifest = MANIFEST as Record<string, { webp: string; alt: { sk?: string; en?: string }; credit?: string; placeholder?: boolean }>;
  for (const [key, e] of Object.entries(manifest)) {
    mediaIds[key] = await uploadImage(e.webp, e.alt.sk ?? '');
  }
  const slotRows: Array<[string, string]> = [
    ...Object.keys(manifest).filter((k) => !k.startsWith('dept-')).map((k) => [k, k] as [string, string]),
    ...Object.entries(SLOT_ALIASES),
  ];
  for (const [slot, from] of slotRows) {
    if (await findBySlot(slot)) { console.log(`  skip (exists): media-slots/${slot}`); continue; }
    const e = manifest[from]!;
    const [, , url, licence] = (e.credit ?? '').split(' · ');
    await post('media-slots', {
      slot, image: mediaIds[from], altSk: e.alt.sk, altEn: e.alt.en,
      hidden: false, placeholder: e.placeholder !== false,
      credit: e.credit, licence: licence ?? '', sourceUrl: url ?? '',
      reusedFrom: slot === from ? undefined : from,
    });
    console.log(`  created: media-slots/${slot}${slot === from ? '' : ` (reuses ${from})`}`);
  }

  // ── Departments ────────────────────────────────────────
  console.log('\nDepartments:');
  const deptIds: Record<string, number> = {};
  for (const dept of SEED.departments) {
    const id = await upsert('departments', dept.id, {
      image:     mediaIds[`dept-${dept.id}`] ?? undefined,
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
    const existing = await findByDocumentId('disclosures', d.id);
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

  // ── Hospital (singleton, not locale-split at the type level) ──
  console.log('\nHospital:');
  await putSingleton('hospital', {
    name:      SEED.hospital.name,
    tagline:   SEED.hospital.tagline.sk,
    address:   SEED.hospital.address,
    ico:       SEED.hospital.ico,
    dic:       SEED.hospital.dic,
    phone:     SEED.hospital.phone,
    reception: SEED.hospital.reception,
    pharmacy:  SEED.hospital.pharmacy,
    emergency: SEED.hospital.emergency,
    email:     SEED.hospital.email,
    region:    SEED.hospital.region.sk,
  });

  // ── Pages content (singleton, i18n-localized) ──────────
  // gdprBody/accessibilityBody are required by the schema but aren't part of
  // SEED.pages (data.js only covers hero/about/aps) — sourced from the
  // design-handoff's own kontakt.html copy (assets/data.js has no equivalent
  // field; this is the real prototype text, not placeholder copy).
  console.log('\nPages content:');
  await putSingleton('pages-content', {
    heroBadge:    SEED.pages.hero.badge.sk,
    heroTitle:    SEED.pages.hero.title.sk,
    heroSubtitle: SEED.pages.hero.subtitle.sk,
    aboutTitle:   SEED.pages.about.title.sk,
    aboutBody:    SEED.pages.about.body.sk,
    apsTitle:     SEED.pages.aps.title.sk,
    apsNote:      SEED.pages.aps.note.sk,
    gdprBody:     'Vaše osobné a zdravotné údaje spracúvame v súlade s Nariadením GDPR a zákonom č. 18/2018 Z. z. Údaje uchovávame v rámci EÚ, šifrované pri prenose aj v úložisku. Spracúvame len nevyhnutné údaje na zabezpečenie vyšetrenia a zdravotnej starostlivosti.',
    accessibilityBody: 'Web spĺňa štandardy WCAG 2.1 úrovne AA v zmysle zákona č. 351/2022 Z. z. Stránky sú ovládateľné klávesnicou, kompatibilné s čítačmi obrazovky a poskytujú dostatočný kontrast.',
  }, 'sk');

  console.log('\nSeed complete.');
}

main().catch((err) => { console.error(err); process.exit(1); });
