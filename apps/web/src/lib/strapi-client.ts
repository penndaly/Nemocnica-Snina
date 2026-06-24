/**
 * Typed Strapi REST client.
 *
 * Replaces seed.ts as the data source for all server components.
 * Falls back to seed.ts in development when STRAPI_API_TOKEN is unset
 * so the app runs without a live CMS instance.
 *
 * All fetch calls use Next.js ISR: { next: { revalidate: REVALIDATE_SECONDS } }
 * A Strapi lifecycle webhook hits /api/revalidate to flush the cache immediately
 * when an editor saves content.
 */
import type {
  Department, Clinic, Physician, Service, Facility, NewsItem,
  Disclosure, Hospital, Pages, Locale, PhysicianProfile, Weekday,
} from '@ns/types';

const STRAPI_URL   = process.env['STRAPI_URL']       ?? 'http://localhost:1337';
const API_TOKEN    = process.env['STRAPI_API_TOKEN']  ?? '';
const REVALIDATE   = Number(process.env['CONTENT_REVALIDATE_SECONDS'] ?? 60);
const USE_FALLBACK = !API_TOKEN || API_TOKEN === 'dev-token';

// ── Fetch helper ──────────────────────────────────────────

async function strapiGet<T>(path: string, locale: Locale = 'sk'): Promise<T> {
  if (USE_FALLBACK) {
    // In local dev without Strapi, return seed data via dynamic import
    const { SEED } = await import('./seed');
    return (SEED as unknown as Record<string, unknown>)[path.split('?')[0]!.split('/').pop()!] as T;
  }

  const sep = path.includes('?') ? '&' : '?';
  const url = `${STRAPI_URL}/api/${path}${sep}locale=${locale}&populate=*`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    next: { revalidate: REVALIDATE },
  });

  if (!res.ok) throw new Error(`Strapi ${path}: HTTP ${res.status}`);
  const json = await res.json() as { data: T };
  return json.data;
}

// ── Mappers: Strapi response → our type ───────────────────

function mapDepartment(entry: Record<string, unknown>): Department {
  const a = entry['attributes'] as Record<string, unknown> ?? entry;
  return {
    id:         String(entry['id'] ?? a['slug']),
    name:       { sk: String(a['name'] ?? ''), en: String((a['localizations'] as Array<Record<string, unknown>>)?.[0]?.['name'] ?? a['name'] ?? '') },
    short:      { sk: String(a['short'] ?? ''), en: String(a['short'] ?? '') },
    lead:       String(a['lead'] ?? ''),
    leadRole:   { sk: String(a['leadRole'] ?? ''), en: String(a['leadRole'] ?? '') },
    deputy:     a['deputy'] ? String(a['deputy']) : undefined,
    deputyRole: a['deputyRole'] ? { sk: String(a['deputyRole']) } : undefined,
    beds:       Number(a['beds'] ?? 0),
    phone:      a['phone'] ? String(a['phone']) : undefined,
    email:      a['email'] ? String(a['email']) : undefined,
    delivery:   a['delivery'] ? String(a['delivery']) : undefined,
    featured:   Boolean(a['featured']),
    summary:    { sk: String(a['summary'] ?? '') },
    desc:       { sk: String(a['desc'] ?? '') },
    facilities: { sk: (a['facilities'] as string[]) ?? [] },
    visiting:   { sk: String(a['visiting'] ?? '') },
  } as Department;
}

function mapClinic(entry: Record<string, unknown>): Clinic {
  const a = entry['attributes'] as Record<string, unknown> ?? entry;
  return {
    id:               String(entry['id'] ?? a['slug']),
    name:             { sk: String(a['name'] ?? '') },
    specialty:        { sk: String(a['specialty'] ?? '') },
    doctor:           String(a['doctor'] ?? ''),
    nurse:            a['nurse'] ? String(a['nurse']) : undefined,
    location:         { sk: String(a['location'] ?? '') },
    phone:            a['phone'] ? String(a['phone']) : undefined,
    status:           (a['status'] as 'open' | 'new' | 'alert' | 'closed') ?? 'open',
    bookable:         Boolean(a['bookable']),
    referral:         Boolean(a['referral']),
    acceptingNew:     Boolean(a['acceptingNew']),
    bookingDays:      (a['bookingDays'] as Weekday[]) ?? undefined,
    bookingWindow:    a['bookingWindow'] ? String(a['bookingWindow']) : undefined,
    schedule:         { sk: (a['schedule'] as string[]) ?? [] },
    bookingRule:      { sk: String(a['bookingRule'] ?? '') },
    fee:              a['fee'] ? { sk: String(a['fee']) } : undefined,
    opened:           a['opened'] ? String(a['opened']) : undefined,
    telehealth:       a['telehealth'] ? Boolean(a['telehealth']) : undefined,
    telehealthWindow: a['telehealthWindow'] ? String(a['telehealthWindow']) : undefined,
    telehealthRule:   a['telehealthRule'] ? { sk: String(a['telehealthRule']) } : undefined,
  } as Clinic;
}

