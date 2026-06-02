/**
 * Admin data store — wraps the seed data during development.
 * In production this is replaced by CMS/API calls.
 * Provides the same CRUD interface as the prototype's DB object
 * but backed by React state (via a custom hook in AdminShell).
 */
import { SEED } from '@/lib/seed';
import type { Seed } from '@ns/types';

export type CollectionKey = keyof Pick<
  Seed,
  'departments' | 'clinics' | 'physicians' | 'services' | 'facilities' | 'news' | 'disclosures'
>;

export type SingletonKey = 'hospital' | 'pages';

export function slugify(s: string): string {
  return (s || 'item')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28) || 'item-' + Date.now();
}

/** Blank item for a given schema */
export function blankItem(fields: Array<{ k: string; t: string }>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.t === 'biltext' || f.t === 'biltextarea') o[f.k] = { sk: '', en: '' };
    else if (f.t === 'billist') o[f.k] = { sk: [], en: [] };
    else if (f.t === 'bool') o[f.k] = false;
    else if (f.t === 'tags') o[f.k] = [];
    else o[f.k] = '';
  }
  return o;
}

/** Deep clone the full seed for local editing */
export function cloneSeed(): Seed {
  return JSON.parse(JSON.stringify(SEED)) as Seed;
}
