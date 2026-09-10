import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { BedDouble, Phone, Clock, Check } from 'lucide-react';
import { PageHero } from '@ns/ui';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { getDepartments, getDepartmentBySlug, getPhysicians } from '@/lib/strapi-client';
import { localizeField, localizelist } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';

export async function generateStaticParams() {
  const departments = await getDepartments('sk');
  return departments.flatMap((dept) =>
    ['sk', 'cs', 'pl', 'hu', 'uk', 'en'].map((lang) => ({ lang, slug: dept.id })),
  );
}

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const locale = lang as SupportedLocale;
  const [dept, allPhysicians] = await Promise.all([
    getDepartmentBySlug(slug, locale),
    getPhysicians(locale),
  ]);
  if (!dept) notFound();

  const t = await getTranslations({ locale });
  const relatedPhysicians = allPhysicians.filter((p) => p.dept === dept.id);
  const facilities = localizelist(dept.facilities, locale);

  return (
    <SiteLayout activePath={`/${locale}/oddelenia`}>
      {/* Page hero */}
      <PageHero
        slot={`dept-${dept.id}-hero`}
        alt=""
        breadcrumb={{ homeLabel: t('backHome'), homeHref: `/${locale}`, here: localizeField(dept.short, locale) }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.2rem' }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,255,255,.14)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-hidden
          >
            <BedDouble size={28} />
          </div>
          <div>
            <p className="eyebrow">{t('nav.departments')}</p>
            <h1 style={{ marginBottom: '.5rem' }}>{localizeField(dept.name, locale)}</h1>
            <p className="lede">{localizeField(dept.summary, locale)}</p>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.75rem' }}>
              {dept.beds > 0 && (
                <span className="chip">
                  <BedDouble size={13} />
                  {dept.beds} {t('beds')}
                </span>
              )}
              {dept.phone && (
                <span className="chip">
                  <Phone size={13} />
                  {dept.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </PageHero>

      {/* Body: 2 col */}
      <div style={{ padding: '2.5rem 0 4rem' }}>
        <div className="container">
          <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr .9fr', gap: '2.5rem', alignItems: 'start' }}>
            {/* Left */}
            <div>
              <div
                className="ph"
                style={{ aspectRatio: '16/9', marginBottom: '1.5rem', borderRadius: 'var(--radius)' }}
                data-label={localizeField(dept.short, locale)}
                role="img"
                aria-label={localizeField(dept.short, locale)}
              />
              <h2 style={{ marginBottom: '.75rem' }}>{locale === 'sk' ? 'O oddelení' : 'About the department'}</h2>
              <p style={{ color: 'var(--ink-2)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                {localizeField(dept.desc, locale)}
              </p>

              {/* Facilities checklist */}
              {facilities.length > 0 && (
                <>
                  <h3 style={{ marginBottom: '.75rem' }}>
                    {locale === 'sk' ? 'Vybavenie a služby' : 'Facilities & services'}
                  </h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '.5rem',
                      marginBottom: '1.5rem',
                    }}
                  >
                    {facilities.map((item) => (
                      <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '.5rem' }}>
                        <Check size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden />
                        <span style={{ fontSize: '.92rem' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Related physicians */}
              {relatedPhysicians.length > 0 && (
                <>
                  <h3 style={{ marginBottom: '.75rem' }}>
                    {locale === 'sk' ? 'Lekári oddelenia' : 'Physicians'}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                    {relatedPhysicians.map((physician) => {
                      const initials = physician.name
                        .replace(/^(MUDr\.|Mgr\.|Bc\.)\s*/i, '')
                        .split(' ')
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join('')
                        .toUpperCase();
                      return (
                        <div
                          key={physician.id}
                          className="card card-pad"
                          style={{ display: 'flex', gap: '.9rem', alignItems: 'center' }}
                        >
                          <div className="avatar" aria-hidden>{initials}</div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{physician.name}</div>
                            <div style={{ fontSize: '.85rem', color: 'var(--ink-2)' }}>
                              {localizeField(physician.role, locale)}
                            </div>
                          </div>
                          {physician.accepting && (
                            <span className="badge badge-green" style={{ marginLeft: 'auto' }}>
                              <span className="dot" aria-hidden />
                              {t('accepting')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Right: sticky contact card — .detail-sidebar makes it static below 940px */}
            <div className="detail-sidebar" style={{ position: 'sticky', top: 'calc(var(--header-h) + 1rem)' }}>
              <div
                className="card card-pad"
                style={{ borderTop: '4px solid var(--blue-600)' }}
              >
                <h3 style={{ marginBottom: '1rem' }}>{locale === 'sk' ? 'Kontakt' : 'Contact'}</h3>
                <dl style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', fontSize: '.9rem' }}>
                  <div>
                    <dt style={{ fontWeight: 700, color: 'var(--ink-3)', fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {t('head')}
                    </dt>
                    <dd style={{ margin: 0 }}>{dept.lead}</dd>
                  </div>
                  {dept.deputy && (
                    <div>
                      <dt style={{ fontWeight: 700, color: 'var(--ink-3)', fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        {locale === 'sk' ? 'Zástupca' : 'Deputy'}
                      </dt>
                      <dd style={{ margin: 0 }}>{dept.deputy}</dd>
                    </div>
                  )}
                  {dept.phone && (
                    <div>
                      <dt style={{ fontWeight: 700, color: 'var(--ink-3)', fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        {t('phone')}
                      </dt>
                      <dd style={{ margin: 0 }}>
                        <a href={`tel:${dept.phone.replace(/[\s/]/g, '')}`} style={{ color: 'var(--blue-700)', fontWeight: 700 }}>
                          {dept.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                  {dept.visiting && (
                    <div>
                      <dt style={{ fontWeight: 700, color: 'var(--ink-3)', fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        <Clock size={12} style={{ display: 'inline', marginRight: '0.25em' }} aria-hidden />
                        {locale === 'sk' ? 'Návštevné hodiny' : 'Visiting hours'}
                      </dt>
                      <dd style={{ margin: 0 }}>{localizeField(dept.visiting, locale)}</dd>
                    </div>
                  )}
                </dl>
                <div style={{ marginTop: '1.2rem', display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                  <Link href={`/${locale}/objednanie?clinic=${dept.id}`} className="btn btn-primary btn-block">
                    {t('bookHere')}
                  </Link>
                  <Link href={`/${locale}/kontakt`} className="btn btn-ghost btn-block">
                    {locale === 'sk' ? 'Ako nás nájdete' : 'How to find us'}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