// ── Public API ────────────────────────────────────────────

export async function getDepartments(locale: Locale = 'sk'): Promise<Department[]> {
  if (USE_FALLBACK) { const { SEED } = await import('./seed'); return SEED.departments; }
  const data = await strapiGet<Record<string, unknown>[]>('departments?sort=slug', locale);
  return data.map(mapDepartment);
}

export async function getDepartmentBySlug(slug: string, locale: Locale = 'sk'): Promise<Department | null> {
  if (USE_FALLBACK) { const { SEED } = await import('./seed'); return SEED.departments.find(d => d.id === slug) ?? null; }
  const data = await strapiGet<Record<string, unknown>[]>(`departments?filters[slug][$eq]=${slug}`, locale);
  return data[0] ? mapDepartment(data[0]) : null;
}

export async function getClinics(locale: Locale = 'sk'): Promise<Clinic[]> {
  if (USE_FALLBACK) { const { SEED } = await import('./seed'); return SEED.clinics; }
  const data = await strapiGet<Record<string, unknown>[]>('clinics?sort=name', locale);
  return data.map(mapClinic);
}

export async function getClinicById(id: string, locale: Locale = 'sk'): Promise<Clinic | null> {
  if (USE_FALLBACK) { const { SEED } = await import('./seed'); return SEED.clinics.find(c => c.id === id) ?? null; }
  const data = await strapiGet<Record<string, unknown>[]>(`clinics?filters[slug][$eq]=${id}`, locale);
  return data[0] ? mapClinic(data[0]) : null;
}

export async function getPhysicians(locale: Locale = 'sk'): Promise<Physician[]> {
  if (USE_FALLBACK) { const { SEED } = await import('./seed'); return SEED.physicians; }
  const data = await strapiGet<Record<string, unknown>[]>('physicians?sort=name', locale);
  return data.map((e) => {
    const a = e['attributes'] as Record<string, unknown> ?? e;
    return {
      // slug-first so id is the canonical profile-URL key (matches the seed
      // and /api/public); Strapi's numeric id is only a fallback.
      id: String((a['slug'] as string) ?? e['id']),
      name: String(a['name'] ?? ''),
      role: { [locale]: String(a['role'] ?? '') },
      bio:  { [locale]: String(a['bio'] ?? '') },
      accepting: Boolean(a['accepting']),
      langs: (a['langs'] as string[]) ?? [],
      dept:    (a['department'] as Record<string, unknown>)?.['data'] ? String(((a['department'] as Record<string, unknown>)['data'] as Record<string, unknown>)?.['id']) : undefined,
      clinic:  (a['clinic'] as Record<string, unknown>)?.['data'] ? String(((a['clinic'] as Record<string, unknown>)['data'] as Record<string, unknown>)?.['id']) : undefined,
      facility:(a['facility'] as Record<string, unknown>)?.['data'] ? String(((a['facility'] as Record<string, unknown>)['data'] as Record<string, unknown>)?.['id']) : undefined,
    } as Physician;
  });
}

/**
 * Full physician profile by slug for /[lang]/lekari/[slug].
 * Bilingual values are keyed by the requested locale (not hardcoded), so the
 * profile resolves correctly for every locale once cs/pl/hu/uk land. Returns
 * null when no published physician matches.
 */
