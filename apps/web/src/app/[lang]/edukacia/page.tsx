import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { PageHero } from '@ns/ui';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { getEducationArticles } from '@/lib/strapi-client';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';
import type { EducationCategory } from '@ns/types';
import { heroProps } from '@/lib/media';

const CATEGORY_ORDER: EducationCategory[] = ['predoperacne', 'chronicke', 'materska', 'dieta', 'fyziatria'];

const CATEGORY_LABEL: Record<EducationCategory, { sk: string; en: string }> = {
  predoperacne: { sk: 'Pred operáciou a anestézia', en: 'Pre-operative & anesthesia' },
  chronicke: { sk: 'Chronické a akútne stavy', en: 'Chronic & acute management' },
  materska: { sk: 'Materská a detská starostlivosť', en: 'Maternal & pediatric care' },
  dieta: { sk: 'Nemocničná diétna terapia', en: 'Inpatient nutritional therapy' },
  fyziatria: { sk: 'Fyziatria a rehabilitácia', en: 'Physiatry & rehabilitation' },
};

export default async function EducationPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { lang } = await params;
  const { category } = await searchParams;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });
  const articles = await getEducationArticles(locale);

  const activeCategory = CATEGORY_ORDER.includes(category as EducationCategory)
    ? (category as EducationCategory)
    : null;
  const categories = activeCategory ? [activeCategory] : CATEGORY_ORDER;

  return (
    <SiteLayout activePath={`/${locale}/edukacia`}>
      <PageHero
        {...(await heroProps('education-hero', locale))}
        breadcrumb={{ homeLabel: t('backHome'), homeHref: `/${locale}`, here: t('footer.education') }}
      >
        <p className="eyebrow">
          {locale === 'sk' ? 'Materiály pre pacientov' : 'Patient education library'}
        </p>
        <h1>
          {locale === 'sk' ? 'Zrozumiteľné informácie namiesto PDF' : 'Clear information instead of PDFs'}
        </h1>
        <p className="lede">
          {locale === 'sk'
            ? 'Predoperačná príprava, chronické ochorenia, materská starostlivosť, diétna terapia a rehabilitácia — ako prehľadné, mobilné a prístupné webové stránky, nie skenované dokumenty.'
            : "Pre-operative prep, chronic conditions, maternity care, diet therapy and rehabilitation — as clear, mobile-friendly, accessible web pages, not scanned documents."}
        </p>
      </PageHero>

      <div style={{ padding: '2.5rem 0 4rem' }}>
        <div className="container">
          {/* Category filter — plain links so it's server-rendered and works with JS off. */}
          <div role="group" aria-label={locale === 'sk' ? 'Filtrovať podľa kategórie' : 'Filter by category'} style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <Link
              href={`/${locale}/edukacia`}
              aria-current={activeCategory === null ? 'true' : undefined}
              className={activeCategory === null ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
            >
              {locale === 'sk' ? 'Všetky' : 'All'}
            </Link>
            {CATEGORY_ORDER.map((cat) => (
              <Link
                key={cat}
                href={`/${locale}/edukacia?category=${cat}`}
                aria-current={activeCategory === cat ? 'true' : undefined}
                className={activeCategory === cat ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
              >
                {locale === 'sk' ? CATEGORY_LABEL[cat].sk : CATEGORY_LABEL[cat].en}
              </Link>
            ))}
          </div>

          {categories.map((cat) => {
            const catArticles = articles.filter((a) => a.category === cat);
            if (catArticles.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: '2.5rem' }}>
                <h2 style={{ marginBottom: '1rem' }}>
                  {locale === 'sk' ? CATEGORY_LABEL[cat].sk : CATEGORY_LABEL[cat].en}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  {catArticles.map((article) =>
                    article.body ? (
                      <Link
                        key={article.id}
                        href={`/${locale}/edukacia/${article.slug}`}
                        className="card card-hover card-pad"
                        style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
                      >
                        <h4 style={{ margin: 0 }}>{localizeField(article.title, locale)}</h4>
                        <span className="badge badge-blue" style={{ flex: '0 0 auto' }}>
                          {locale === 'sk' ? 'Plný článok' : 'Full article'}
                        </span>
                      </Link>
                    ) : (
                      <div
                        key={article.id}
                        className="card card-pad"
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
                      >
                        <div>
                          <h4 style={{ margin: '0 0 .3rem' }}>{localizeField(article.title, locale)}</h4>
                          <p className="small muted" style={{ margin: 0 }}>{localizeField(article.excerpt, locale)}</p>
                        </div>
                        <span className="badge badge-gray" style={{ flex: '0 0 auto' }}>
                          {locale === 'sk' ? 'Pripravujeme' : 'Coming soon'}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SiteLayout>
  );
}
