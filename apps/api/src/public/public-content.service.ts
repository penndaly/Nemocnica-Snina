/**
 * PublicContentService — read-only content for the public website (/api/public).
 *
 * Fetches from Strapi with the request's locale and maps each entry to the
 * shared @ns/types shape. Bilingual values are keyed by the REQUESTED locale
 * (never hardcoded 'sk'/'en') so the same mapper serves every current and
 * future locale (cs/pl/hu/uk land in a later sprint without code change).
 *
 * Dev/CI without a real Strapi: a guarded, dev-only fallback returns the ported
 * seed so the site renders offline. In production STRAPI_API_TOKEN is always
 * set, so `useFallback` is false and the fallback path is never reached.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  Clinic, Department, Disclosure, Facility, Hospital, Locale,
  NewsItem, Pages, Physician, Service,
} from '@ns/types';

type Dict = Record<string, unknown>;

export interface PhysicianProfile {
  slug: string;
  name: string;
  role: Record<string, string>;
  bio: Record<string, string>;
  accepting: boolean;
  langs: string[];
  photo: { url: string } | null;
  dept: { slug: string; short: Record<string, string> } | null;
  clinic: { slug: string; name: Record<string, string>; status: string; bookable: boolean } | null;
  facility: { slug: string; name: Record<string, string> } | null;
}

@Injectable()
export class PublicContentService {
  private readonly logger = new Logger(PublicContentService.name);
  private readonly url: string;
  private readonly token: string;
  private readonly useFallback: boolean;

  constructor(cfg: ConfigService) {
    this.url = cfg.get<string>('STRAPI_URL') ?? 'http://localhost:1337';
    this.token = cfg.get<string>('STRAPI_API_TOKEN') ?? '';
    this.useFallback = !this.token || this.token === 'dev-token';
  }

  // ── fetch helpers ─────────────────────────────────────────

  private loc(value: unknown, locale: Locale): Record<string, string> {
    return { [locale]: String(value ?? '') };
  }

  private locList(value: unknown, locale: Locale): Record<string, string[]> {
    return { [locale]: Array.isArray(value) ? (value as string[]) : [] };
  }

  private rel(value: unknown): Dict | null {
    const data = (value as Dict)?.['data'];
    if (!data) return null;
    const d = data as Dict;
    return { id: d['id'], ...((d['attributes'] as Dict) ?? {}) };
  }

  private async strapi<T>(path: string, locale: Locale): Promise<T> {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${this.url}/api/${path}${sep}locale=${locale}&populate=*`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`Strapi ${path}: HTTP ${res.status}`);
    const json = (await res.json()) as { data: T };
    return json.data;
  }

  private seed(): Dict {
    // Dev-only fallback. Path built at runtime so the bundler/typechecker does
    // not hard-link the web package; never executed in production.
    try {
      const p = ['..', '..', '..', 'web', 'src', 'lib', 'seed'].join('/');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return (require(p) as { SEED: Dict }).SEED;
    } catch (err) {
      this.logger.warn(`seed fallback unavailable: ${String(err)}`);
      return {};
    }
  }

  // ── mappers ───────────────────────────────────────────────

  private mapDepartment(e: Dict, locale: Locale): Department {
    const a = (e['attributes'] as Dict) ?? e;
    return {
      id: String(a['slug'] ?? e['id']),
      name: this.loc(a['name'], locale),
      short: this.loc(a['short'], locale),
      lead: String(a['lead'] ?? ''),
      leadRole: this.loc(a['leadRole'], locale),
      deputy: a['deputy'] ? String(a['deputy']) : undefined,
      deputyRole: a['deputyRole'] ? this.loc(a['deputyRole'], locale) : undefined,
      beds: Number(a['beds'] ?? 0),
      phone: a['phone'] ? String(a['phone']) : undefined,
      email: a['email'] ? String(a['email']) : undefined,
      delivery: a['delivery'] ? String(a['delivery']) : undefined,
      featured: Boolean(a['featured']),
      summary: this.loc(a['summary'], locale),
      desc: this.loc(a['desc'], locale),
      facilities: this.locList(a['facilities'], locale),
      visiting: this.loc(a['visiting'], locale),
    };
  }

  private mapClinic(e: Dict, locale: Locale): Clinic {
    const a = (e['attributes'] as Dict) ?? e;
    return {
      id: String(a['slug'] ?? e['id']),
      name: this.loc(a['name'], locale),
      specialty: this.loc(a['specialty'], locale),
      doctor: String(a['doctor'] ?? ''),
      nurse: a['nurse'] ? String(a['nurse']) : undefined,
      location: this.loc(a['location'], locale),
      phone: a['phone'] ? String(a['phone']) : undefined,
      status: (a['status'] as Clinic['status']) ?? 'open',
      bookable: Boolean(a['bookable']),
      referral: Boolean(a['referral']),
      acceptingNew: Boolean(a['acceptingNew']),
      bookingDays: (a['bookingDays'] as Clinic['bookingDays']) ?? undefined,
      bookingWindow: a['bookingWindow'] ? String(a['bookingWindow']) : undefined,
      schedule: this.locList(a['schedule'], locale),
      bookingRule: this.loc(a['bookingRule'], locale),
      fee: a['fee'] ? this.loc(a['fee'], locale) : undefined,
      opened: a['opened'] ? String(a['opened']) : undefined,
      telehealth: a['telehealth'] ? Boolean(a['telehealth']) : undefined,
      telehealthWindow: a['telehealthWindow'] ? String(a['telehealthWindow']) : undefined,
      telehealthRule: a['telehealthRule'] ? this.loc(a['telehealthRule'], locale) : undefined,
    };
  }

  private mapPhysician(e: Dict, locale: Locale): Physician {
    const a = (e['attributes'] as Dict) ?? e;
    const dept = this.rel(a['department']);
    const clinic = this.rel(a['clinic']);
    const facility = this.rel(a['facility']);
    return {
      id: String(a['slug'] ?? e['id']),
      name: String(a['name'] ?? ''),
      role: this.loc(a['role'], locale),
      bio: this.loc(a['bio'], locale),
      accepting: Boolean(a['accepting']),
      langs: (a['langs'] as string[]) ?? [],
      dept: dept ? String(dept['slug'] ?? dept['id']) : undefined,
      clinic: clinic ? String(clinic['slug'] ?? clinic['id']) : undefined,
      facility: facility ? String(facility['slug'] ?? facility['id']) : undefined,
    };
  }

  private mapService(e: Dict, locale: Locale): Service {
    const a = (e['attributes'] as Dict) ?? e;
    return {
      id: String(a['slug'] ?? e['id']),
      name: this.loc(a['name'], locale),
      desc: this.loc(a['desc'], locale),
      icon: (a['icon'] as Service['icon']) ?? 'shield',
      dept: this.rel(a['department']) ? String(this.rel(a['department'])!['slug'] ?? '') : undefined,
      clinic: this.rel(a['clinic']) ? String(this.rel(a['clinic'])!['slug'] ?? '') : undefined,
      facility: this.rel(a['facility']) ? String(this.rel(a['facility'])!['slug'] ?? '') : undefined,
    };
  }

  private mapFacility(e: Dict, locale: Locale): Facility {
    const a = (e['attributes'] as Dict) ?? e;
    return {
      id: String(a['slug'] ?? e['id']),
      name: this.loc(a['name'], locale),
      lead: a['lead'] ? String(a['lead']) : undefined,
      phone: a['phone'] ? String(a['phone']) : undefined,
      kind: this.loc(a['kind'], locale),
      desc: this.loc(a['desc'], locale),
      features: this.locList(a['features'], locale),
    };
  }

  private mapNews(e: Dict, locale: Locale): NewsItem {
    const a = (e['attributes'] as Dict) ?? e;
    return {
      id: String(a['slug'] ?? e['id']),
      date: String(a['date'] ?? ''),
      type: (a['type'] as NewsItem['type']) ?? 'info',
      tag: this.loc(a['tag'], locale),
      title: this.loc(a['title'], locale),
      body: this.loc(a['body'], locale),
    };
  }

  private mapDisclosure(e: Dict, locale: Locale): Disclosure {
    const a = (e['attributes'] as Dict) ?? e;
    const pdf = this.rel(a['pdf']);
    return {
      id: String(a['documentId'] ?? e['id']),
      type: this.loc(a['type'], locale),
      partner: String(a['partner'] ?? ''),
      value: String(a['value'] ?? ''),
      date: String(a['date'] ?? ''),
      pdfUrl: pdf ? String(pdf['url'] ?? '') : undefined,
    };
  }

  // ── collections ───────────────────────────────────────────

  async departments(locale: Locale): Promise<Department[]> {
    if (this.useFallback) return (this.seed()['departments'] as Department[]) ?? [];
    const data = await this.strapi<Dict[]>('departments?sort=slug', locale);
    return data.map((e) => this.mapDepartment(e, locale));
  }

  async departmentBySlug(slug: string, locale: Locale): Promise<Department & { physicians: Physician[]; clinics: Clinic[] }> {
    const dept = (await this.departments(locale)).find((d) => d.id === slug);
    if (!dept) throw new NotFoundException(`department/${slug}`);
    const [physicians, clinics] = await Promise.all([this.physicians(locale), this.clinics(locale)]);
    return {
      ...dept,
      physicians: physicians.filter((p) => p.dept === slug),
      clinics: clinics.filter((c) => physicians.some((p) => p.clinic === c.id && p.dept === slug)),
    };
  }

  async clinics(locale: Locale): Promise<Clinic[]> {
    if (this.useFallback) return (this.seed()['clinics'] as Clinic[]) ?? [];
    const data = await this.strapi<Dict[]>('clinics?sort=slug', locale);
    return data.map((e) => this.mapClinic(e, locale));
  }

  async clinicBySlug(slug: string, locale: Locale): Promise<Clinic & { physicians: Physician[] }> {
    const clinic = (await this.clinics(locale)).find((c) => c.id === slug);
    if (!clinic) throw new NotFoundException(`clinic/${slug}`);
    const physicians = (await this.physicians(locale)).filter((p) => p.clinic === slug);
    return { ...clinic, physicians };
  }

  async physicians(locale: Locale): Promise<Physician[]> {
    if (this.useFallback) return (this.seed()['physicians'] as Physician[]) ?? [];
    const data = await this.strapi<Dict[]>('physicians?sort=name', locale);
    return data.map((e) => this.mapPhysician(e, locale));
  }

  async physicianProfile(slug: string, locale: Locale): Promise<PhysicianProfile> {
    if (this.useFallback) {
      const seed = this.seed();
      const p = ((seed['physicians'] as Physician[]) ?? []).find((x) => x.id === slug);
      if (!p) throw new NotFoundException(`physician/${slug}`);
      const dept = ((seed['departments'] as Department[]) ?? []).find((d) => d.id === p.dept) ?? null;
      const clinic = ((seed['clinics'] as Clinic[]) ?? []).find((c) => c.id === p.clinic) ?? null;
      const facility = ((seed['facilities'] as Facility[]) ?? []).find((f) => f.id === p.facility) ?? null;
      return {
        slug: p.id,
        name: p.name,
        role: p.role as Record<string, string>,
        bio: p.bio as Record<string, string>,
        accepting: p.accepting,
        langs: p.langs,
        photo: null,
        dept: dept ? { slug: dept.id, short: dept.short as Record<string, string> } : null,
        clinic: clinic ? { slug: clinic.id, name: clinic.name as Record<string, string>, status: clinic.status, bookable: clinic.bookable } : null,
        facility: facility ? { slug: facility.id, name: facility.name as Record<string, string> } : null,
      };
    }

    const data = await this.strapi<Dict[]>(`physicians?filters[slug][$eq]=${encodeURIComponent(slug)}`, locale);
    const entry = data[0];
    if (!entry) throw new NotFoundException(`physician/${slug}`);
    const a = (entry['attributes'] as Dict) ?? entry;
    const dept = this.rel(a['department']);
    const clinic = this.rel(a['clinic']);
    const facility = this.rel(a['facility']);
    const avatar = this.rel(a['avatar']);
    return {
      slug: String(a['slug'] ?? slug),
      name: String(a['name'] ?? ''),
      role: this.loc(a['role'], locale),
      bio: this.loc(a['bio'], locale),
      accepting: Boolean(a['accepting']),
      langs: (a['langs'] as string[]) ?? [],
      photo: avatar ? { url: String(avatar['url'] ?? '') } : null,
      dept: dept ? { slug: String(dept['slug'] ?? ''), short: this.loc(dept['short'], locale) } : null,
      clinic: clinic
        ? { slug: String(clinic['slug'] ?? ''), name: this.loc(clinic['name'], locale), status: String(clinic['status'] ?? 'open'), bookable: Boolean(clinic['bookable']) }
        : null,
      facility: facility ? { slug: String(facility['slug'] ?? ''), name: this.loc(facility['name'], locale) } : null,
    };
  }

  async services(locale: Locale): Promise<Service[]> {
    if (this.useFallback) return (this.seed()['services'] as Service[]) ?? [];
    const data = await this.strapi<Dict[]>('services?sort=slug', locale);
    return data.map((e) => this.mapService(e, locale));
  }

  async facilities(locale: Locale): Promise<Facility[]> {
    if (this.useFallback) return (this.seed()['facilities'] as Facility[]) ?? [];
    const data = await this.strapi<Dict[]>('facilities?sort=slug', locale);
    return data.map((e) => this.mapFacility(e, locale));
  }

  async facilityBySlug(slug: string, locale: Locale): Promise<Facility & { physicians: Physician[] }> {
    const facility = (await this.facilities(locale)).find((f) => f.id === slug);
    if (!facility) throw new NotFoundException(`facility/${slug}`);
    const physicians = (await this.physicians(locale)).filter((p) => p.facility === slug);
    return { ...facility, physicians };
  }

  async news(locale: Locale): Promise<NewsItem[]> {
    if (this.useFallback) {
      const all = ((this.seed()['news'] as NewsItem[]) ?? []).slice();
      return all.sort((a, b) => b.date.localeCompare(a.date));
    }
    const data = await this.strapi<Dict[]>('news-items?sort=date:desc', locale);
    return data.map((e) => this.mapNews(e, locale));
  }

  async disclosures(locale: Locale): Promise<Disclosure[]> {
    if (this.useFallback) {
      const all = ((this.seed()['disclosures'] as Disclosure[]) ?? []).slice();
      return all.sort((a, b) => b.date.localeCompare(a.date));
    }
    const data = await this.strapi<Dict[]>('disclosures?sort=date:desc', locale);
    return data.map((e) => this.mapDisclosure(e, locale));
  }

  async hospital(locale: Locale): Promise<Hospital> {
    if (this.useFallback) return this.seed()['hospital'] as Hospital;
    const entry = await this.strapi<Dict>('hospital', locale);
    const a = (entry['attributes'] as Dict) ?? entry;
    return {
      name: String(a['name'] ?? ''),
      tagline: this.loc(a['tagline'], locale),
      address: String(a['address'] ?? ''),
      ico: String(a['ico'] ?? ''),
      dic: String(a['dic'] ?? ''),
      phone: String(a['phone'] ?? ''),
      reception: String(a['reception'] ?? ''),
      pharmacy: String(a['pharmacy'] ?? ''),
      emergency: String(a['emergency'] ?? '112'),
      email: String(a['email'] ?? ''),
      region: this.loc(a['region'], locale),
    };
  }

  async pages(locale: Locale): Promise<Pages> {
    if (this.useFallback) return this.seed()['pages'] as Pages;
    const entry = await this.strapi<Dict>('pages-content', locale);
    const a = (entry['attributes'] as Dict) ?? entry;
    return {
      hero: { badge: this.loc(a['heroBadge'], locale), title: this.loc(a['heroTitle'], locale), subtitle: this.loc(a['heroSubtitle'], locale) },
      about: { title: this.loc(a['aboutTitle'], locale), body: this.loc(a['aboutBody'], locale) },
      aps: { title: this.loc(a['apsTitle'], locale), note: this.loc(a['apsNote'], locale) },
    };
  }
}
