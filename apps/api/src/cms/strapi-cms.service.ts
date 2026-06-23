/**
 * StrapiCmsService — the write path for /api/cms/**.
 *
 * Honors the shipped Strapi-i18n storage model (do NOT introduce JSON {sk,en}
 * columns): a bilingual `{ sk, en }` body becomes a base `sk` entry plus an
 * `en` localization linked through Strapi's i18n relation. Non-localized fields
 * (lead, phone, beds, relations …) live only on the base entry and are shared
 * across locales.
 *
 * Slug parity with the prototype admin is enforced via slugify() (cms/slugify.ts).
 *
 * Dev/CI without a real Strapi (STRAPI_ADMIN_TOKEN unset / STRAPI_API_TOKEN is
 * the 'dev-token' default): reads fall back to the ported seed so the admin can
 * browse; writes throw 503 rather than pretend to persist.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CMS_COLLECTIONS,
  CMS_SINGLETONS,
  isLocalizedField,
  type CmsCollection,
} from './cms.schema';
import { slugify } from './slugify';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PDF_TYPE = 'application/pdf';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB

export interface UploadedMedia {
  mimetype: string;
  size: number;
  buffer: Buffer;
  filename: string;
}

/** Pure media-constraint check (exported for unit tests). */
export function validateMediaConstraints(mimetype: string, size: number): void {
  if (mimetype === PDF_TYPE) {
    if (size > MAX_PDF_BYTES) throw new BadRequestException('PDF exceeds 50MB limit');
    return;
  }
  if (IMAGE_TYPES.has(mimetype)) {
    if (size > MAX_IMAGE_BYTES) throw new BadRequestException('Image exceeds 10MB limit');
    return;
  }
  throw new BadRequestException(
    `Unsupported media type: ${mimetype} (allowed: jpeg, png, webp, pdf)`,
  );
}

interface StrapiPayloads {
  /** Base (default-locale / sk) attributes — localized fields use .sk. */
  base: Record<string, unknown>;
  /** en localization attributes — only localized fields, using .en. */
  localized: Record<string, unknown>;
}

@Injectable()
export class StrapiCmsService {
  private readonly logger = new Logger(StrapiCmsService.name);
  private readonly url: string;
  private readonly token: string;
  private readonly useFallback: boolean;

  constructor(private readonly cfg: ConfigService) {
    this.url = cfg.get<string>('STRAPI_ADMIN_URL') ?? cfg.get<string>('STRAPI_URL') ?? 'http://localhost:1337';
    const admin = cfg.get<string>('STRAPI_ADMIN_TOKEN') ?? '';
    const api = cfg.get<string>('STRAPI_API_TOKEN') ?? '';
    this.token = admin || api;
    this.useFallback = !this.token || this.token === 'dev-token';
  }

  // ── Pure payload construction (unit-tested) ───────────────

  /**
   * Split a body (prototype admin vocabulary) into Strapi base + en payloads.
   * Bilingual fields → base.sk / localized.en. Maps body keys to Strapi
   * attribute names (dept→department, photo→avatar, id→documentId …).
   * Relations and media are emitted as-is for the caller to resolve/connect.
   */
  buildStrapiPayloads(spec: CmsCollection, body: Record<string, unknown>): StrapiPayloads {
    const base: Record<string, unknown> = {};
    const localized: Record<string, unknown> = {};

    for (const f of spec.fields) {
      if (!(f.k in body) || body[f.k] === undefined) continue;
      const value = body[f.k];
      const key = f.strapiKey ?? f.k;

      if (isLocalizedField(f) && value !== null && typeof value === 'object') {
        const v = value as Record<string, unknown>;
        base[key] = v.sk ?? (f.t === 'billist' ? [] : '');
        if (v.en !== undefined) localized[key] = v.en;
      } else {
        base[key] = value;
      }
    }
    return { base, localized };
  }

  // ── HTTP helpers ──────────────────────────────────────────

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = { Authorization: `Bearer ${this.token}` };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  private assertLive(action: string): void {
    if (this.useFallback) {
      throw new ServiceUnavailableException(
        `CMS write unavailable: Strapi not configured (set STRAPI_ADMIN_TOKEN). Cannot ${action}.`,
      );
    }
  }

