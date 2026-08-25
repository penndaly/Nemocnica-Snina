import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  // Locale-prefixed URLs are the source of truth for SEO (see
  // PRODUCTION_ARCHITECTURE.md: "not cookie/IP redirection — Googlebot won't
  // index hidden locales"). Accept-Language/cookie-based auto-detection would
  // make the unprefixed `/` redirect target depend on the visitor's browser,
  // which is exactly what that note rules out — so `/` always resolves to
  // the default locale (sk) regardless of Accept-Language.
  localeDetection: false,
});

export const config = {
  // Match all paths except static files, API, and admin
  matcher: ['/((?!api|_next|_vercel|admin|.*\\..*).*)'],
};
