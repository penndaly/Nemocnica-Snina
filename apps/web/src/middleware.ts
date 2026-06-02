import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  // Match all paths except static files, API, and admin
  matcher: ['/((?!api|_next|_vercel|admin|.*\\..*).*)'],
};
