import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Clock } from 'lucide-react';
import { PageHero } from '@ns/ui';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { getEducationArticleBySlug, getEducationArticleSlugs } from '@/lib/strapi-client';
import { localizeField } from '@/lib/i18n-utils';
import { locales, type SupportedLocale } from '@/i18n/config';

export async function generateStaticParams() {
  const slugs = await getEducationArticleSlugs();
  return slugs.flatMap((slug) => locales.map((lang) => ({ lang, slug })));
}

export default async function EducationArticleDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const locale = lang as SupportedLocale;
  const article = await getEducationArticleBySlug(slug, locale);
  // Stub articles (no body) never got a link to this route, but guard the
  // direct-URL case the same way — "coming soon" isn't a valid detail page.
  if (!article || !article.body) notFound();

  const t = await getTranslations({ locale });

  return (
    <SiteLayout activePath={`/${locale}/edukacia`}>
      <PageHero
        slot="education-hero"
        alt=""
        breadcrumb={{ homeLabel: t('backHome'), homeHref: `/${locale}`, here: localizeField(article.title, locale) }}
      >
        <p className="eyebrow">{locale === 'sk' ? 'Materiály pre pacientov' : 'Patient education library'}</p>
        <h1 style={{ marginBottom: '.5rem' }}>{localizeField(article.title, locale)}</h1>
        {article.readingMinutes && (
          <span className="chip">
            <Clock size={13} />
            {locale === 'sk' ? `${article.readingMinutes} min čítania` : `${article.readingMinutes} min read`}
          </span>
        )}
      </PageHero>

      <div style={{ padding: '2.5rem 0 4rem' }}>
        <div className="container container-narrow">
          {/* Article body is trusted CMS/seed content (see educationArticles in
              apps/web/src/lib/seed.ts), never user input — same richtext
              convention as Department.desc in the Strapi schema. */}
          <div
            className="edu-body"
            dangerouslySetInnerHTML={{ __html: localizeField(article.body, locale) }}
          />
        </div>
      </div>
    </SiteLayout>
  );
}
