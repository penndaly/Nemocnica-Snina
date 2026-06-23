import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Phone, Calendar, Building2, Stethoscope } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { getPhysicianBySlug, getPhysicianSlugs } from '@/lib/strapi-client';
import { localizeField } from '@/lib/i18n-utils';
import { locales, type SupportedLocale } from '@/i18n/config';

export async function generateStaticParams() {
  const slugs = await getPhysicianSlugs();
  return slugs.flatMap((slug) => locales.map((lang) => ({ lang, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const locale = lang as SupportedLocale;
  const physician = await getPhysicianBySlug(slug, locale);
  if (!physician) return { title: 'Nenájdené' };
  const role = localizeField(physician.role, locale);
  const bio = localizeField(physician.bio, locale);
  return {
    title: `${physician.name}${role ? ` — ${role}` : ''}`,
    description: bio.length > 160 ? `${bio.slice(0, 157)}…` : bio,
  };
}

/** Strip leading titles (MUDr., Mgr., Bc., MBA) and take up-to-2 initials. */
function initialsOf(name: string): string {
  return name
    .replace(/^(MUDr\.|Mgr\.|Bc\.|MBA\.?)\s*/gi, '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default async function PhysicianProfilePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const locale = lang as SupportedLocale;
  const physician = await getPhysicianBySlug(slug, locale);
  if (!physician) notFound();

  const t = await getTranslations({ locale });
  const role = localizeField(physician.role, locale);
  const bio = localizeField(physician.bio, locale);
  const { dept, clinic, facility, photo } = physician;

  return (
    <SiteLayout activePath={`/${locale}/lekari`}>
      {/* Breadcrumb */}
      <div style={{ background: 'var(--bg-2)', padding: '1rem 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <nav aria-label={locale === 'sk' ? 'Omrvinková navigácia' : 'Breadcrumb'} style={{ fontSize: '.85rem', color: 'var(--ink-3)' }}>
            <Link href={`/${locale}`} style={{ color: 'var(--blue-700)' }}>
              {locale === 'sk' ? 'Domov' : 'Home'}
            </Link>
            <span aria-hidden> / </span>
            <Link href={`/${locale}/lekari`} style={{ color: 'var(--blue-700)' }}>
              {t('nav.doctors')}
            </Link>
            <span aria-hidden> / </span>
            <span aria-current="page">{physician.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero: avatar + identity */}
      <div style={{ background: 'var(--bg-2)', padding: '2rem 0 2.5rem', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
            {photo?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.url}
                alt={physician.name}
                width={96}
                height={96}
                style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div className="avatar avatar-lg" style={{ width: 96, height: 96, fontSize: '1.6rem', flexShrink: 0 }} aria-hidden>
                {initialsOf(physician.name)}
              </div>
            )}
            <div style={{ flex: '1 1 280px' }}>
              <p className="eyebrow">{t('nav.doctors')}</p>
              <h1 style={{ marginBottom: '.4rem' }}>{physician.name}</h1>
              {role && <p className="lede" style={{ marginBottom: '.75rem' }}>{role}</p>}
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {physician.accepting ? (
                  <span className="badge badge-green">
                    <span className="dot" aria-hidden />
                    {t('accepting')}
                  </span>
                ) : (
                  <span className="badge badge-gray">{t('notAccepting')}</span>
                )}
                {physician.langs.map((l) => (
                  <span key={l} className="lang-tag">{l}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body: bio + affiliation sidebar */}
      <div style={{ padding: '2.5rem 0 4rem' }}>
        <div className="container">
          <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr .9fr', gap: '2.5rem', alignItems: 'start' }}>
            <div>
              <h2 style={{ marginBottom: '.75rem' }}>{locale === 'sk' ? 'Profil' : 'Profile'}</h2>
              <p style={{ color: 'var(--ink-2)', lineHeight: 1.7 }}>
                {bio || (locale === 'sk' ? 'Profil lekára bude doplnený.' : 'Physician profile to follow.')}
              </p>
            </div>

            <div className="detail-sidebar" style={{ position: 'sticky', top: 'calc(var(--header-h) + 1rem)' }}>
              <div className="card card-pad" style={{ borderTop: '4px solid var(--blue-600)' }}>
                <h3 style={{ marginBottom: '1rem' }}>{locale === 'sk' ? 'Pracovisko' : 'Affiliation'}</h3>

                {dept && (
                  <Link
                    href={`/${locale}/oddelenia/${dept.slug}`}
                    className="chip"
                    style={{ marginBottom: '.6rem', textDecoration: 'none' }}
                  >
                    <Building2 size={14} aria-hidden />
                    {localizeField(dept.short, locale)}
                  </Link>
                )}
                {clinic && (
                  <Link
                    href={`/${locale}/ambulancie`}
                    className="chip"
                    style={{ marginBottom: '.6rem', textDecoration: 'none' }}
                  >
                    <Stethoscope size={14} aria-hidden />
                    {localizeField(clinic.name, locale)}
                  </Link>
                )}
                {facility && (
                  <span className="chip" style={{ marginBottom: '.6rem' }}>
                    <Building2 size={14} aria-hidden />
                    {localizeField(facility.name, locale)}
                  </span>
                )}

                {clinic?.bookable && (
                  <Link
                    href={`/${locale}/objednanie?clinic=${clinic.slug}`}
                    className="btn btn-primary btn-block"
                    style={{ marginTop: '1rem' }}
                  >
                    <Calendar size={16} aria-hidden />
                    {t('bookHere')}
                  </Link>
                )}
                <Link href={`/${locale}/lekari`} className="btn btn-ghost btn-block" style={{ marginTop: '.6rem' }}>
                  <Phone size={16} aria-hidden />
                  {locale === 'sk' ? 'Všetci lekári' : 'All physicians'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
