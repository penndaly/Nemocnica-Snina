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
  Disclosure, Hospital, Pages, Locale,
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
    return (SEED as Record<string, unknown>)[path.split('?')[0]!.split('/').pop()!] as T;
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
    name:       { sk: String(a['name'] ?? ''), en: String((a['localizations'] as Record<string, unknown>)?.[0]?.['name'] ?? a['name'] ?? '') },
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
  };
}

function mapClinic(entry: Record<string, unknown>): Clinic {
  const a = entry['attributes'] as Record<string, unknown> ?? entry;
  return {
    id:           String(entry['id'] ?? a['slug']),
    name:         { sk: String(a['name'] ?? '') },
    specialty:    { sk: String(a['specialty'] ?? '') },
    doctor:       String(a['doctor'] ?? ''),
    nurse:        a['nurse'] ? String(a['nurse']) : undefined,
    location:     { sk: String(a['location'] ?? '') },
    phone:        a['phone'] ? String(a['phone']) : undefined,
    status:       (a['status'] as 'open' | 'new' | 'alert' | 'closed') ?? 'open',
    bookable:     Boolean(a['bookable']),
    referral:     Boolean(a['referral']),
    acceptingNew: Boolean(a['acceptingNew']),
    bookingDays:  (a['bookingDays'] as number[]) ?? undefined,
    bookingWindow:a['bookingWindow'] ? String(a['bookingWindow']) : undefined,
    schedule:     { sk: (a['schedule'] as string[]) ?? [] },
    bookingRule:  { sk: String(a['bookingRule'] ?? '') },
    fee:          a['fee'] ? { sk: String(a['fee']) } : undefined,
    opened:       a['opened'] ? String(a['opened']) : undefined,
  };
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
      id: String(e['id'] ?? (a['slug'] as string)),
      name: String(a['name'] ?? ''),
      role: { sk: String(a['role'] ?? '') },
      bio:  { sk: String(a['bio'] ?? '') },
      accepting: Boolean(a['accepting']),
      langs: (a['langs'] as string[]) ?? [],
      dept:    (a['department'] as Record<string, unknown>)?.['data'] ? String(((a['department'] as Record<string, unknown>)['data'] as Record<string, unknown>)?.['id']) : undefined,
      clinic:  (a['clinic'] as Record<string, unknown>)?.['data'] ? String(((a['clinic'] as Record<string, unknown>)['data'] as Record<string, unknown>)?.['id']) : undefined,
      facility:(a['facility'] as Record<string, unknown>)?.['data'] ? String(((a['facility'] as Record<string, unknown>)['data'] as Record<string, unknown>)?.['id']) : undefined,
    };
  });
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
    };
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
    };
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
    };
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
