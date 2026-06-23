/**
 * CMS write-API DTOs + server-side validation.
 *
 * The bilingual contract is a Sprint A1 non-negotiable: every localized field
 * is a `{ sk: string, en: string }` object, validated on the server — a forged
 * POST with a bare string or a missing locale is rejected, not silently coerced.
 *
 * Collections share a generic `:collection` route, so validation is driven by
 * the field specs in cms.schema.ts rather than one class per collection. The
 * `BilingualDto` class is the canonical shape (used directly by the typed
 * singleton DTOs and conceptually by the generic validator).
 */
import { BadRequestException } from '@nestjs/common';
import { IsString } from 'class-validator';
import { CMS_COLLECTIONS, CMS_SINGLETONS, type CmsField } from './cms.schema';

export class BilingualDto {
  @IsString()
  sk!: string;

  @IsString()
  en!: string;
}

function isBilingual(v: unknown): v is { sk: string; en: string } {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>).sk === 'string' &&
    typeof (v as Record<string, unknown>).en === 'string'
  );
}

function isBilingualList(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const okArr = (x: unknown) => Array.isArray(x) && x.every((s) => typeof s === 'string');
  return okArr(o.sk) && okArr(o.en);
}

/** Validate one field's value against its declared type. Returns an error string or null. */
function validateField(f: CmsField, value: unknown): string | null {
  switch (f.t) {
    case 'biltext':
    case 'biltextarea':
      return isBilingual(value)
        ? null
        : `${f.k} must be a bilingual object { sk: string, en: string }`;
    case 'billist':
      return isBilingualList(value)
        ? null
        : `${f.k} must be { sk: string[], en: string[] }`;
    case 'bool':
      return typeof value === 'boolean' ? null : `${f.k} must be a boolean`;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? null : `${f.k} must be a number`;
    case 'tags':
      return Array.isArray(value) && value.every((s) => typeof s === 'string')
        ? null
        : `${f.k} must be an array of strings`;
    case 'json':
      // bookingDays — array of weekday ints
      return Array.isArray(value) ? null : `${f.k} must be a JSON array`;
    case 'select':
      return typeof value === 'string' && (f.opts ?? []).includes(value)
        ? null
        : `${f.k} must be one of: ${(f.opts ?? []).join(', ')}`;
    case 'media':
      // { id, url } | id | null — uploaded separately via /api/cms/media
      return value === null || typeof value === 'object' || typeof value === 'number'
        ? null
        : `${f.k} must be a media reference, id, or null`;
    case 'ref':
    case 'text':
    case 'textarea':
    case 'date':
    default:
      return typeof value === 'string' ? null : `${f.k} must be a string`;
  }
}

/**
 * Validate a collection create/update body against its field spec.
 * `partial` (PUT) only validates the fields that are present; create (POST)
 * additionally requires the slug-source field.
 */
export function validateCollectionBody(
  collection: string,
  body: unknown,
  opts: { partial: boolean },
): Record<string, unknown> {
  const spec = CMS_COLLECTIONS[collection];
  if (!spec) throw new BadRequestException(`Unknown collection: ${collection}`);
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('Request body must be a JSON object');
  }
  const data = body as Record<string, unknown>;
  const errors: string[] = [];
  const byKey = new Map(spec.fields.map((f) => [f.k, f]));

  // Reject unknown keys (forbidNonWhitelisted parity for the generic route).
  for (const key of Object.keys(data)) {
    if (!byKey.has(key)) errors.push(`Unknown field: ${key}`);
  }

  // Required slug source on create.
  if (!opts.partial && (data[spec.slugFrom] === undefined || data[spec.slugFrom] === null)) {
    errors.push(`${spec.slugFrom} is required`);
  }

  for (const f of spec.fields) {
    const present = f.k in data && data[f.k] !== undefined && data[f.k] !== null;
    if (!present) continue;
    const err = validateField(f, data[f.k]);
    if (err) errors.push(err);
  }

  if (errors.length) throw new BadRequestException({ message: 'Validation failed', errors });
  return data;
}

/** Validate a singleton body (hospital flat fields, or nested pages shape). */
export function validateSingletonBody(name: string, body: unknown): Record<string, unknown> {
  const spec = CMS_SINGLETONS[name];
  if (!spec) throw new BadRequestException(`Unknown singleton: ${name}`);
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('Request body must be a JSON object');
  }
  const data = body as Record<string, unknown>;

  if (name === 'hospital' && spec.fields) {
    const errors: string[] = [];
    for (const f of spec.fields) {
      const present = f.k in data && data[f.k] !== undefined && data[f.k] !== null;
      if (!present) continue;
      const err = validateField(f, data[f.k]);
      if (err) errors.push(err);
    }
    if (errors.length) throw new BadRequestException({ message: 'Validation failed', errors });
    return data;
  }

  if (name === 'pages') {
    // Expect SEED.pages shape: { hero:{badge,title,subtitle}, about:{title,body}, aps:{title,note} }
    const errors: string[] = [];
    const groups: Record<string, string[]> = {
      hero: ['badge', 'title', 'subtitle'],
      about: ['title', 'body'],
      aps: ['title', 'note'],
    };
    for (const [group, keys] of Object.entries(groups)) {
      const g = data[group];
      if (g === undefined) continue; // partial update allowed
      if (typeof g !== 'object' || g === null) {
        errors.push(`${group} must be an object`);
        continue;
      }
      for (const key of keys) {
        const v = (g as Record<string, unknown>)[key];
        if (v === undefined) continue;
        if (!isBilingual(v)) errors.push(`${group}.${key} must be { sk, en }`);
      }
    }
    if (errors.length) throw new BadRequestException({ message: 'Validation failed', errors });
    return data;
  }

  return data;
}
