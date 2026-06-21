import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Video, Monitor, FileText, Check, ChevronRight } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { getTelehealthPage, getTelehealthClinics } from '@/lib/strapi-client';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';
import { locales } from '@/i18n/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale, namespace: 'telehealth' });
  return {
    title: `${t('navLabel')} — Nemocnica Snina`,
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/telehealth`])),
    },
  };
}

export default async function TelehealthPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });
  const th = await getTranslations({ locale, namespace: 'telehealth' });

  const [hero, clinics] = await Promise.all([
    getTelehealthPage(locale),
    getTelehealthClinics(locale),
  ]);

  const HOW_IT_WORKS = [
    { icon: <Monitor size={20} aria-hidden />, title: th('step1Title'), body: th('step1Body') },
    { icon: <Video size={20} aria-hidden />,   title: th('step2Title'), body: th('step2Body') },
    { icon: <Check size={20} aria-hidden />,   title: th('step3Title'), body: th('step3Body') },
    { icon: <FileText size={20} aria-hidden />,title: th('step4Title'), body: th('step4Body') },
  ];

  const REQUIREMENTS = [
    th('req1'), th('req2'), th('req3'), th('req4'),
  ];

  return (
    <SiteLayout activePath={`/${locale}/telehealth`}>
      {/* ── Hero ────────────────────────────────────────────── */}
      <section
        style={{
          padding: '4rem 0 3rem',
          background: 'linear-gradient(135deg, var(--blue-900) 0%, #1a3a6e 100%)',
          color: '#fff',
        }}
      >
        <div className="container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.15fr .85fr',
              gap: '3rem',
              alignItems: 'center',
            }}
          >
            {/* Left: copy */}
            <div>
              <span
                style={{
                  display: 'inline-block',
                  background: 'rgba(255,255,255,.12)',
                  color: '#e0efff',
                  borderRadius: 'var(--radius-sm)',
                  padding: '.25em .8em',
                  fontSize: '.82rem',
                  fontWeight: 700,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  marginBottom: '1rem',
                }}
              >
                {localizeField(hero.badge, locale)}
              </span>
              <h1
                style={{
                  fontFamily: 'Newsreader, Georgia, serif',
                  fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                  color: '#fff',
                  marginBottom: '1rem',
                  lineHeight: 1.18,
                }}
              >
                {localizeField(hero.title, locale)}
              </h1>
              <p
                style={{
                  fontSize: '1.1rem',
                  color: '#c8ddf5',
                  lineHeight: 1.6,
                  maxWidth: 500,
                  marginBottom: '2rem',
                }}
              >
                {localizeField(hero.subtitle, locale)}
              </p>
              <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                <Link
                  href={`/${locale}/portal`}
                  className="btn btn-primary btn-lg"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}
                >
                  <Video size={16} aria-hidden />
                  {th('heroJoinCta')}
                </Link>
                <Link
                  href={`/${locale}/objednanie?mode=telehealth`}
                  className="btn btn-ghost btn-lg"
                  style={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}
                >
                  {th('heroBookCta')}
                </Link>
              </div>
            </div>

            {/* Right: decorative video-room mockup */}
            <div
              aria-hidden="true"
              style={{
                background: 'var(--blue-900)',
                border: '1px solid rgba(255,255,255,.12)',
                borderRadius: 'var(--radius)',
                padding: '1.25rem',
                aspectRatio: '16/10',
                display: 'flex',
                flexDirection: 'column',
                gap: '.75rem',
              }}
            >
              {/* Mock video tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', flex: 1 }}>
                {['#1e3a5f', '#162e50'].map((bg, i) => (
                  <div
                    key={i}
                    style={{
                      background: bg,
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Video size={16} color="rgba(255,255,255,.5)" />
                    </div>
                  </div>
                ))}
              </div>
              {/* Mock controls bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '.5rem',
                  padding: '.5rem 0 .25rem',
                }}
              >
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: i === 3 ? 36 : 32,
                      height: i === 3 ? 36 : 32,
                      borderRadius: '50%',
                      background: i === 3 ? '#e53e3e' : 'rgba(255,255,255,.15)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Eligible clinics ────────────────────────────────── */}
      <section style={{ padding: '3.5rem 0', background: 'var(--bg-2)' }}>
        <div className="container">
          <h2 style={{ marginBottom: '1.75rem' }}>{th('eligibleClinicsTitle')}</h2>
          {clinics.length === 0 ? (
            <p style={{ color: 'var(--ink-3)' }}>
              {locale === 'sk' ? 'Žiadna ambulancia momentálne neponúka videokonzultácie.' : 'No clinics currently offer video consultations.'}
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {clinics.map((clinic) => (
                <div
                  key={clinic.id}
                  className="card card-pad"
                  style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}
                >
                  {/* Clinic header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem' }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'var(--blue-50)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                      aria-hidden
                    >
                      <Video size={18} color="var(--blue-700)" />
                    </div>
                    <div>
                      <p style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '.2rem' }}>
                        {localizeField(clinic.specialty, locale)}
                      </p>
                      <h3 style={{ fontSize: '1rem', margin: 0 }}>{localizeField(clinic.name, locale)}</h3>
                    </div>
                  </div>

                  {/* Telehealth rule */}
                  {clinic.telehealthRule && (
                    <p style={{ fontSize: '.85rem', color: 'var(--ink-2)', margin: 0 }}>
                      {localizeField(clinic.telehealthRule, locale)}
                    </p>
                  )}

                  {/* Chips */}
                  <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                    <span
                      className="chip"
                      style={{ color: 'var(--blue-700)', background: 'var(--blue-50)', display: 'inline-flex', alignItems: 'center', gap: '.3em' }}
                    >
                      <Video size={11} aria-hidden /> {t('booking.telehealthChip')}
                    </span>
                    {clinic.referral && (
                      <span className="chip" style={{ color: 'var(--amber)', background: 'var(--amber-50)' }}>
                        {t('referralReq')}
                      </span>
                    )}
                  </div>

                  {/* CTA */}
                  <div style={{ marginTop: 'auto', paddingTop: '.25rem' }}>
                    <Link
                      href={`/${locale}/objednanie?mode=telehealth&clinic=${clinic.id}`}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', width: '100%', justifyContent: 'center' }}
                    >
                      <Video size={14} aria-hidden />
                      {th('bookCta')}
                      <ChevronRight size={14} aria-hidden />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section style={{ padding: '3.5rem 0' }}>
        <div className="container">
          <h2 style={{ marginBottom: '2rem' }}>{th('howItWorksTitle')}</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {HOW_IT_WORKS.map((item, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'var(--blue-50)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--blue-700)',
                  }}
                >
                  {item.icon}
                </div>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'var(--blue-700)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '.75rem',
                    fontWeight: 800,
                  }}
                  aria-hidden
                >
                  {i + 1}
                </div>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>{item.title}</h3>
                <p style={{ fontSize: '.88rem', color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Requirements ────────────────────────────────────── */}
      <section style={{ padding: '3rem 0', background: 'var(--bg-2)' }}>
        <div className="container container-narrow">
          <h2 style={{ marginBottom: '1.25rem' }}>{th('requirementsTitle')}</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
            {REQUIREMENTS.map((req) => (
              <li key={req} style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', fontSize: '.95rem' }}>
                <Check size={16} color="var(--green)" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden />
                {req}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Legal note ──────────────────────────────────────── */}
      <section style={{ padding: '2rem 0' }}>
        <div className="container container-narrow">
          <div
            style={{
              background: 'var(--blue-50)',
              border: '1px solid var(--blue-200, #b8d4f8)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem 1.25rem',
              fontSize: '.88rem',
              color: 'var(--ink-2)',
              lineHeight: 1.6,
            }}
            role="note"
          >
            <strong style={{ display: 'block', marginBottom: '.3rem' }}>{th('legalNoteTitle')}</strong>
            {th('legalNote')}{' '}
            <Link href={`/${locale}/telehealth/sukromie`} style={{ color: 'var(--blue-700)' }}>
              {th('privacyTitle')} →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA band ────────────────────────────────────────── */}
      <section
        style={{
          padding: '4rem 0',
          background: 'var(--blue-900)',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        <div className="container container-narrow">
          <h2
            style={{
              fontFamily: 'Newsreader, Georgia, serif',
              fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
              color: '#fff',
              marginBottom: '.75rem',
            }}
          >
            {th('ctaTitle')}
          </h2>
          <p style={{ color: '#c8ddf5', marginBottom: '2rem', fontSize: '1.05rem' }}>{th('ctaBody')}</p>
          <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href={`/${locale}/objednanie?mode=telehealth`}
              className="btn btn-primary btn-lg"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}
            >
              <Video size={16} aria-hidden />
              {th('ctaPrimary')}
            </Link>
            <Link
              href="#eligible-clinics"
              className="btn btn-ghost btn-lg"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}
            >
              {th('ctaSecondary')}
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
