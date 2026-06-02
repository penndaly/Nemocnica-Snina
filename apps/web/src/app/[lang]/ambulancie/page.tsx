import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Phone, MapPin, Clock } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { SEED } from '@/lib/seed';
import { localizeField, localizelist } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';
import type { ClinicStatus } from '@ns/types';

const statusBadge: Record<ClinicStatus, { cls: string; dot: boolean }> = {
  open:   { cls: 'badge-green', dot: true },
  new:    { cls: 'badge-blue',  dot: true },
  alert:  { cls: 'badge-amber', dot: false },
  closed: { cls: 'badge-gray',  dot: false },
};

export default async function ClinicsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });

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
            {(['open', 'new', 'alert', 'closed'] as ClinicStatus[]).map((s) => (
              <span key={s} className={`badge ${statusBadge[s].cls}`}>
                {statusBadge[s].dot && <span className="dot" aria-hidden />}
                {t(`status.${s}`)}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {SEED.clinics.map((clinic) => {
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
                      {clinic.doctor}
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
                    {/* Booking rule callout */}
                    <div
                      style={{
                        background: 'var(--blue-50)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '.6rem .9rem',
                        fontSize: '.86rem',
                        color: 'var(--blue-700)',
                        marginBottom: clinic.fee ? '.5rem' : 0,
                      }}
                      role="note"
                    >
                      {localizeField(clinic.bookingRule, locale)}
                    </div>
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
