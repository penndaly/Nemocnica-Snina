import type { Loc, LocList } from '@ns/types';
import type { SupportedLocale } from '@/i18n/config';

/** Resolve a localized string to the active locale, fallback to sk then en */
export function localizeField(field: Loc | undefined, locale: SupportedLocale): string {
  if (!field) return '';
  return field[locale] ?? field['sk'] ?? field['en'] ?? '';
}

/** Resolve a localized string array */
export function localizelist(field: LocList | undefined, locale: SupportedLocale): string[] {
  if (!field) return [];
  return field[locale] ?? field['sk'] ?? field['en'] ?? [];
}
