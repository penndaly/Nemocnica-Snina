import React from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { Metadata } from 'next';
import { locales, isValidLocale, type SupportedLocale } from '@/i18n/config';
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
      languages: Object.fromEntries(
        locales.map((l) => [l, `/${l}`]),
      ),
    },
    openGraph: {
      locale: lang,
      alternateLocale: locales.filter((l) => l !== lang),
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

  const messages = await getMessages();

  return (
    <html lang={lang} dir="ltr">
      <head>
        {/* Reciprocal hreflang tags — injected by generateMetadata above */}
        {locales.map((l) => (
          <link
            key={l}
            rel="alternate"
            hrefLang={l}
            href={`https://nemocnicasnina.sk/${l}`}
          />
        ))}
        <link rel="alternate" hrefLang="x-default" href="https://nemocnicasnina.sk/sk" />
      </head>
      <body>
        <NextIntlClientProvider locale={lang as SupportedLocale} messages={messages}>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 btn btn-primary btn-sm">
            {/* Will be translated via useTranslations in client component */}
            Skip to content
          </a>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
