import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { BedDouble, Users } from 'lucide-react';
import { PageHero, HospitalImage } from '@ns/ui';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { getDepartments } from '@/lib/strapi-client';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';
import { heroProps } from '@/lib/media';
import { staticMedia } from '@/lib/media';

export default async function DepartmentsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });
  const departments = await getDepartments(locale);

  return (
    <SiteLayout activePath={`/${locale}/oddelenia`}>
      <PageHero
        {...(await heroProps('departments-hero', locale))}
        breadcrumb={{ homeLabel: t('backHome'), homeHref: `/${locale}`, here: t('nav.departments') }}
      >
        <p className="eyebrow">{t('nav.departments')}</p>
        <h1>{locale === 'sk' ? 'Oddelenia nemocnice' : 'Hospital departments'}</h1>
      </PageHero>
      <div style={{ padding: '2.5rem 0 4rem' }}>
        <div className="container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '1.2rem',
            }}
          >
            {departments.map((dept) => (
              <Link
                key={dept.id}
                href={`/${locale}/oddelenia/${dept.id}`}
                className="card card-hover"
                style={{ textDecoration: 'none', display: 'block', color: 'inherit' }}
              >
                {/* MEDIA-1: department photo (CMS Department.image → manifest dept-<id> → art). */}
                <div className="card-media">
                  <HospitalImage
                    slot={`dept-${dept.id}`}
                    alt={localizeField(dept.short, locale)}
                    photoUrl={dept.image?.url ?? staticMedia(`dept-${dept.id}`)?.url ?? null}
                  />
                </div>
                <div className="card-pad">
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--terra-50)',
                      color: 'var(--terra)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '.6rem',
                    }}
                    aria-hidden
                  >
                    <BedDouble size={20} />
                  </div>
                  <h3 style={{ marginBottom: '.3rem' }}>{localizeField(dept.short, locale)}</h3>
                  <p style={{ color: 'var(--ink-2)', fontSize: '.9rem', marginBottom: '.75rem' }}>
                    {localizeField(dept.summary, locale)}
                  </p>
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                    {dept.beds > 0 ? (
                      <span className="chip">
                        <BedDouble size={13} />
                        {dept.beds} {t('beds')}
                      </span>
                    ) : (
                      <span className="chip">{locale === 'sk' ? 'Ambulantné' : 'Outpatient'}</span>
                    )}
                    <span className="chip">
                      <Users size={13} />
                      {dept.lead}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
