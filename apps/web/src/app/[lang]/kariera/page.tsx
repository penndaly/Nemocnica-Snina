import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { PageHero } from '@ns/ui';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { getJobPostings, getCareersInfo, getDepartments, getClinics, getHospitalInfo } from '@/lib/strapi-client';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';
import { heroProps } from '@/lib/media';

export default async function CareersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });
  const [jobs, careersInfo, departments, clinics, hospital] = await Promise.all([
    getJobPostings(locale),
    getCareersInfo(locale),
    getDepartments(locale),
    getClinics(locale),
    getHospitalInfo(locale),
  ]);

  const placeOf = (job: (typeof jobs)[number]) => {
    if (job.dept) return localizeField(departments.find((d) => d.id === job.dept)?.name, locale);
    if (job.clinic) return localizeField(clinics.find((c) => c.id === job.clinic)?.name, locale);
    return '';
  };

  return (
    <SiteLayout activePath={`/${locale}/kariera`}>
      <PageHero
        {...(await heroProps('careers-hero', locale))}
        breadcrumb={{ homeLabel: t('backHome'), homeHref: `/${locale}`, here: t('footer.careers') }}
      >
        <p className="eyebrow">{locale === 'sk' ? 'Kariéra' : 'Careers'}</p>
        <h1>{locale === 'sk' ? 'Voľné pracovné miesta' : 'Open positions'}</h1>
        <p className="lede">
          {locale === 'sk'
            ? 'Hľadáme lekárov, ktorí chcú budovať dlhodobú kariéru v regióne. Ponúkame podporu ďalšej špecializácie a motivačné zložky mzdy podľa zákona č. 578/2004 Z. z.'
            : "We're looking for physicians who want to build a long-term career in the region. We support further specialisation and offer motivational wage components under Act No. 578/2004."}
        </p>
      </PageHero>

      <div style={{ padding: '2.5rem 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.2rem' }}>
            {jobs.map((job) => (
              <div key={job.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                <div>
                  <span className="badge badge-blue">{placeOf(job)}</span>
                </div>
                <h3 style={{ margin: 0 }}>
                  <Link href={`/${locale}/kariera/${job.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {localizeField(job.title, locale)}
                  </Link>
                </h3>
                <p className="small muted" style={{ marginBottom: 0 }}>{localizeField(job.desc, locale)}</p>
                <a
                  href={`mailto:${hospital.email}?subject=${encodeURIComponent(localizeField(job.title, locale))}`}
                  className="btn btn-primary btn-sm mt-1"
                  style={{ alignSelf: 'flex-start' }}
                >
                  <FileText size={16} aria-hidden />
                  {locale === 'sk' ? 'Odpovedať na ponuku' : 'Apply for this role'}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section band-warm">
        <div className="container container-narrow">
          <div className="card card-pad">
            <h3>{locale === 'sk' ? 'Prečo pracovať v Nemocnici Snina' : 'Why work at Nemocnica Snina'}</h3>
            <ul>
              {careersInfo.benefits.map((benefit, i) => (
                <li key={i}>{localizeField(benefit, locale)}</li>
              ))}
            </ul>
            <p className="small muted" style={{ marginBottom: 0 }}>
              {locale === 'sk' ? 'Kontaktná osoba pre žiadosti' : 'Contact for applications'}:{' '}
              <b>{localizeField(careersInfo.contact, locale)}</b> · {careersInfo.phone} ·{' '}
              <a href={`mailto:${hospital.email}`}>{hospital.email}</a>
            </p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
