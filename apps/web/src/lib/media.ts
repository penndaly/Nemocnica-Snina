/**
 * Photo slots — MEDIA-1.
 *
 * Every hero on the public site is a *slot* (PageHero `slot="about-hero"`).
 * This module answers "which photo goes in this slot?" with a fixed order:
 *
 *   1. CMS  — Strapi `media-slots` row for the slot (populate image). The
 *             admin replaces, hides (`hidden: true` → no photo, the SVG art
 *             renders) or un-hides it. Read only when the CMS is configured
 *             (STRAPI_API_TOKEN set, same switch as strapi-client.ts).
 *   2. Manifest — apps/web/src/lib/media-manifest.json + /public/img: the
 *             32 licence-clean placeholder photographs sourced in IMG-0
 *             (docs/media/LICENSES.md). Served by the app itself, so the
 *             preview (no CMS) shows photos too.
 *   3. null — HospitalImage renders the illustrated placeholder art.
 *
 * Four hero slots had no photo of their own (IMG-0 gaps: every candidate
 * failed visual review — faces / real branding). They reuse the closest
 * sourced file (SLOT_ALIASES) rather than stay art-only; the reuse is
 * recorded in the CMS row (`reusedFrom`) so the admin sees it.
 *
 * Physician portraits are never placeholders (real, signed-release photos
 * only — IMG_1 §2); they stay monograms until Physician.avatar is set.
 */
import { cache } from 'react';
import manifest from './media-manifest.json';
import { CMS_ENABLED, STRAPI_URL, strapiGetRaw } from './strapi-client';

export interface MediaEntry {
  src: string; webp: string; avif: string;
  alt: { sk?: string; en?: string };
  placeholder?: boolean;
  credit?: string;
}
export interface ResolvedMedia {
  /** Absolute or root-relative URL usable by next/image. */
  url: string;
  alt: string;
  /** Attribution line to render on-page (CC BY-SA requires it). */
  credit: string | null;
  /** true = stock placeholder, not a Nemocnica Snina photo. */
  placeholder: boolean;
  source: 'cms' | 'manifest';
}

const MANIFEST = manifest as Record<string, MediaEntry>;

/** Hero slots without a photo of their own → the sourced file they reuse. */
export const SLOT_ALIASES: Record<string, string> = {
  'home-campus':    'about-hero',       // building exterior — the campus shot the home hero asks for
  'patients-hero':  'patients-room',    // a ward room — what a patient is coming to
  'contact-hero':   'news-hero',        // the building facade — where to find us
  'telehealth-hero':'teleconsult-hero', // doctor on a video call — a direct match, different slot id
};

/** `dept-<id>-hero` (department detail) → the department's in-page photo. */
function canonicalSlot(slot: string): string {
  const m = /^dept-([a-z0-9-]+)-hero$/.exec(slot);
  if (m) return `dept-${m[1]}`;
  return SLOT_ALIASES[slot] ?? slot;
}

/** Credit only needs rendering when the licence says so; the rest stays in LICENSES.md. */
function creditIfRequired(credit: string | undefined): string | null {
  if (!credit) return null;
  return /CC BY|attribution/i.test(credit) ? credit.split(' · ').slice(0, 2).join(' · ') + ' · ' + (credit.match(/CC BY[-A-Z0-9. ]*/)?.[0] ?? '') : null;
}

/** Synchronous, manifest-only. Safe in client components (booking wizard). */
export function staticMedia(slot: string, locale = 'sk'): ResolvedMedia | null {
  const key = canonicalSlot(slot);
  const e = MANIFEST[key];
  if (!e) return null;
  return {
    url: `/img/${e.webp}`,
    alt: (locale === 'en' ? e.alt.en : e.alt.sk) ?? e.alt.sk ?? '',
    credit: creditIfRequired(e.credit),
    placeholder: e.placeholder !== false,
    source: 'manifest',
  };
}

interface CmsSlotRow {
  id: number;
  attributes?: Record<string, unknown>;
  [k: string]: unknown;
}

/** All CMS rows, one request per render pass (React cache). */
const cmsSlots = cache(async (): Promise<Map<string, ResolvedMedia | null>> => {
  const map = new Map<string, ResolvedMedia | null>();
  if (!CMS_ENABLED) return map;
  try {
    const rows = await strapiGetRaw<CmsSlotRow[]>('media-slots?pagination[pageSize]=200&populate=image');
    for (const row of rows ?? []) {
      const a = (row.attributes ?? row) as Record<string, unknown>;
      const slot = String(a['slot'] ?? '');
      if (!slot) continue;
      if (a['hidden']) { map.set(slot, null); continue; }
      const img = ((a['image'] as Record<string, unknown>)?.['data'] as Record<string, unknown> | null)?.['attributes'] as Record<string, unknown> | undefined
        ?? (a['image'] as Record<string, unknown> | undefined);
      const url = img?.['url'] ? String(img['url']) : '';
      if (!url) continue; // no image uploaded → fall through to manifest
      map.set(slot, {
        url: url.startsWith('http') ? url : `${STRAPI_URL}${url}`,
        alt: String(a['altSk'] ?? ''),
        credit: creditIfRequired(a['credit'] ? String(a['credit']) : undefined),
        placeholder: a['placeholder'] !== false,
        source: 'cms',
      });
    }
  } catch (err) {
    console.error('[media] CMS media-slots unavailable, using manifest:', String(err));
  }
  return map;
});

/**
 * Server-side resolver: CMS row (may be an explicit `hidden` → null) →
 * manifest → null. `override` lets an entity's own media field win (a
 * department's Department.image on its detail hero).
 */
export async function getMediaSlot(slot: string, locale = 'sk', override?: string | null): Promise<ResolvedMedia | null> {
  if (override) return { url: override, alt: '', credit: null, placeholder: false, source: 'cms' };
  const cms = await cmsSlots();
  if (cms.has(slot)) {
    const v = cms.get(slot)!;
    if (v) return locale === 'en' ? v : v; // alt is Slovak-only in the CMS row today
    return null; // hidden by the admin
  }
  return staticMedia(slot, locale);
}

/** Props for <PageHero>: heroes are decorative (alt ""), the h1 carries meaning. */
export async function heroProps(slot: string, locale = 'sk', override?: string | null) {
  const m = await getMediaSlot(slot, locale, override);
  return { slot, alt: '', photoUrl: m?.url ?? null, credit: m?.credit ?? null };
}

/** Same, synchronous, for client components (manifest only — no CMS override). */
export function staticHeroProps(slot: string) {
  const m = staticMedia(slot);
  return { slot, alt: '', photoUrl: m?.url ?? null, credit: m?.credit ?? null };
}