  private async strapi<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.url}/api/${path}`, init);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(`Strapi ${init.method ?? 'GET'} ${path}: ${res.status} ${text}`);
    }
    return (await res.json()) as T;
  }

  // ── Reads (editor list/detail) ────────────────────────────

  async list(collection: string): Promise<unknown> {
    const spec = this.requireCollection(collection);
    this.assertLive('list (editor)');
    const json = await this.strapi<{ data: unknown }>(
      `${spec.strapiPlural}?pagination[pageSize]=100&publicationState=preview&populate=*`,
      { headers: this.headers(false) },
    );
    return json.data;
  }

  async get(collection: string, id: string): Promise<unknown> {
    const spec = this.requireCollection(collection);
    this.assertLive('get (editor)');
    const json = await this.strapi<{ data: unknown[] }>(
      `${spec.strapiPlural}?filters[slug][$eq]=${encodeURIComponent(id)}&publicationState=preview&populate=*`,
      { headers: this.headers(false) },
    );
    if (!json.data?.[0]) throw new NotFoundException(`${collection}/${id} not found`);
    return json.data[0];
  }

  // ── Writes ────────────────────────────────────────────────

  async create(collection: string, body: Record<string, unknown>): Promise<unknown> {
    const spec = this.requireCollection(collection);
    this.assertLive('create');
    const { base, localized } = this.buildStrapiPayloads(spec, body);

    // Slug / id key
    if (spec.idKey) {
      base[spec.idKey.strapiKey] = body[spec.idKey.bodyKey];
    } else {
      const source = this.slugSource(spec, body);
      base['slug'] = slugify(source);
    }

    const created = await this.strapi<{ data: { id: number } }>(spec.strapiPlural, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ data: { ...base, locale: 'sk' } }),
    });

    if (Object.keys(localized).length) {
      await this.createEnLocalization(spec, created.data.id, localized);
    }
    return created.data;
  }

  async update(collection: string, id: string, body: Record<string, unknown>): Promise<unknown> {
    const spec = this.requireCollection(collection);
    this.assertLive('update');
    const { base, localized } = this.buildStrapiPayloads(spec, body);
    const numericId = await this.resolveStrapiId(spec, id);

    const updated = await this.strapi<{ data: unknown }>(`${spec.strapiPlural}/${numericId}?locale=sk`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ data: base }),
    });

    if (Object.keys(localized).length) {
      await this.upsertEnLocalization(spec, numericId, localized);
    }
    return (updated as { data: unknown }).data;
  }

  async remove(collection: string, id: string): Promise<void> {
    const spec = this.requireCollection(collection);
    this.assertLive('delete');
    const numericId = await this.resolveStrapiId(spec, id);
    await this.strapi(`${spec.strapiPlural}/${numericId}`, {
      method: 'DELETE',
      headers: this.headers(false),
    });
  }

  // ── Singletons ────────────────────────────────────────────

  async getSingleton(name: string): Promise<unknown> {
    const spec = CMS_SINGLETONS[name];
    if (!spec) throw new BadRequestException(`Unknown singleton: ${name}`);
    this.assertLive('get singleton');
    const json = await this.strapi<{ data: unknown }>(`${spec.strapiSingular}?populate=*`, {
      headers: this.headers(false),
    });
    return json.data;
  }

  async putSingleton(name: string, body: Record<string, unknown>): Promise<unknown> {
    const spec = CMS_SINGLETONS[name];
    if (!spec) throw new BadRequestException(`Unknown singleton: ${name}`);
    this.assertLive('update singleton');
    const { base, localized } = this.buildSingletonPayloads(name, body);

    const updated = await this.strapi<{ data: unknown }>(`${spec.strapiSingular}?locale=sk`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ data: base }),
    });
    if (Object.keys(localized).length) {
      await this.strapi(`${spec.strapiSingular}?locale=en`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({ data: localized }),
      });
    }
    return (updated as { data: unknown }).data;
  }

  /**
   * Flatten singleton bodies into Strapi field names, split by locale.
   * hospital: flat fields. pages: nested {hero,about,aps} → heroBadge etc.
   */
  buildSingletonPayloads(name: string, body: Record<string, unknown>): StrapiPayloads {
    const base: Record<string, unknown> = {};
    const localized: Record<string, unknown> = {};

    if (name === 'hospital') {
      const spec = CMS_SINGLETONS.hospital;
      for (const f of spec.fields ?? []) {
        if (!(f.k in body) || body[f.k] === undefined) continue;
        const value = body[f.k];
        if ((f.t === 'biltext' || f.t === 'biltextarea') && value && typeof value === 'object') {
          const v = value as Record<string, unknown>;
          base[f.k] = v.sk ?? '';
          if (v.en !== undefined) localized[f.k] = v.en;
        } else {
          base[f.k] = value;
        }
      }
      return { base, localized };
    }

    if (name === 'pages') {
      const map: Record<string, Record<string, string>> = {
        hero: { badge: 'heroBadge', title: 'heroTitle', subtitle: 'heroSubtitle' },
        about: { title: 'aboutTitle', body: 'aboutBody' },
        aps: { title: 'apsTitle', note: 'apsNote' },
      };
      for (const [group, keys] of Object.entries(map)) {
        const g = body[group] as Record<string, unknown> | undefined;
        if (!g) continue;
        for (const [srcKey, strapiKey] of Object.entries(keys)) {
          const v = g[srcKey] as Record<string, unknown> | undefined;
          if (!v) continue;
          base[strapiKey] = v.sk ?? '';
          if (v.en !== undefined) localized[strapiKey] = v.en;
        }
      }
      return { base, localized };
    }
    return { base, localized };
  }

  // ── Media upload proxy ────────────────────────────────────

  async uploadMedia(file: UploadedMedia): Promise<{ id: number; url: string }> {
    validateMediaConstraints(file.mimetype, file.size);
    this.assertLive('upload media');

    const form = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype });
    form.append('files', blob, file.filename);

    const res = await fetch(`${this.url}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(`Strapi upload failed: ${res.status} ${text}`);
    }
    const arr = (await res.json()) as Array<{ id: number; url: string }>;
    const uploaded = arr[0];
    if (!uploaded) throw new BadRequestException('Strapi upload returned no file');
    return { id: uploaded.id, url: uploaded.url };
  }

  // (Reads require a live Strapi — there is no seed fallback for the CMS
  // editor. The public read API and the web's strapi-client own dev fallback.)

  // ── Internals ─────────────────────────────────────────────

  private requireCollection(collection: string): CmsCollection {
    const spec = CMS_COLLECTIONS[collection];
    if (!spec) throw new BadRequestException(`Unknown collection: ${collection}`);
    return spec;
  }

  private slugSource(spec: CmsCollection, body: Record<string, unknown>): string {
    const raw = body[spec.slugFrom];
    if (raw && typeof raw === 'object') return String((raw as Record<string, unknown>).sk ?? '');
    return String(raw ?? '');
  }

  private async resolveStrapiId(spec: CmsCollection, id: string): Promise<number | string> {
    // Numeric → already a Strapi id; otherwise resolve via slug/documentId.
    if (/^\d+$/.test(id)) return id;
    const filterKey = spec.idKey ? spec.idKey.strapiKey : 'slug';
    const json = await this.strapi<{ data: Array<{ id: number }> }>(
      `${spec.strapiPlural}?filters[${filterKey}][$eq]=${encodeURIComponent(id)}&publicationState=preview`,
      { headers: this.headers(false) },
    );
    const found = json.data?.[0];
    if (!found) throw new NotFoundException(`${spec.strapiPlural}/${id} not found`);
    return found.id;
  }

  /** True when no real Strapi is configured (dev/CI). Exposed for the controller. */
  get isFallback(): boolean {
    return this.useFallback;
  }

  private async createEnLocalization(
    spec: CmsCollection,
    baseId: number,
    localized: Record<string, unknown>,
  ): Promise<void> {
    await this.strapi(`${spec.strapiPlural}/${baseId}/localizations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ locale: 'en', ...localized }),
    }).catch((err) => this.logger.warn(`en localization create failed: ${String(err)}`));
  }

  private async upsertEnLocalization(
    spec: CmsCollection,
    baseId: number | string,
    localized: Record<string, unknown>,
  ): Promise<void> {
    // Strapi has no idempotent localization upsert; try create, fall back to PUT.
    try {
      await this.strapi(`${spec.strapiPlural}/${baseId}/localizations`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ locale: 'en', ...localized }),
      });
    } catch {
      await this.strapi(`${spec.strapiPlural}/${baseId}?locale=en`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({ data: localized }),
      }).catch((err) => this.logger.warn(`en localization update failed: ${String(err)}`));
    }
  }
}
