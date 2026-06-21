import { getTranslations } from 'next-intl/server';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { NewsHashHighlight } from '@/components/NewsHashHighlight';
import { getNewsItems } from '@/lib/strapi-client';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';

const badgeClass: Record<string, string> = {
  good: 'badge-green',
  info: 'badge-blue',
  alert: 'badge-amber',
};

export default async function NewsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });
  const news = await getNewsItems(locale);

  return (
    <SiteLayout activePath={`/${locale}/aktuality`}>
      <NewsHashHighlight />
      <div style={{ padding: '2.5rem 0 4rem' }}>
        <div className="container-narrow">
          <p className="eyebrow">{t('nav.news')}</p>
          <h1 style={{ marginBottom: '2rem' }}>{locale === 'sk' ? 'Aktuality' : 'News & announcements'}</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {news.map((item) => (
              <article
                key={item.id}
                id={item.id}
                className="card card-pad"
                style={{ borderLeft: item.type === 'alert' ? '4px solid var(--amber)' : undefined }}
              >
                <div style={{ display: 'flex', gap: '.7rem', alignItems: 'center', marginBottom: '.5rem' }}>
                  <span className={`badge ${badgeClass[item.type] ?? 'badge-blue'}`}>
                    {localizeField(item.tag, locale)}
                  </span>
                  <time
                    dateTime={item.date}
                    style={{ fontSize: '.82rem', color: 'var(--ink-3)', marginLeft: 'auto' }}
                  >
                    {new Date(item.date).toLocaleDateString(locale === 'sk' ? 'sk-SK' : 'en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </time>
                </div>
                <h3 style={{ marginBottom: '.5rem' }}>{localizeField(item.title, locale)}</h3>
                <p style={{ color: 'var(--ink-2)', fontSize: '.92rem' }}>{localizeField(item.body, locale)}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
