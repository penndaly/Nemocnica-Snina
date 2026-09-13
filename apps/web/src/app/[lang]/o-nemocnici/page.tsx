import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { PageHero } from '@ns/ui';
import { SiteLayout } from '@/components/layout/SiteLayout';
import {
  getAboutInfo,
  getLeadershipTeam,
  getHistory,
  getInvestments,
  getCertifications,
} from '@/lib/strapi-client';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';
import { heroProps } from '@/lib/media';

const JUMP_LINKS: Array<{ href: string; sk: string; en: string }> = [
  { href: '#vedenie', sk: 'Vedenie', en: 'Leadership' },
  { href: '#historia', sk: 'História', en: 'History' },
  { href: '#investicie', sk: 'Investície a hospodárenie', en: 'Investments & finances' },
  { href: '#ocenenia', sk: 'Certifikácie', en: 'Certifications' },
  { href: '#eticka-komisia', sk: 'Etická komisia', en: 'Ethics committee' },
];

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });
  const [about, leadershipTeam, history, investments, certifications] = await Promise.all([
    getAboutInfo(locale),
    getLeadershipTeam(locale),
    getHistory(locale),
    getInvestments(locale),
    getCertifications(locale),
  ]);

  const sk = locale === 'sk';
  const financialFigures: Array<{ value: string; label: string }> = [
    { value: about.financials.revenue, label: sk ? 'Ročné tržby' : 'Annual revenue' },
    { value: about.financials.assets, label: sk ? 'Celkové aktíva' : 'Total assets' },
    { value: about.financials.profit, label: sk ? 'Čistý zisk' : 'Net profit' },
  ];

  return (
    <SiteLayout activePath={`/${locale}/o-nemocnici`}>
      <PageHero
        {...(await heroProps('about-hero', locale))}
        breadcrumb={{ homeLabel: t('backHome'), homeHref: `/${locale}`, here: t('nav.about') }}
      >
        <p className="eyebrow">{sk ? 'O nemocnici' : 'About the hospital'}</p>
        <h1>{sk ? 'Osemdesiat rokov starostlivosti o región Snina' : 'Eight decades of care for the Snina region'}</h1>
        <p className="lede">
          {sk
            ? 'História, vedenie, kvalita a hospodárenie nemocnice — v úplnej transparentnosti.'
            : "The hospital's history, leadership, quality certifications and finances — in full transparency."}
        </p>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          {JUMP_LINKS.map((jump) => (
            <a key={jump.href} href={jump.href} className="chip">
              {sk ? jump.sk : jump.en}
            </a>
          ))}
        </div>
      </PageHero>

      {/* Leadership */}
      <div className="section" id="vedenie" style={{ scrollMarginTop: 90 }}>
        <div className="container">
          <h2>{sk ? 'Vedenie nemocnice' : 'Hospital leadership'}</h2>
          <p style={{ maxWidth: '72ch' }}>{localizeField(about.leadership, locale)}</p>
          <p className="small muted">{localizeField(about.owner, locale)}</p>
          <div className="grid grid-2 mt-2">
            {leadershipTeam.map((member) => (
              <div key={member.id} className="card card-pad">
                <h4 style={{ margin: 0 }}>{member.name}</h4>
                <p className="small muted mb-0">
                  {localizeField(member.role, locale)}
                  <br />
                  {member.phone}
                  {member.phone && member.email ? ' · ' : null}
                  {member.email && <a href={`mailto:${member.email}`}>{member.email}</a>}
                </p>
              </div>
            ))}
          </div>
          <div className="card card-pad mt-3">
            <h4 style={{ margin: '0 0 8px' }}>{sk ? 'Dozorná rada' : 'Supervisory board'}</h4>
            <p className="small muted mb-0">{about.board.join(' · ')}</p>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="section band-warm" id="historia" style={{ scrollMarginTop: 90 }}>
        <div className="container container-narrow">
          <h2>{sk ? 'História' : 'History'}</h2>
          <div className="hist-timeline mt-3">
            {history.map((milestone) => (
              <div key={milestone.id} className="hist-item">
                <div className="hist-year">{milestone.year}</div>
                <div className="hist-text">{localizeField(milestone.text, locale)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Investments & finances */}
      <div className="section" id="investicie" style={{ scrollMarginTop: 90 }}>
        <div className="container">
          <h2>{sk ? 'Kapitálové investície a hospodárenie' : 'Capital investment & finances'}</h2>
          <div className="grid grid-3 mt-2">
            {investments.map((investment) => (
              <div key={investment.id} className="card card-pad">
                <div className="eyebrow">{sk ? 'Investícia' : 'Investment'}</div>
                <h3 style={{ margin: '.1em 0' }}>{investment.amount}</h3>
                <p className="small muted mb-0">{localizeField(investment.desc, locale)}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-3 mt-2">
            {financialFigures.map((figure) => (
              <div key={figure.label} className="card card-pad" style={{ textAlign: 'center' }}>
                <h3 style={{ margin: '.1em 0', color: 'var(--blue-700)' }}>{figure.value}</h3>
                <p className="small muted mb-0">
                  {figure.label} ({about.financials.year})
                </p>
              </div>
            ))}
          </div>
          <p className="small muted mt-2">
            <Link href={`/${locale}/zverejnovanie`}>
              {sk ? 'Úplný register zmlúv a faktúr →' : 'Full contracts & invoices register →'}
            </Link>
          </p>
        </div>
      </div>

      {/* Quality & ranking */}
      <div className="section band-warm" id="ocenenia" style={{ scrollMarginTop: 90 }}>
        <div className="container">
          <h2>{sk ? 'Kvalita a hodnotenie' : 'Quality & ranking'}</h2>
          <div className="grid grid-2 mt-2">
            <div className="card card-pad">
              <h3>{sk ? 'Certifikácie' : 'Certifications'}</h3>
              {certifications.map((cert) => (
                <p key={cert.id}>
                  <span className="badge badge-blue">{cert.name}</span>
                  <br />
                  <span className="small muted">{localizeField(cert.desc, locale)}</span>
                </p>
              ))}
            </div>
            <div className="card card-pad">
              <h3>{sk ? 'Nezávislé hodnotenie' : 'Independent ranking'}</h3>
              <p className="mb-0">{localizeField(about.rankings, locale)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Governance committees */}
      <div className="section" id="eticka-komisia" style={{ scrollMarginTop: 90 }}>
        <div className="container">
          <div className="grid grid-2">
            <div className="card card-pad">
              <h3>{sk ? 'Etická komisia' : 'Ethics committee'}</h3>
              <p className="mb-0">{localizeField(about.ethics, locale)}</p>
            </div>
            <div className="card card-pad">
              <h3>{sk ? 'Nežiaduce udalosti' : 'Adverse events'}</h3>
              <p className="mb-0">{localizeField(about.adverseEvents, locale)}</p>
            </div>
          </div>
          <div className="grid grid-2 mt-2">
            <div className="card card-pad">
              <h3>{sk ? 'Antikorupčná linka' : 'Anti-corruption line'}</h3>
              <p className="mb-0">{localizeField(about.antiCorruption, locale)}</p>
            </div>
            <div className="card card-pad">
              <h3>{sk ? 'Transfúzna komisia' : 'Transfusion committee'}</h3>
              <p className="mb-0">{localizeField(about.transfusionCommittee, locale)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Careers CTA */}
      <div className="section band-blue">
        <div className="container container-narrow" style={{ textAlign: 'center' }}>
          <h2>{sk ? 'Pridajte sa k nášmu tímu' : 'Join our team'}</h2>
          <p style={{ maxWidth: '60ch', marginLeft: 'auto', marginRight: 'auto' }}>
            {sk
              ? 'Hľadáme lekárov naprieč odbormi — s podporou ďalšieho vzdelávania a motivačnými zložkami mzdy.'
              : "We're hiring physicians across specialties — with support for further training and a motivational wage component."}
          </p>
          <Link href={`/${locale}/kariera`} className="btn btn-terra mt-2">
            <Users size={16} aria-hidden />
            {sk ? 'Zobraziť voľné miesta' : 'View openings'}
          </Link>
        </div>
      </div>
    </SiteLayout>
  );
}
