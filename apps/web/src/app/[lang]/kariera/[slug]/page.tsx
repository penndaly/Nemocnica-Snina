import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { FileText } from 'lucide-react';
import { PageHero } from '@ns/ui';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { getJobPostingBySlug, getJobPostingSlugs, getDepartments, getClinics, getHospitalInfo } from '@/lib/strapi-client';
import { localizeField } from '@/lib/i18n-utils';
import { locales, type SupportedLocale } from '@/i18n/config';

export async function generateStaticParams() {
  const slugs = await getJobPostingSlugs();
  return slugs.flatMap((slug) => locales.map((lang) => ({ lang, slug })));
}

export default async function JobPostingDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const locale = lang as SupportedLocale;
  const [job, departments, clinics, hospital] = await Promise.all([
    getJobPostingBySlug(slug, locale),
    getDepartments(locale),
    getClinics(locale),
    getHospitalInfo(locale),
  ]);
  if (!job) notFound();

  const t = await getTranslations({ locale });
  const place = job.dept
    ? localizeField(departments.find((d) => d.id === job.dept)?.name, locale)
    : job.clinic
    ? localizeField(clinics.find((c) => c.id === job.clinic)?.name, locale)
    : '';

  return (
    <SiteLayout activePath={`/${locale}/kariera`}>
      <PageHero
        slot="careers-hero"
        alt=""
        breadcrumb={{ homeLabel: t('backHome'), homeHref: `/${locale}`, here: localizeField(job.title, locale) }}
      >
        <p className="eyebrow">{place}</p>
        <h1>{localizeField(job.title, locale)}</h1>
      </PageHero>

      <div style={{ padding: '2.5rem 0 4rem' }}>
        <div className="container container-narrow">
          <p style={{ lineHeight: 1.7, color: 'var(--ink-2)' }}>{localizeField(job.desc, locale)}</p>
          <a
            href={`mailto:${hospital.email}?subject=${encodeURIComponent(localizeField(job.title, locale))}`}
            className="btn btn-primary mt-2"
          >
            <FileText size={16} aria-hidden />
            {locale === 'sk' ? 'Odpovedať na ponuku' : 'Apply for this role'}
          </a>
        </div>
      </div>
    </SiteLayout>
  );
}