export async function getPhysicianBySlug(slug: string, locale: Locale = 'sk'): Promise<PhysicianProfile | null> {
  if (USE_FALLBACK) {
    const { SEED } = await import('./seed');
    const p = SEED.physicians.find((x) => x.id === slug);
    if (!p) return null;
    const dept = p.dept ? SEED.departments.find((d) => d.id === p.dept) ?? null : null;
    const clinic = p.clinic ? SEED.clinics.find((c) => c.id === p.clinic) ?? null : null;
    const facility = p.facility ? SEED.facilities.find((f) => f.id === p.facility) ?? null : null;
    return {
      slug: p.id,
      name: p.name,
      role: p.role,
      bio: p.bio,
      accepting: p.accepting,
      langs: p.langs,
      photo: null,
      dept: dept ? { slug: dept.id, short: dept.short } : null,
      clinic: clinic ? { slug: clinic.id, name: clinic.name, status: clinic.status, bookable: clinic.bookable } : null,
      facility: facility ? { slug: facility.id, name: facility.name } : null,
    };
  }

  const data = await strapiGet<Record<string, unknown>[]>(`physicians?filters[slug][$eq]=${slug}`, locale);
  const entry = data[0];
  if (!entry) return null;
  const a = (entry['attributes'] as Record<string, unknown>) ?? entry;
  const relAttrs = (v: unknown): Record<string, unknown> | null => {
    const d = (v as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
    if (!d) return null;
    return { id: d['id'], ...((d['attributes'] as Record<string, unknown>) ?? {}) };
  };
  const dept = relAttrs(a['department']);
  const clinic = relAttrs(a['clinic']);
  const facility = relAttrs(a['facility']);
  const avatar = relAttrs(a['avatar']);
  return {
    slug: String(a['slug'] ?? slug),
    name: String(a['name'] ?? ''),
    role: { [locale]: String(a['role'] ?? '') },
    bio: { [locale]: String(a['bio'] ?? '') },
    accepting: Boolean(a['accepting']),
    langs: (a['langs'] as string[]) ?? [],
    photo: avatar ? { url: String(avatar['url'] ?? '') } : null,
    dept: dept ? { slug: String(dept['slug'] ?? ''), short: { [locale]: String(dept['short'] ?? '') } } : null,
    clinic: clinic
      ? {
          slug: String(clinic['slug'] ?? ''),
          name: { [locale]: String(clinic['name'] ?? '') },
          status: (clinic['status'] as Clinic['status']) ?? 'open',
          bookable: Boolean(clinic['bookable']),
        }
      : null,
    facility: facility ? { slug: String(facility['slug'] ?? ''), name: { [locale]: String(facility['name'] ?? '') } } : null,
  };
}

/** All published physician slugs — for generateStaticParams. */
export async function getPhysicianSlugs(): Promise<string[]> {
  if (USE_FALLBACK) {
    const { SEED } = await import('./seed');
    return SEED.physicians.map((p) => p.id);
  }
  const data = await strapiGet<Record<string, unknown>[]>('physicians?fields[0]=slug&sort=name', 'sk');
  return data
    .map((e) => {
      const a = (e['attributes'] as Record<string, unknown>) ?? e;
      return String(a['slug'] ?? '');
    })
    .filter(Boolean);
}

export async function getNewsItems(locale: Locale = 'sk'): Promise<NewsItem[]> {
  if (USE_FALLBACK) { const { SEED } = await import('./seed'); return SEED.news; }
  const data = await strapiGet<Record<string, unknown>[]>('news-items?sort=date:desc', locale);
  return data.map((e) => {
    const a = e['attributes'] as Record<string, unknown> ?? e;
    return {
      id:    String(a['slug'] ?? e['id']),
      date:  String(a['date'] ?? ''),
      type:  (a['type'] as 'good' | 'info' | 'alert') ?? 'info',
      tag:   { sk: String(a['tag'] ?? '') },
      title: { sk: String(a['title'] ?? '') },
      body:  { sk: String(a['body'] ?? '') },
    };
  });
}

export async function getDisclosures(locale: Locale = 'sk'): Promise<Disclosure[]> {
  if (USE_FALLBACK) { const { SEED } = await import('./seed'); return SEED.disclosures; }
  const data = await strapiGet<Record<string, unknown>[]>('disclosures?sort=date:desc', locale);
  return data.map((e) => {
    const a = e['attributes'] as Record<string, unknown> ?? e;
    const pdf = (a['pdf'] as Record<string, unknown>)?.['data'];
    return {
      id:      String(a['documentId'] ?? e['id']),
      type:    { sk: String(a['type'] ?? '') },
      partner: String(a['partner'] ?? ''),
      value:   String(a['value'] ?? ''),
      date:    String(a['date'] ?? ''),
      pdfUrl:  pdf ? String((pdf as Record<string, unknown>)?.['url'] ?? '') : undefined,
    } as Disclosure;
  });
}

export async function getFacilities(locale: Locale = 'sk'): Promise<Facility[]> {
  if (USE_FALLBACK) { const { SEED } = await import('./seed'); return SEED.facilities; }
  const data = await strapiGet<Record<string, unknown>[]>('facilities?sort=name', locale);
  return data.map((e) => {
    const a = e['attributes'] as Record<string, unknown> ?? e;
    return {
      id:       String(e['id'] ?? (a['slug'] as string)),
      name:     { sk: String(a['name'] ?? '') },
      lead:     a['lead'] ? String(a['lead']) : undefined,
      phone:    a['phone'] ? String(a['phone']) : undefined,
      kind:     { sk: String(a['kind'] ?? '') },
      desc:     { sk: String(a['desc'] ?? '') },
      features: { sk: (a['features'] as string[]) ?? [] },
    } as Facility;
  });
}

export async function getServices(locale: Locale = 'sk'): Promise<Service[]> {
  if (USE_FALLBACK) { const { SEED } = await import('./seed'); return SEED.services; }
  const data = await strapiGet<Record<string, unknown>[]>('services?sort=name&populate=*', locale);
  return data.map((e) => {
    const a = e['attributes'] as Record<string, unknown> ?? e;
    return {
      id:       String(e['id'] ?? (a['slug'] as string)),
      name:     { sk: String(a['name'] ?? '') },
      desc:     { sk: String(a['desc'] ?? '') },
      icon:     (a['icon'] as Service['icon']) ?? 'shield',
      dept:     (a['department'] as Record<string, unknown>)?.['data'] ? String(((a['department'] as Record<string, unknown>)['data'] as Record<string, unknown>)?.['id']) : undefined,
      clinic:   (a['clinic']     as Record<string, unknown>)?.['data'] ? String(((a['clinic']     as Record<string, unknown>)['data'] as Record<string, unknown>)?.['id']) : undefined,
      facility: (a['facility']   as Record<string, unknown>)?.['data'] ? String(((a['facility']   as Record<string, unknown>)['data'] as Record<string, unknown>)?.['id']) : undefined,
    } as Service;
  });
}

export async function getHospitalInfo(locale: Locale = 'sk'): Promise<Hospital> {
  if (USE_FALLBACK) { const { SEED } = await import('./seed'); return SEED.hospital; }
  const entry = await strapiGet<Record<string, unknown>>('hospital', locale);
  const a = (entry['attributes'] as Record<string, unknown>) ?? entry;
  return {
    name:      String(a['name']      ?? ''),
    tagline:   { sk: String(a['tagline']   ?? '') },
    address:   String(a['address']   ?? ''),
    ico:       String(a['ico']       ?? ''),
    dic:       String(a['dic']       ?? ''),
    phone:     String(a['phone']     ?? ''),
    reception: String(a['reception'] ?? ''),
    pharmacy:  String(a['pharmacy']  ?? ''),
    emergency: String(a['emergency'] ?? '112'),
    email:     String(a['email']     ?? ''),
    region:    { sk: String(a['region']    ?? '') },
  };
}

export async function getPageContent(locale: Locale = 'sk'): Promise<Pages> {
  if (USE_FALLBACK) { const { SEED } = await import('./seed'); return SEED.pages; }
  const entry = await strapiGet<Record<string, unknown>>('pages-content', locale);
  const a = (entry['attributes'] as Record<string, unknown>) ?? entry;
  return {
    hero: {
      badge:    { sk: String(a['heroBadge']    ?? '') },
      title:    { sk: String(a['heroTitle']    ?? '') },
      subtitle: { sk: String(a['heroSubtitle'] ?? '') },
    },
    about: {
      title: { sk: String(a['aboutTitle'] ?? '') },
      body:  { sk: String(a['aboutBody']  ?? '') },
    },
    aps: {
      title: { sk: String(a['apsTitle'] ?? '') },
      note:  { sk: String(a['apsNote']  ?? '') },
    },
  };
}

export async function getTelehealthPage(locale: Locale = 'sk'): Promise<NonNullable<Pages['telehealth']>> {
  if (USE_FALLBACK) {
    const { SEED } = await import('./seed');
    return SEED.pages.telehealth ?? {
      badge:    { sk: 'Telezdravotníctvo', en: 'Telehealth' },
      title:    { sk: 'Videokonzultácia s lekárom z domu', en: 'Video consultation with your doctor from home' },
      subtitle: { sk: 'Bezpečná, šifrovaná videokonzultácia.', en: 'Secure, encrypted video consultation.' },
    };
  }
  const entry = await strapiGet<Record<string, unknown>>('pages-telehealth', locale);
  const a = (entry['attributes'] as Record<string, unknown>) ?? entry;
  return {
    badge:    { [locale]: String(a['heroBadge']    ?? '') },
    title:    { [locale]: String(a['heroTitle']    ?? '') },
    subtitle: { [locale]: String(a['heroSubtitle'] ?? '') },
  };
}

export async function getTelehealthClinics(locale: Locale = 'sk'): Promise<Clinic[]> {
  const all = await getClinics(locale);
  return all.filter((c) => c.telehealth && c.bookable && c.status !== 'closed');
}
