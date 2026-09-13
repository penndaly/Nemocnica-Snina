import { locales, type SupportedLocale } from './config';
import rue from '../messages/rue.json';

/**
 * Locales that may be advertised to crawlers (hreflang alternates, sitemap,
 * indexable) — I18N-RUE. A locale whose UI chrome is still the Slovak
 * fallback must NOT be listed as a translation: search engines would index
 * /rue as a duplicate of /sk. It stays reachable by direct URL only until
 * section 1 of docs/RUE_TRANSLATION_WORKLIST.md (the chrome namespaces) is
 * fully filled — then it becomes public automatically, no code change.
 */
const CHROME_NAMESPACES = ['brand', 'nav', 'navGroups', 'footer', 'a11y', 'login', 'more', 'backHome'] as const;

function allFilled(v: unknown): boolean {
  if (typeof v === 'string') return v.trim() !== '';
  if (v && typeof v === 'object') return Object.values(v as Record<string, unknown>).every(allFilled);
  return false;
}

const RUE_CHROME_COMPLETE = CHROME_NAMESPACES.every((ns) => allFilled((rue as Record<string, unknown>)[ns]));

export const publicLocales: readonly SupportedLocale[] = locales.filter((l) => l !== 'rue' || RUE_CHROME_COMPLETE);

export function isPublicLocale(locale: string): boolean {
  return (publicLocales as readonly string[]).includes(locale);
}
