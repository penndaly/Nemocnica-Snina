'use client';

import { useState, FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Lock, User, Activity, Pill, FlaskConical, Calendar, LogOut, Download, ArrowRight, AlertTriangle } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import type { SupportedLocale } from '@/i18n/config';

// FHIR demo data — replaced by real FHIR R4 endpoint in production
const DEMO_PATIENT = {
  name: 'Jozef Mak',
  id: '850315/1234',
  dob: '1985-03-15',
  blood: 'A+',
  insurance: 'VšZP (25)',
};

const DEMO_CONDITIONS = [
  { id: 'c1', date: '2024-10-12', code: 'I10', dx: { sk: 'Esenciálna hypertenzia', en: 'Essential hypertension' }, status: 'active', doctor: 'MUDr. Jana Borščová' },
  { id: 'c2', date: '2022-04-05', code: 'E11', dx: { sk: 'Diabetes mellitus 2. typu', en: 'Type 2 diabetes mellitus' }, status: 'active', doctor: 'MUDr. Lenka Lajtarová' },
];

const DEMO_MEDS = [
  { id: 'm1', date: '2024-10-12', name: 'Nebivolol 5 mg', dose: { sk: '1× denne (ráno)', en: '1× daily (morning)' }, refills: 2 },
  { id: 'm2', date: '2024-09-20', name: 'Metformín 850 mg', dose: { sk: '2× denne (s jedlom)', en: '2× daily (with meals)' }, refills: 1 },
];

const DEMO_LABS = [
  { id: 'l1', date: '2024-09-28', test: { sk: 'Lipidový profil', en: 'Lipid panel' }, result: { sk: 'Cholesterol 5,8 mmol/l', en: 'Cholesterol 5.8 mmol/l' }, flag: 'high' as const, dept: { sk: 'Klinická biochémia', en: 'Clinical biochem' } },
  { id: 'l2', date: '2024-09-28', test: { sk: 'HbA1c', en: 'HbA1c' }, result: { sk: '48 mmol/mol (6,5 %)', en: '48 mmol/mol (6.5%)' }, flag: 'normal' as const, dept: { sk: 'Klinická biochémia', en: 'Clinical biochem' } },
];

const DEMO_APPOINTMENTS = [
  { id: 'a1', date: '2024-11-15', time: '09:30', clinic: { sk: 'Diabetologická ambulancia', en: 'Diabetology clinic' }, doctor: 'MUDr. Lenka Lajtarová' },
];

type Tab = 'overview' | 'records' | 'prescriptions' | 'labs';
const FLAG_COLORS = { high: 'var(--amber)', low: 'var(--red)', normal: 'var(--green)', critical: 'var(--red)' };

function loc(obj: Record<string, string>, locale: SupportedLocale): string {
  return obj[locale] ?? obj['sk'] ?? '';
}

