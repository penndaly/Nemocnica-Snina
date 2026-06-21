'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Search } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';
import type { Physician, Department, Clinic } from '@ns/types';
import Link from 'next/link';

export default function PhysiciansPage() {
  const t = useTranslations();
  const locale = useLocale() as SupportedLocale;

  const [physicians,  setPhysicians]  = useState<Physician[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clinics,     setClinics]     = useState<Clinic[]>([]);
  const [query, setQuery] = useState('');
  const [acceptingOnly, setAcceptingOnly] = useState(false);
  const [langFilter, setLangFilter] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/content?type=physicians&locale=${locale}`).then((r) => r.json() as Promise<Physician[]>),
      fetch(`/api/content?type=clinics&locale=${locale}`).then((r) => r.json() as Promise<Clinic[]>),
    ])
      .then(([p, c]) => { setPhysicians(p); setClinics(c); })
      .catch(() => {});
  }, [locale]);

  const allLangs = Array.from(new Set(physicians.flatMap((p) => p.langs))).sort();

  const filtered = physicians.filter((p) => {
    const matchesQuery =
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      localizeField(p.role, locale).toLowerCase().includes(query.toLowerCase());
    const matchesAccepting = !acceptingOnly || p.accepting;
    const matchesLang = !langFilter || p.langs.includes(langFilter);
    return matchesQuery && matchesAccepting && matchesLang;
  });

  return (
    <SiteLayout activePath={`/${locale}/lekari`}>
      <div style={{ padding: '2.5rem 0 4rem' }}>
        <div className="container">
          <p className="eyebrow">{t('nav.doctors')}</p>
          <h1 style={{ marginBottom: '1.5rem' }}>
            {locale === 'sk' ? 'Naši lekári' : 'Our physicians'}
          </h1>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 300px' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }}
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={locale === 'sk' ? 'Hľadať lekára...' : 'Search physician...'}
                aria-label={locale === 'sk' ? 'Hľadať lekára' : 'Search physician'}
                style={{ paddingLeft: '2.2rem', width: '100%' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer', color: 'var(--green)' }}>
              <input
                type="checkbox"
                checked={acceptingOnly}
                onChange={(e) => setAcceptingOnly(e.target.checked)}
                style={{ accentColor: 'var(--green)', width: 16, height: 16 }}
              />
              {t('accepting')}
            </label>
          </div>

          {/* Language filter chips */}
          {allLangs.length > 0 && (
            <div
              role="group"
              aria-label={locale === 'sk' ? 'Filtrovať podľa jazyka' : 'Filter by language'}
              style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '2rem', alignItems: 'center' }}
            >
              <span style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--ink-3)', marginRight: '.2rem' }}>
                {locale === 'sk' ? 'Jazyk:' : 'Language:'}
              </span>
              <button
                onClick={() => setLangFilter(null)}
                aria-pressed={langFilter === null}
                className={`btn btn-sm ${langFilter === null ? 'btn-primary' : 'btn-ghost'}`}
              >
                {locale === 'sk' ? 'Všetky' : 'All'}
              </button>
              {allLangs.map((l) => (
                <button
                  key={l}
                  onClick={() => setLangFilter(langFilter === l ? null : l)}
                  aria-pressed={langFilter === l}
                  className={`btn btn-sm ${langFilter === l ? 'btn-primary' : 'btn-ghost'}`}
                >
                  <span className="lang-tag" aria-hidden>{l}</span>
                  {l}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '3rem 0' }}>
              {locale === 'sk' ? 'Žiadny lekár nezodpovedá hľadaniu.' : 'No physicians match your search.'}
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.2rem' }}>
              {filtered.map((physician) => {
                const initials = physician.name
                  .replace(/^(MUDr\.|Mgr\.|Bc\.|MBA\.?)\s*/gi, '')
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase();
                const dept   = physician.dept   ? departments.find((d) => d.id === physician.dept)   : null;
                const clinic = physician.clinic ? clinics.find((c)     => c.id === physician.clinic) : null;

                return (
                  <div key={physician.id} className="card card-pad">
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '.75rem' }}>
                      <div className="avatar avatar-lg" aria-hidden>{initials}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{physician.name}</div>
                        <div style={{ fontSize: '.88rem', color: 'var(--ink-2)' }}>
                          {localizeField(physician.role, locale)}
                        </div>
                        <div style={{ marginTop: '.4rem' }}>
                          {physician.accepting ? (
                            <span className="badge badge-green">
                              <span className="dot" aria-hidden />
                              {t('accepting')}
                            </span>
                          ) : (
                            <span className="badge badge-gray">{t('notAccepting')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <p style={{ fontSize: '.88rem', color: 'var(--ink-2)', marginBottom: '.75rem' }}>
                      {localizeField(physician.bio, locale)}
                    </p>

                    {/* Language tags */}
                    <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.75rem' }}>
                      {physician.langs.map((l) => (
                        <span key={l} className="lang-tag">{l}</span>
                      ))}
                    </div>

                    {/* Dept/clinic link */}
                    {dept && (
                      <Link
                        href={`/${locale}/oddelenia/${dept.id}`}
                        style={{ fontSize: '.82rem', color: 'var(--blue-700)', fontWeight: 600 }}
                      >
                        → {localizeField(dept.short, locale)}
                      </Link>
                    )}
                    {clinic && (
                      <Link
                        href={`/${locale}/ambulancie`}
                        style={{ fontSize: '.82rem', color: 'var(--blue-700)', fontWeight: 600 }}
                      >
                        → {localizeField(clinic.name, locale)}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
