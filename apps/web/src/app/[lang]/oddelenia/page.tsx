import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { BedDouble, Users } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { SEED } from '@/lib/seed';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';

export default async function DepartmentsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });

  return (
    <SiteLayout activePath={`/${locale}/oddelenia`}>
      <div style={{ padding: '2.5rem 0 4rem' }}>
        <div className="container">
          <p className="eyebrow">{t('nav.departments')}</p>
          <h1 style={{ marginBottom: '2rem' }}>
            {locale === 'sk' ? 'Oddelenia nemocnice' : 'Hospital departments'}
          </h1>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '1.2rem',
            }}
          >
            {SEED.departments.map((dept) => (
              <Link
                key={dept.id}
                href={`/${locale}/oddelenia/${dept.id}`}
                className="card card-hover"
                style={{ textDecoration: 'none', display: 'block', color: 'inherit' }}
              >
                <div
                  className="ph"
                  style={{ aspectRatio: '16/9' }}
                  data-label={localizeField(dept.short, locale)}
                  role="img"
                  aria-label={localizeField(dept.short, locale)}
                />
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
