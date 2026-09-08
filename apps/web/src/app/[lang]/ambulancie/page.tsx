import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Phone, MapPin, Clock, Info } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { getClinics } from '@/lib/strapi-client';
import { localizeField, localizelist } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';
import type { ClinicStatus } from '@ns/types';

const statusBadge: Record<ClinicStatus, { cls: string; dot: boolean }> = {
  open:       { cls: 'badge-green', dot: true },
  new:        { cls: 'badge-terra', dot: true },
  alert:      { cls: 'badge-amber', dot: false },
  closed:     { cls: 'badge-gray',  dot: false },
  comingSoon: { cls: 'badge-gray',  dot: false },
};

export default async function ClinicsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });
  const clinics = await getClinics(locale);

  return (
    <SiteLayout activePath={`/${locale}/ambulancie`}>
      <div style={{ padding: '2.5rem 0 4rem' }}>
        <div className="container">
          <p className="eyebrow">{t('nav.clinics')}</p>
          <h1 style={{ marginBottom: '1rem' }}>
            {locale === 'sk' ? 'Ambulancie' : 'Outpatient clinics'}
          </h1>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            {(['open', 'new', 'alert', 'closed', 'comingSoon'] as ClinicStatus[]).map((s) => (
              <span key={s} className={`badge ${statusBadge[s].cls}`}>
                {statusBadge[s].dot && <span className="dot" aria-hidden />}
                {t(`status.${s}`)}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {clinics.map((clinic) => {
              const sb = statusBadge[clinic.status];
              const scheduleItems = localizelist(clinic.schedule, locale);
              return (
                <div
                  key={clinic.id}
                  className="card"
                  style={{ display: 'grid', gridTemplateColumns: '1.7fr .9fr' }}
                >
                  {/* Left: info */}
                  <div className="card-pad" style={{ borderRight: '1px solid var(--line)' }}>
                    <p className="eyebrow" style={{ marginBottom: '.4rem' }}>
                      {localizeField(clinic.specialty, locale)}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.5rem' }}>
                      <span className={`badge ${sb.cls}`}>
                        {sb.dot && <span className="dot" aria-hidden />}
                        {t(`status.${clinic.status}`)}
                      </span>
                    </div>
                    <h3 style={{ marginBottom: '.4rem' }}>{localizeField(clinic.name, locale)}</h3>
                    <p style={{ fontSize: '.88rem', color: 'var(--ink-2)', marginBottom: '.75rem' }}>
                      {clinic.doctor || (locale === 'sk' ? 'Lekár bude oznámený' : 'Physician to be announced')}
                      {clinic.nurse && ` · ${clinic.nurse}`}
                    </p>
                    <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.75rem' }}>
                      {clinic.phone && (
                        <span className="chip">
                          <Phone size={13} />
                          <a href={`tel:${clinic.phone.replace(/[\s/]/g, '')}`} style={{ color: 'inherit' }}>
                            {clinic.phone}
                          </a>
                        </span>
                      )}
                      <span className="chip">
                        <MapPin size={13} />
                        {localizeField(clinic.location, locale)}
                      </span>
                      {clinic.referral && (
                        <span className="chip" style={{ color: 'var(--amber)', background: 'var(--amber-50)' }}>
                          {t('referralReq')}
                        </span>
                      )}
                    </div>
                    {/* Booking rule callout — only shown when rule text is present */}
                    {localizeField(clinic.bookingRule, locale) && (
                      <div
                        style={{
                          display: 'flex',
                          gap: '.6rem',
                          alignItems: 'flex-start',
                          background: 'var(--blue-50)',
                          border: '1px solid var(--blue-100)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '.65rem .9rem',
                          fontSize: '.88rem',
                          color: 'var(--blue-900)',
                          marginBottom: clinic.fee ? '.5rem' : 0,
                        }}
                        role="note"
                      >
                        <Info
                          size={16}
                          style={{ flexShrink: 0, marginTop: '2px', color: 'var(--blue-600)' }}
                          aria-hidden
                        />
                        <span>{localizeField(clinic.bookingRule, locale)}</span>
                      </div>
                    )}
                    {clinic.fee && (
                      <p style={{ fontSize: '.82rem', color: 'var(--ink-3)', marginTop: '.4rem' }}>
                        {localizeField(clinic.fee, locale)}
                      </p>
                    )}
                  </div>

                  {/* Right: schedule + book */}
                  <div className="card-pad" style={{ background: 'var(--bg-2)' }}>
                    <p
                      style={{
                        fontWeight: 700,
                        fontSize: '.78rem',
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-3)',
                        marginBottom: '.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '.35em',
                      }}
                    >
                      <Clock size={14} aria-hidden />
                      {t('schedule')}
                    </p>
                    <ul style={{ listStyle: 'none', margin: '0 0 1.2rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                      {scheduleItems.map((row, i) => (
                        <li
                          key={i}
                          style={{
                            fontSize: '.86rem',
                            paddingBottom: '.4rem',
                            borderBottom: '1px dashed var(--line)',
                            color: 'var(--ink-2)',
                          }}
                        >
                          {row}
                        </li>
                      ))}
                    </ul>
                    {clinic.bookable ? (
                      <Link
                        href={`/${locale}/objednanie?clinic=${clinic.id}`}
                        className="btn btn-primary btn-block"
                      >
                        {t('bookHere')}
                      </Link>
                    ) : (
                      <button className="btn btn-ghost btn-block" disabled aria-disabled="true">
                        {locale === 'sk' ? 'Online objednávanie nedostupné' : 'Online booking unavailable'}
                      </button>
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
