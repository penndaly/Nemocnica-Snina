export const locales = ['sk', 'cs', 'pl', 'hu', 'uk', 'en'] as const;
export const defaultLocale = 'sk' as const;

export type SupportedLocale = (typeof locales)[number];

export function isValidLocale(locale: string): locale is SupportedLocale {
  return (locales as readonly string[]).includes(locale);
}
