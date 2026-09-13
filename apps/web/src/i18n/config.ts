import { LOCALES } from '@ns/types';

/** Derived from @ns/types LOCALES — the single locale list (I18N-RUE T1). */
export const locales = LOCALES;
export const defaultLocale = 'sk' as const;

export type SupportedLocale = (typeof locales)[number];

export function isValidLocale(locale: string): locale is SupportedLocale {
  return (locales as readonly string[]).includes(locale);
}

/** Native names, for the switcher and `lang`-attributed options (C5). */
export const localeNames: Record<SupportedLocale, string> = {
  sk: 'Slovenčina',
  cs: 'Čeština',
  pl: 'Polski',
  hu: 'Magyar',
  uk: 'Українська',
  en: 'English',
  rue: 'Русиньскый',
};

/**
 * BCP-47 tag for Intl formatting. `rue` has no CLDR data (Intl falls to the
 * root locale: "2026-09-12", "1,234.5"); Slovak regional convention is what
 * Rusyn speakers in the Snina region use, so map it to sk-SK for formatting
 * only. The other locales get their own tag instead of the previous
 * sk-or-en-GB switch.
 */
export function intlLocale(locale: string): string {
  switch (locale) {
    case 'sk': case 'rue': return 'sk-SK';
    case 'cs': return 'cs-CZ';
    case 'pl': return 'pl-PL';
    case 'hu': return 'hu-HU';
    case 'uk': return 'uk-UA';
    default: return 'en-GB';
  }
}
