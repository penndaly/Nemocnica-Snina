/**
 * Translation review management (Sprint A3, Part C).
 *
 * Lists pending machine translations, and approves/rejects them. Approval is
 * the ONLY path that publishes a CS/PL/HU/UK clinical entry — and it runs
 * through assertPublishable() so the review gate cannot be bypassed. Every
 * review writes an audit entry.
 *
 * Reads/writes go to Strapi; without a live Strapi (dev/CI) the queue is empty
 * and reviews return 503 (no silent success).
 */
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import {
  CLINICAL_COLLECTIONS,
  MACHINE_TRANSLATED_LOCALES,
  assertPublishable,
  normaliseCollection,
} from './translation-gate';

type Dict = Record<string, unknown>;
const STRAPI_PLURAL: Record<string, string> = {
  departments: 'departments', clinics: 'clinics', physicians: 'physicians',
  services: 'services', facilities: 'facilities', news: 'news-items',
};

interface Actor { staffId: string; email: string; role: string }

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly url: string;
  private readonly token: string;
  private readonly useFallback: boolean;

  constructor(private readonly cfg: ConfigService, private readonly audit: AuditService) {
    this.url = cfg.get<string>('STRAPI_ADMIN_URL') ?? cfg.get<string>('STRAPI_URL') ?? 'http://localhost:1337';
    const t = cfg.get<string>('STRAPI_ADMIN_TOKEN') || cfg.get<string>('STRAPI_API_TOKEN') || '';
    this.token = t;
    this.useFallback = !t || t === 'dev-token';
  }

  private headers() { return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }; }

  /** Pending review queue across clinical collections, grouped + per-locale counts. */
  async pending() {
    if (this.useFallback) return { total: 0, byCollection: {} as Record<string, unknown>, byLocale: {} };
    const byCollection: Record<string, { id: number; slug: string; locale: string; title: string }[]> = {};
    const byLocale: Record<string, number> = {};
    let total = 0;

    for (const collection of CLINICAL_COLLECTIONS) {
      const plural = STRAPI_PLURAL[collection];
      for (const locale of MACHINE_TRANSLATED_LOCALES) {
        try {
          const res = await fetch(
            `${this.url}/api/${plural}?locale=${locale}&filters[review_status][$eq]=needs_review&pagination[pageSize]=100`,
            { headers: this.headers() },
          );
          if (!res.ok) continue;
          const json = (await res.json()) as { data: Dict[] };
          for (const e of json.data ?? []) {
            const a = (e['attributes'] as Dict) ?? e;
            (byCollection[collection] ??= []).push({
              id: Number(e['id']),
              slug: String(a['slug'] ?? ''),
              locale,
              title: String(a['name'] ?? a['title'] ?? a['slug'] ?? ''),
            });
            byLocale[locale] = (byLocale[locale] ?? 0) + 1;
            total++;
          }
        } catch (err) {
          this.logger.warn(`pending() ${collection}/${locale}: ${String(err)}`);
        }
      }
    }
    return { total, byCollection, byLocale };
  }

  /** Approve or reject a locale entry. Approve publishes (via the gate); reject keeps draft. */
  async review(
    collection: string,
    id: string,
    locale: string,
    body: { status: 'approved' | 'rejected'; notes?: string },
    actor: Actor,
    ip?: string,
  ) {
    const coll = normaliseCollection(collection);
    if (!(coll in STRAPI_PLURAL)) throw new BadRequestException(`Unknown clinical collection: ${collection}`);
    if (!(MACHINE_TRANSLATED_LOCALES as readonly string[]).includes(locale)) {
      throw new BadRequestException(`Not a machine-translated locale: ${locale}`);
    }
    if (body.status !== 'approved' && body.status !== 'rejected') {
      throw new BadRequestException('status must be approved | rejected');
    }
    if (this.useFallback) {
      throw new ServiceUnavailableException('Translation review unavailable: Strapi not configured');
    }

    const plural = STRAPI_PLURAL[coll];
    const data: Dict = {
      review_status: body.status,
      reviewed_by: actor.email,
      reviewed_at: new Date().toISOString(),
      review_notes: body.notes ?? null,
    };
    // Approve publishes the locale entry — gate guards it; reject leaves draft.
    if (body.status === 'approved') {
      assertPublishable({ collection: coll, locale, reviewStatus: 'approved' });
      data.publishedAt = new Date().toISOString();
    } else {
      data.publishedAt = null;
    }

    const res = await fetch(`${this.url}/api/${plural}/${id}?locale=${locale}`, {
      method: 'PUT', headers: this.headers(), body: JSON.stringify({ data }),
    });
    if (!res.ok) {
      throw new BadRequestException(`Strapi review update failed: ${res.status} ${await res.text().catch(() => '')}`);
    }

    await this.audit.writeAuditEntry({
      // AuditLog.actorId has a hard FK to the legacy StaffUser table, not
      // StaffAccount (actor's type here) — omit it and keep the id in meta
      // instead. See staff-auth.service.ts's logEvent() for the original fix.
      actorName: actor.email,
      actorRole: actor.role,
      action: 'translation_reviewed',
      targetType: coll,
      targetId: id,
      meta: { collection: coll, locale, status: body.status, staffAccountId: actor.staffId },
      ipAddress: ip,
    });
    return { ok: true, status: body.status };
  }

  /** All locales for a content item with their review status. */
  async item(collection: string, id: string) {
    const coll = normaliseCollection(collection);
    if (!(coll in STRAPI_PLURAL)) throw new BadRequestException(`Unknown clinical collection: ${collection}`);
    if (this.useFallback) return { id, locales: [] };
    const plural = STRAPI_PLURAL[coll];
    const res = await fetch(`${this.url}/api/${plural}/${id}?populate=localizations`, { headers: this.headers() });
    if (!res.ok) throw new BadRequestException(`Strapi fetch failed: ${res.status}`);
    return (await res.json()) as unknown;
  }
}
