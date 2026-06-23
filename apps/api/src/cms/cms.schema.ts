/**
 * CMS collection metadata — the single bridge between the prototype admin's
 * field vocabulary (design_handoff/assets/admin.js SCHEMAS) and the live Strapi
 * content types (apps/cms/src/api/**).
 *
 * It drives three things in the CMS write API:
 *   1. server-side validation (bilingual fields must be { sk, en }, etc.)
 *   2. slug derivation (which field the slug comes from — matches admin.js idFrom)
 *   3. i18n payload splitting (which fields are localized → get an `en`
 *      localization entry in Strapi, which are shared across locales)
 *
 * Field types mirror admin.js:
 *   text | textarea | number | date | bool | tags
 *   biltext | biltextarea | billist  (bilingual { sk, en } / { sk:[], en:[] })
 *   select  (enumeration)            | ref (relation → another collection)
 *   media   (file upload → { id, url })
 *
 * `strapiKey` is set only when the body key differs from the Strapi attribute
 * name (the prototype admin's key wins as the public contract).
 */

export type CmsFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'bool'
  | 'tags'
  | 'json'
  | 'biltext'
  | 'biltextarea'
  | 'billist'
  | 'select'
  | 'ref'
  | 'media';

export interface CmsField {
  k: string;
  t: CmsFieldType;
  /** Strapi attribute name when it differs from the body key (k). */
  strapiKey?: string;
  /** Allowed values for `select`. */
  opts?: string[];
  /** Target collection for `ref`. */
  ref?: string;
}

export interface CmsCollection {
  /** Strapi plural API path, e.g. `departments`, `news-items`. */
  strapiPlural: string;
  /** Body key whose value seeds the slug (matches admin.js `idFrom`). */
  slugFrom: string;
  /** For collections keyed by a user-supplied id instead of a slug. */
  idKey?: { bodyKey: string; strapiKey: string };
  fields: CmsField[];
  /** True if the Strapi type is draft-and-publish (collections) vs always-on. */
  draftAndPublish: boolean;
}

const bilingual = (t: CmsFieldType) => t === 'biltext' || t === 'biltextarea';

export function isBilingualField(f: CmsField): boolean {
  return bilingual(f.t);
}

/** A field whose value is locale-specific in Strapi i18n (gets an `en` entry). */
export function isLocalizedField(f: CmsField): boolean {
  return f.t === 'biltext' || f.t === 'biltextarea' || f.t === 'billist';
}

