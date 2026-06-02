import { getTranslations } from 'next-intl/server';
import { Phone, Check } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { SEED } from '@/lib/seed';
import { localizeField, localizelist } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';

export default async function DiagnosticsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });

  return (
    <SiteLayout activePath={`/${locale}/diagnostika`}>
      <div style={{ padding: '2.5rem 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <p className="eyebrow">{t('nav.diagnostics')}</p>
          <h1>{locale === 'sk' ? 'Diagnostika a podporné pracoviská (SVaLZ)' : 'Diagnostics & support facilities'}</h1>
        </div>
      </div>

      <div style={{ padding: '3rem 0 4rem' }}>
        <div className="container-narrow">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {SEED.facilities.map((facility) => {
              const features = localizelist(facility.features, locale);
              return (
                <div
                  key={facility.id}
                  className="card"
                  style={{ display: 'grid', gridTemplateColumns: '120px 1fr' }}
                >
                  {/* Icon rail */}
                  <div
                    style={{
                      background: 'var(--bg-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '1.5rem',
                      minHeight: 120,
                    }}
                    aria-hidden
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--blue-50)',
                        color: 'var(--blue-700)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.4rem',
                        fontFamily: 'Newsreader, serif',
                        fontWeight: 700,
                      }}
                    >
                      {localizeField(facility.name, locale).charAt(0)}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="card-pad">
                    <p className="eyebrow" style={{ marginBottom: '.3rem' }}>
                      {localizeField(facility.kind, locale)}
                    </p>
                    {facility.phone && (
                      <span className="chip" style={{ marginBottom: '.5rem', display: 'inline-flex' }}>
                        <Phone size={13} />
                        <a href={`tel:${facility.phone.replace(/[\s/]/g, '')}`} style={{ color: 'inherit' }}>
                          {facility.phone}
                        </a>
                      </span>
                    )}
                    <h3 style={{ marginBottom: '.4rem' }}>{localizeField(facility.name, locale)}</h3>
                    {facility.lead && (
                      <p style={{ color: 'var(--ink-2)', fontSize: '.88rem', marginBottom: '.5rem' }}>{facility.lead}</p>
                    )}
                    <p style={{ color: 'var(--ink-2)', fontSize: '.9rem', marginBottom: '.75rem' }}>
                      {localizeField(facility.desc, locale)}
                    </p>
                    {features.length > 0 && (
                      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                        {features.map((feat) => (
                          <span key={feat} className="chip" style={{ color: 'var(--green)' }}>
                            <Check size={13} aria-hidden />
                            {feat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
