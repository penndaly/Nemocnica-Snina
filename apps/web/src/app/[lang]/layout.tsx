import React from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { locales, isValidLocale, type SupportedLocale } from '@/i18n/config';
import { GdprCookieBanner } from '@/components/GdprCookieBanner';
import '@ns/ui/globals.css';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;

  return {
    metadataBase: new URL('https://nemocnicasnina.sk'),
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      locale: lang,
      alternateLocale: locales.filter((l) => l !== lang),
      siteName: 'Nemocnica Snina',
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isValidLocale(lang)) notFound();

  const locale = lang as SupportedLocale;
  const messages = await getMessages();
  const t = await getTranslations({ locale });

  return (
    <html lang={locale} dir="ltr">
      <head>
        {locales.map((l) => (
          <link key={l} rel="alternate" hrefLang={l} href={`https://nemocnicasnina.sk/${l}`} />
        ))}
        <link rel="alternate" hrefLang="x-default" href="https://nemocnicasnina.sk/sk" />
        {/* High-contrast CSS injected via class on <html> by AccessibilityControls */}
        <style>{`
          .high-contrast {
            --blue-700: #003b7a; --blue-600: #003080; --blue-50: #e0ecff;
            --ink: #000000; --ink-2: #1a1a1a; --ink-3: #333333;
            --bg: #ffffff; --bg-2: #f0f0f0; --surface: #ffffff;
            --line: #767676; --green: #006633; --amber: #8a5200; --red: #9b0000;
          }
          .high-contrast .card { border-color: #767676; }
        `}</style>
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* WCAG 2.1 AA — skip link (SC 2.4.1) */}
          <a
            href="#main-content"
            style={{
              position: 'absolute',
              left: '-9999px',
              top: 'auto',
              width: 1,
              height: 1,
              overflow: 'hidden',
            }}
            onFocus={(e) => {
              const el = e.currentTarget;
              el.style.left = '1rem';
              el.style.top = '1rem';
              el.style.width = 'auto';
              el.style.height = 'auto';
              el.style.zIndex = '9999';
            }}
            onBlur={(e) => {
              const el = e.currentTarget;
              el.style.left = '-9999px';
              el.style.top = 'auto';
              el.style.width = '1px';
              el.style.height = '1px';
            }}
            className="btn btn-primary btn-sm"
          >
            {t('a11y.skipToContent')}
          </a>

          {children}
          <GdprCookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