export const CMS_COLLECTIONS: Record<string, CmsCollection> = {
  departments: {
    strapiPlural: 'departments',
    slugFrom: 'short',
    draftAndPublish: true,
    fields: [
      { k: 'name', t: 'biltext' },
      { k: 'short', t: 'biltext' },
      { k: 'lead', t: 'text' },
      { k: 'leadRole', t: 'biltext' },
      { k: 'deputy', t: 'text' },
      { k: 'deputyRole', t: 'biltext' },
      { k: 'beds', t: 'number' },
      { k: 'phone', t: 'text' },
      { k: 'email', t: 'text' },
      { k: 'delivery', t: 'text' },
      { k: 'featured', t: 'bool' },
      { k: 'summary', t: 'biltext' },
      { k: 'desc', t: 'biltextarea' },
      { k: 'facilities', t: 'billist' },
      { k: 'visiting', t: 'biltext' },
    ],
  },
  clinics: {
    strapiPlural: 'clinics',
    slugFrom: 'name',
    draftAndPublish: true,
    fields: [
      { k: 'name', t: 'biltext' },
      { k: 'specialty', t: 'biltext' },
      { k: 'doctor', t: 'text' },
      { k: 'nurse', t: 'text' },
      { k: 'location', t: 'biltext' },
      { k: 'phone', t: 'text' },
      { k: 'status', t: 'select', opts: ['open', 'new', 'alert', 'closed'] },
      { k: 'bookable', t: 'bool' },
      { k: 'referral', t: 'bool' },
      { k: 'acceptingNew', t: 'bool' },
      { k: 'bookingDays', t: 'json' },
      { k: 'bookingWindow', t: 'text' },
      { k: 'schedule', t: 'billist' },
      { k: 'bookingRule', t: 'biltextarea' },
      { k: 'fee', t: 'biltext' },
      { k: 'opened', t: 'date' },
    ],
  },
  physicians: {
    strapiPlural: 'physicians',
    slugFrom: 'name',
    draftAndPublish: true,
    fields: [
      { k: 'name', t: 'text' },
      { k: 'role', t: 'biltext' },
      { k: 'bio', t: 'biltextarea' },
      { k: 'accepting', t: 'bool' },
      { k: 'dept', t: 'ref', ref: 'departments', strapiKey: 'department' },
      { k: 'clinic', t: 'ref', ref: 'clinics' },
      { k: 'facility', t: 'ref', ref: 'facilities' },
      { k: 'langs', t: 'tags' },
      { k: 'photo', t: 'media', strapiKey: 'avatar' },
    ],
  },
  services: {
    strapiPlural: 'services',
    slugFrom: 'name',
    draftAndPublish: true,
    fields: [
      { k: 'name', t: 'biltext' },
      { k: 'desc', t: 'biltextarea' },
      {
        k: 'icon',
        t: 'select',
        opts: ['scalpel', 'heart', 'activity', 'stethoscope', 'pulse', 'shield', 'flask', 'scan', 'pill'],
      },
      { k: 'dept', t: 'ref', ref: 'departments', strapiKey: 'department' },
      { k: 'clinic', t: 'ref', ref: 'clinics' },
      { k: 'facility', t: 'ref', ref: 'facilities' },
    ],
  },
  facilities: {
    strapiPlural: 'facilities',
    slugFrom: 'name',
    draftAndPublish: true,
    fields: [
      { k: 'name', t: 'biltext' },
      { k: 'lead', t: 'text' },
      { k: 'phone', t: 'text' },
      { k: 'kind', t: 'biltext' },
      { k: 'desc', t: 'biltextarea' },
      { k: 'features', t: 'billist' },
      { k: 'photo', t: 'media', strapiKey: 'avatar' },
    ],
  },
  news: {
    strapiPlural: 'news-items',
    slugFrom: 'title',
    draftAndPublish: true,
    fields: [
      { k: 'title', t: 'biltext' },
      { k: 'body', t: 'biltextarea' },
      { k: 'tag', t: 'biltext' },
      { k: 'type', t: 'select', opts: ['good', 'info', 'alert'] },
      { k: 'date', t: 'date' },
    ],
  },
  disclosures: {
    strapiPlural: 'disclosures',
    slugFrom: 'id',
    idKey: { bodyKey: 'id', strapiKey: 'documentId' },
    draftAndPublish: true,
    fields: [
      { k: 'id', t: 'text', strapiKey: 'documentId' },
      { k: 'type', t: 'biltext' },
      { k: 'partner', t: 'text' },
      { k: 'value', t: 'text' },
      { k: 'date', t: 'date' },
      { k: 'document', t: 'media', strapiKey: 'pdf' },
    ],
  },
};

export const CMS_COLLECTION_NAMES = Object.keys(CMS_COLLECTIONS);

/**
 * Singletons. The prototype `pages` singleton (admin.js) is nested
 * { hero, about, aps }; the live Strapi `pages-content` type is flat
 * (heroBadge, heroTitle, …). The CMS API accepts the nested SEED.pages shape
 * and the service flattens it to Strapi field names.
 */
export interface CmsSingleton {
  strapiSingular: string;
  /** Flat localized field map → Strapi key. Used by the hospital singleton. */
  fields?: CmsField[];
}

export const CMS_SINGLETONS: Record<string, CmsSingleton> = {
  hospital: {
    strapiSingular: 'hospital',
    fields: [
      { k: 'name', t: 'text' },
      { k: 'tagline', t: 'biltext' },
      { k: 'address', t: 'text' },
      { k: 'ico', t: 'text' },
      { k: 'dic', t: 'text' },
      { k: 'phone', t: 'text' },
      { k: 'reception', t: 'text' },
      { k: 'pharmacy', t: 'text' },
      { k: 'emergency', t: 'text' },
      { k: 'email', t: 'text' },
      { k: 'region', t: 'biltext' },
    ],
  },
  pages: {
    strapiSingular: 'pages-content',
  },
};
