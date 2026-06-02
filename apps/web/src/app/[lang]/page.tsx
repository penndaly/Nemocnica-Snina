import { getTranslations } from 'next-intl/server';
import { Phone, PhoneCall, ArrowRight, BedDouble, Users } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { SEED } from '@/lib/seed';
import { localizeField, localizelist } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });
  const title = localizeField(SEED.pages.hero.title, locale);
  return {
    title: `Nemocnica Snina — ${title}`,
    description: localizeField(SEED.pages.hero.subtitle, locale),
  };
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });

  const hero = SEED.pages.hero;
  const hospital = SEED.hospital;
  const featuredDepts = SEED.departments.filter((d) => d.featured).slice(0, 3);
  const acceptingPhysicians = SEED.physicians.filter((p) => p.accepting).slice(0, 3);
  const recentNews = SEED.news.slice(0, 4);
  const aps = SEED.pages.aps;

  const newsTypeColor: Record<string, string> = {
    good: 'badge-green',
    info: 'badge-blue',
    alert: 'badge-amber',
  };

  return (
    <SiteLayout activePath={`/${locale}`}>
      {/* ── Hero ──────────────────────────────────────────── */}
      <section
        style={{
          background: 'var(--bg)',
          paddingTop: '3.5rem',
          paddingBottom: '3.5rem',
        }}
      >
        <div className="container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.35fr .9fr',
              gap: '3rem',
              alignItems: 'start',
            }}
          >
            {/* Left: copy */}
            <div>
              <p className="eyebrow terra">{localizeField(hero.badge, locale)}</p>
              <h1 style={{ marginBottom: '1rem' }}>{localizeField(hero.title, locale)}</h1>
              <p className="lede" style={{ marginBottom: '1.8rem' }}>
                {localizeField(hero.subtitle, locale)}
              </p>
              <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <Link href={`/${locale}/objednanie`} className="btn btn-primary btn-lg">
                  {t('book')}
                </Link>
                <Link href={`/${locale}/lekari`} className="btn btn-ghost btn-lg">
                  {t('nav.doctors')}
                </Link>
              </div>
              {/* Trust chips */}
              <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                <span className="chip">
                  <BedDouble size={14} />
                  {SEED.departments.reduce((acc, d) => acc + d.beds, 0)} {t('beds')}
                </span>
                <span className="chip">
                  <Users size={14} />
                  {SEED.physicians.length} lekárov
                </span>
              </div>
            </div>

            {/* Right: emergency card */}
            <div
              className="card card-pad"
              style={{ borderTop: '5px solid var(--red)' }}
              role="complementary"
              aria-label="Pohotovosť"
            >
              <p className="eyebrow" style={{ color: 'var(--red)', marginBottom: '.8rem' }}>
                {t('emergency')}
              </p>
              <a
                href="tel:112"
                className="btn btn-emergency btn-lg btn-block"
                style={{ marginBottom: '1.2rem', fontSize: '1.3rem' }}
                aria-label={t('callEmergency')}
              >
                <PhoneCall size={20} aria-hidden />
                112
              </a>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem', fontSize: '.9rem', color: 'var(--ink-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '.5rem' }}>
                  <span>{t('central')}</span>
                  <a href={`tel:${hospital.phone.replace(/\s/g, '')}`} style={{ fontWeight: 700, color: 'var(--blue-700)' }}>
                    {hospital.phone}
                  </a>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '.5rem' }}>
                  <span>Recepcia</span>
                  <a href={`tel:${hospital.reception.replace(/[\s/]/g, '')}`} style={{ fontWeight: 700, color: 'var(--blue-700)' }}>
                    {hospital.reception}
                  </a>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Lekáreň</span>
                  <a href={`tel:${hospital.pharmacy.replace(/[\s/]/g, '')}`} style={{ fontWeight: 700, color: 'var(--blue-700)' }}>
                    {hospital.pharmacy}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quick access ─────────────────────────────────── */}
      <section style={{ padding: '2.5rem 0', background: 'var(--bg-2)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {[
              { href: `/${locale}/oddelenia`, label: t('nav.departments'), icon: <BedDouble size={24} /> },
              { href: `/${locale}/ambulancie`, label: t('nav.clinics'), icon: <Phone size={24} /> },
              { href: `/${locale}/lekari`, label: t('nav.doctors'), icon: <Users size={24} /> },
            ].map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className="card card-pad card-hover"
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none' }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--blue-50)',
                    color: 'var(--blue-700)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  {icon}
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--ink)' }}>{label}</span>
                <ArrowRight size={18} color="var(--blue-600)" style={{ marginLeft: 'auto' }} aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Accepting new patients ───────────────────────── */}
      <section style={{ padding: '3rem 0', background: 'var(--bg-2)' }}>
        <div className="container">
          <p className="eyebrow">{t('accepting')}</p>
          <h2 style={{ marginBottom: '1.5rem' }}>
            {locale === 'sk' ? 'Lekári prijímajúci nových pacientov' : 'Physicians accepting new patients'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {acceptingPhysicians.map((physician) => {
              const initials = physician.name
                .replace(/^(MUDr\.|Mgr\.|Bc\.)\s*/i, '')
                .split(' ')
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase();
              const dept = physician.dept ? SEED.departments.find((d) => d.id === physician.dept) : null;
              return (
                <div key={physician.id} className="card card-pad" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div className="avatar avatar-lg" aria-hidden>{initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: '.2rem' }}>{physician.name}</div>
                    <div style={{ fontSize: '.88rem', color: 'var(--ink-2)', marginBottom: '.5rem' }}>
                      {localizeField(physician.role, locale)}
                    </div>
                    <span className="badge badge-green">
                      <span className="dot" aria-hidden />
                      {t('accepting')}
                    </span>
                    {dept && (
                      <p style={{ fontSize: '.82rem', color: 'var(--ink-3)', marginTop: '.5rem' }}>
                        {localizeField(dept.short, locale)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Featured departments ──────────────────────────── */}
      <section style={{ padding: '3.5rem 0' }}>
        <div className="container">
          <p className="eyebrow">{locale === 'sk' ? 'Naše oddelenia' : 'Our departments'}</p>
          <h2 style={{ marginBottom: '1.5rem' }}>{t('nav.departments')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.2rem' }}>
            {featuredDepts.map((dept) => (
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
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--terra-50)',
                      color: 'var(--terra)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '.75rem',
                    }}
                    aria-hidden
                  >
                    <BedDouble size={22} />
                  </div>
                  <h3 style={{ marginBottom: '.4rem' }}>{localizeField(dept.short, locale)}</h3>
                  <p style={{ color: 'var(--ink-2)', fontSize: '.92rem', marginBottom: '.8rem' }}>
                    {localizeField(dept.summary, locale)}
                  </p>
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                    {dept.beds > 0 && (
                      <span className="chip">
                        <BedDouble size={13} />
                        {dept.beds} {t('beds')}
                      </span>
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
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <Link href={`/${locale}/oddelenia`} className="btn btn-ghost">
              {locale === 'sk' ? 'Všetky oddelenia' : 'All departments'}
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── News + APS ───────────────────────────────────── */}
      <section style={{ padding: '3.5rem 0', background: 'var(--bg-2)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .9fr', gap: '2.5rem', alignItems: 'start' }}>
            {/* News */}
            <div>
              <p className="eyebrow">{t('nav.news')}</p>
              <h2 style={{ marginBottom: '1.5rem' }}>{locale === 'sk' ? 'Aktuality' : 'Latest news'}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {recentNews.map((item) => (
                  <Link
                    key={item.id}
                    href={`/${locale}/aktuality#${item.id}`}
                    className="card card-pad"
                    style={{
                      display: 'block',
                      textDecoration: 'none',
                      color: 'inherit',
                      borderLeft: item.type === 'alert' ? '4px solid var(--amber)' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', gap: '.7rem', alignItems: 'flex-start', marginBottom: '.4rem' }}>
                      <span className={`badge ${newsTypeColor[item.type] ?? 'badge-blue'}`}>
                        {localizeField(item.tag, locale)}
                      </span>
                      <span style={{ fontSize: '.82rem', color: 'var(--ink-3)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                        {new Date(item.date).toLocaleDateString(locale === 'sk' ? 'sk-SK' : 'en-GB')}
                      </span>
                    </div>
                    <h4 style={{ margin: 0 }}>{localizeField(item.title, locale)}</h4>
                  </Link>
                ))}
              </div>
              <Link href={`/${locale}/aktuality`} className="btn btn-ghost" style={{ marginTop: '1rem' }}>
                {locale === 'sk' ? 'Všetky aktuality' : 'All news'}
                <ArrowRight size={16} />
              </Link>
            </div>

            {/* APS sidebar */}
            <aside>
              <div
                className="card card-pad"
                style={{ borderTop: '4px solid var(--blue-600)' }}
                aria-label={localizeField(aps.title, locale)}
              >
                <p className="eyebrow">{localizeField(aps.title, locale)}</p>
                <p style={{ fontSize: '.92rem', color: 'var(--ink-2)', marginBottom: '1rem' }}>
                  {localizeField(aps.note, locale)}
                </p>
                <Link href={`/${locale}/kontakt`} className="btn btn-ghost btn-sm btn-block">
                  {t('nav.contact')}
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