export default function PortalPage() {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations();

  const [loggedIn, setLoggedIn] = useState(false);
  const [idInput, setIdInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!idInput.trim() || !pinInput.trim()) { setLoginError(locale === 'sk' ? 'Vyplňte všetky polia.' : 'Fill in all fields.'); return; }
    // Demo: accept any credentials — real auth uses OIDC/eID + 2FA
    setLoggedIn(true);
  }

  if (!loggedIn) {
    return (
      <SiteLayout activePath={`/${locale}/portal`}>
        <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ width: '100%', maxWidth: 400 }}>
            <div
              className="card"
              style={{ overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}
            >
              <div style={{ background: 'var(--blue-900)', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.6rem', color: '#d6e2f0' }}>
                <Lock size={28} />
                <h2 style={{ color: '#fff', margin: 0, fontFamily: 'Newsreader, serif' }}>{t('portal.title')}</h2>
                <p style={{ margin: 0, fontSize: '.85rem', opacity: .6 }}>Nemocnica Snina</p>
              </div>
              <form onSubmit={handleLogin} className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label className="field">
                  <span>{locale === 'sk' ? 'Rodné číslo / ID pacienta' : 'Birth number / Patient ID'}</span>
                  <input type="text" value={idInput} onChange={(e) => setIdInput(e.target.value)} required placeholder="YYMMDD/CCCC" />
                </label>
                <label className="field">
                  <span>{locale === 'sk' ? 'PIN / SMS kód' : 'PIN / SMS code'}</span>
                  <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} required inputMode="numeric" />
                </label>
                {loginError && <p role="alert" style={{ color: 'var(--red)', fontSize: '.88rem' }}>{loginError}</p>}
                <button type="submit" className="btn btn-primary btn-block btn-lg">
                  <Lock size={16} />
                  {t('login')}
                </button>
                <p style={{ fontSize: '.78rem', color: 'var(--ink-3)', textAlign: 'center' }}>
                  {locale === 'sk'
                    ? 'Produkcia: prihlásenie cez eID + 2FA. Demo akceptuje ľubovoľné hodnoty.'
                    : 'Production: login via eID + 2FA. Demo accepts any values.'}
                </p>
              </form>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const tabConfig: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: 'overview',      label: t('portal.overview'),      icon: <User     size={16} /> },
    { key: 'records',       label: t('portal.records'),       icon: <Activity size={16} /> },
    { key: 'prescriptions', label: t('portal.prescriptions'), icon: <Pill     size={16} /> },
    { key: 'labs',          label: t('portal.labs'),          icon: <FlaskConical size={16} /> },
  ];

  return (
    <SiteLayout activePath={`/${locale}/portal`}>
      <div style={{ padding: '2rem 0 4rem' }}>
        <div className="container">
          {/* Profile header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="avatar avatar-lg">JM</div>
              <div>
                <h2 style={{ margin: 0 }}>{DEMO_PATIENT.name}</h2>
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.3rem' }}>
                  <span className="chip">{DEMO_PATIENT.insurance}</span>
                  <span className="chip">{locale === 'sk' ? 'Skupina' : 'Blood'}: {DEMO_PATIENT.blood}</span>
                  <span className="chip">{locale === 'sk' ? 'Nar.' : 'DOB'}: {DEMO_PATIENT.dob}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setLoggedIn(false)}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}
            >
              <LogOut size={14} />
              {t('portal.logout')}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* Left nav */}
            <nav aria-label={locale === 'sk' ? 'Portál navigácia' : 'Portal navigation'}>
              {tabConfig.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  aria-current={tab === key ? 'page' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '.65rem',
                    width: '100%', padding: '.65rem .9rem', borderRadius: 'var(--radius-sm)',
                    background: tab === key ? 'var(--blue-50)' : 'transparent',
                    color: tab === key ? 'var(--blue-700)' : 'var(--ink-2)',
                    border: 'none', cursor: 'pointer',
                    fontFamily: 'Mulish, sans-serif', fontWeight: tab === key ? 700 : 500,
                    fontSize: '.92rem', textAlign: 'left',
                    transition: 'background .12s, color .12s',
                  }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </nav>

            {/* Content area */}
            <div>
              {tab === 'overview' && (
                <div>
                  <h3 style={{ marginBottom: '1rem' }}>{t('portal.overview')}</h3>
                  {DEMO_APPOINTMENTS.length > 0 && (
                    <div className="card card-pad" style={{ marginBottom: '1rem' }}>
                      <p className="eyebrow" style={{ marginBottom: '.5rem' }}>
                        {locale === 'sk' ? 'Najbližší termín' : 'Upcoming appointment'}
                      </p>
                      {DEMO_APPOINTMENTS.map((a) => (
                        <div key={a.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'var(--blue-50)', color: 'var(--blue-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Calendar size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{loc(a.clinic, locale)}</div>
                            <div style={{ fontSize: '.85rem', color: 'var(--ink-2)' }}>{a.date} {a.time} · {a.doctor}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                    {tabConfig.slice(1).map(({ key, label, icon }) => (
                      <button key={key} onClick={() => setTab(key)} className="card card-pad card-hover" style={{ display: 'flex', alignItems: 'center', gap: '.75rem', textAlign: 'left', cursor: 'pointer', border: 'none', background: 'var(--surface)' }}>
                        <div style={{ color: 'var(--blue-700)' }}>{icon}</div>
                        <span style={{ fontWeight: 600 }}>{label}</span>
                        <ArrowRight size={16} color="var(--blue-500)" style={{ marginLeft: 'auto' }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'records' && (
                <div>
                  <h3 style={{ marginBottom: '1rem' }}>{t('portal.records')}</h3>
                  <div className="card" style={{ overflowX: 'auto' }}>
                    <table className="data">
                      <thead>
                        <tr>
                          <th>{locale === 'sk' ? 'Dátum' : 'Date'}</th>
                          <th>ICD-10</th>
                          <th>{locale === 'sk' ? 'Diagnóza' : 'Diagnosis'}</th>
                          <th>{locale === 'sk' ? 'Lekár' : 'Doctor'}</th>
                          <th>{locale === 'sk' ? 'Stav' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DEMO_CONDITIONS.map((c) => (
                          <tr key={c.id}>
                            <td>{c.date}</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{c.code}</td>
                            <td>{loc(c.dx, locale)}</td>
                            <td style={{ fontSize: '.85rem' }}>{c.doctor}</td>
                            <td><span className={`badge ${c.status === 'active' ? 'badge-amber' : 'badge-green'}`}>{c.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'prescriptions' && (
                <div>
                  <h3 style={{ marginBottom: '1rem' }}>{t('portal.prescriptions')}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                    {DEMO_MEDS.map((m) => (
                      <div key={m.id} className="card card-pad" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <Pill size={20} color="var(--blue-600)" />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{m.name}</div>
                          <div style={{ fontSize: '.85rem', color: 'var(--ink-2)' }}>{loc(m.dose, locale)} · {locale === 'sk' ? `${m.refills} obnov.` : `${m.refills} refills`}</div>
                        </div>
                        <button className="btn btn-ghost btn-sm">
                          {t('portal.refillRequest')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'labs' && (
                <div>
                  <h3 style={{ marginBottom: '1rem' }}>{t('portal.labs')}</h3>
                  <div
                    style={{
                      background: 'var(--amber-50)', border: '1px solid var(--amber)',
                      borderRadius: 'var(--radius-sm)', padding: '.6rem .9rem',
                      display: 'flex', gap: '.5rem', alignItems: 'center',
                      fontSize: '.85rem', color: 'var(--amber)', marginBottom: '1rem',
                    }}
                    role="note"
                  >
                    <AlertTriangle size={14} />
                    {locale === 'sk'
                      ? 'Stiahnutie PDF výsledkov vyžaduje overenie 2FA. (Demo: simulované)'
                      : 'PDF download requires 2FA verification. (Demo: simulated)'}
                  </div>
                  <div className="card" style={{ overflowX: 'auto' }}>
                    <table className="data">
                      <thead>
                        <tr>
                          <th>{locale === 'sk' ? 'Dátum' : 'Date'}</th>
                          <th>{locale === 'sk' ? 'Vyšetrenie' : 'Test'}</th>
                          <th>{locale === 'sk' ? 'Výsledok' : 'Result'}</th>
                          <th>{locale === 'sk' ? 'Pracovisko' : 'Dept'}</th>
                          <th>PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DEMO_LABS.map((l) => (
                          <tr key={l.id}>
                            <td>{l.date}</td>
                            <td style={{ fontWeight: 600 }}>{loc(l.test, locale)}</td>
                            <td>
                              <span style={{ color: FLAG_COLORS[l.flag] ?? 'inherit', fontWeight: 700 }}>
                                {loc(l.result, locale)}
                              </span>
                            </td>
                            <td style={{ fontSize: '.82rem' }}>{loc(l.dept, locale)}</td>
                            <td>
                              <button className="btn btn-ghost btn-sm" onClick={() => alert('2FA verification required')}>
                                <Download size={13} />
                                {t('portal.downloadPdf')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
