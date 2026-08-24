'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, AlertTriangle } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';
import type { Physician } from '@ns/types';

// Insurers per NCZI codes
const INSURERS = [
  { code: '25', name: 'Všeobecná zdravotná poisťovňa (VšZP)' },
  { code: '27', name: 'Dôvera zdravotná poisťovňa' },
  { code: '24', name: 'Union zdravotná poisťovňa' },
];

function validateRc(rc: string): boolean {
  const clean = rc.replace(/[\s/]/g, '');
  if (!/^\d{9,10}$/.test(clean)) return false;
  if (clean.length === 9) return true;
  return parseInt(clean, 10) % 11 === 0;
}

export default function OnboardingPage() {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations();

  const [allPhysicians, setAllPhysicians] = useState<Physician[]>([]);

  useEffect(() => {
    fetch(`/api/content?type=physicians&locale=${locale}`)
      .then((r) => r.json() as Promise<Physician[]>)
      .then(setAllPhysicians)
      .catch(() => {});
  }, [locale]);

  const acceptingPhysicians = allPhysicians.filter((p) => p.accepting);

  const [selectedPhysicianId, setSelectedPhysicianId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientRc, setPatientRc] = useState('');
  const [insurerCode, setInsurerCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [rcError, setRcError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState('');
  const [error, setError] = useState('');

  const selectedPhysician = allPhysicians.find((p) => p.id === selectedPhysicianId);
  // dept/clinic IDs come from the physician record; use them for display only
  // Department/clinic for the selected physician are resolved server-side in the
  // real onboarding flow; the success card shows the physician name only here.

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateRc(patientRc)) {
      setRcError(locale === 'sk' ? 'Neplatné rodné číslo.' : 'Invalid birth number.');
      return;
    }
    if (!selectedPhysicianId) return;
    setRcError('');
    setSubmitting(true);
    setError('');

    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/onboarding/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ physicianId: selectedPhysicianId, patientName, patientRc, insurerCode, phone, email: email || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? 'Submission failed');
      }
      const data = await res.json() as { applicationId: string };
      setApplicationId(data.applicationId);
      setSubmitted(true);
    } catch {
      // Dev fallback
      if (process.env['NODE_ENV'] === 'development') {
        setApplicationId(`APP-${Date.now().toString(36).toUpperCase()}`);
        setSubmitted(true);
      } else {
        setError(locale === 'sk' ? 'Chyba pri odosielaní žiadosti. Skúste prosím znova.' : 'Error submitting application. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <SiteLayout activePath={`/${locale}/registracia`}>
        <div style={{ padding: '3rem 0 5rem', minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
          <div className="container-narrow" style={{ textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-50)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <Check size={36} strokeWidth={2.5} />
            </div>
            <h1 style={{ marginBottom: '.5rem' }}>{t('onboarding.successTitle')}</h1>
            <p className="lede" style={{ marginBottom: '1.5rem' }}>{t('onboarding.successBody')}</p>
            <div className="card card-pad" style={{ display: 'inline-block', textAlign: 'left', minWidth: 320 }}>
              <p style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, color: 'var(--blue-700)', textAlign: 'center', marginBottom: '.75rem' }}>
                {applicationId}
              </p>
              {selectedPhysician && (
                <div style={{ fontSize: '.9rem', color: 'var(--ink-2)' }}>
                  <strong>{selectedPhysician.name}</strong>
                </div>
              )}
            </div>
            <p style={{ fontSize: '.85rem', color: 'var(--ink-3)', marginTop: '1.5rem', maxWidth: 400, margin: '1.5rem auto 0' }}>
              {locale === 'sk'
                ? 'Žiadosť bola odoslaná personálu na spracovanie. O výsledku vás budeme informovať na uvedenom telefónnom čísle.'
                : 'The application has been sent to staff for processing. You will be notified of the outcome at the phone number provided.'}
            </p>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout activePath={`/${locale}/registracia`}>
      <div style={{ padding: '2.5rem 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
        <div className="container-narrow">
          <p className="eyebrow">{locale === 'sk' ? 'Nový pacient' : 'New patient'}</p>
          <h1 style={{ marginBottom: '.5rem' }}>{t('onboarding.title')}</h1>
          <p className="lede">{t('onboarding.subtitle')}</p>
        </div>
      </div>

      <div style={{ padding: '2.5rem 0 4rem' }}>
        <div className="container-narrow">
          {acceptingPhysicians.length === 0 ? (
            <div style={{ background: 'var(--amber-50)', border: '1px solid var(--amber)', borderRadius: 'var(--radius)', padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <AlertTriangle size={22} color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, color: 'var(--amber)' }}>{t('onboarding.notAccepting')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Step 1: Choose physician */}
              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>
                  {locale === 'sk' ? '1. Vyberte lekára' : '1. Choose physician'}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                  {acceptingPhysicians.map((physician) => {
                    // dept/clinic IDs are physician.dept/physician.clinic; the label
                    // is resolved server-side at submit, so only the role is shown here.
                    const selected = selectedPhysicianId === physician.id;
                    return (
                      <button
                        key={physician.id}
                        type="button"
                        data-physician-id={physician.id}
                        data-accepting={physician.accepting}
                        onClick={() => setSelectedPhysicianId(physician.id)}
                        aria-pressed={selected}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '1rem',
                          background: selected ? 'var(--blue-50)' : 'var(--surface)',
                          border: `2px solid ${selected ? 'var(--blue-700)' : 'var(--line)'}`,
                          borderRadius: 'var(--radius)', padding: '1rem 1.2rem',
                          textAlign: 'left', cursor: 'pointer', width: '100%', transition: 'border .14s',
                        }}
                      >
                        <div
                          style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: selected ? 'var(--blue-700)' : 'var(--blue-100)',
                            color: selected ? '#fff' : 'var(--blue-700)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'Newsreader, serif', fontWeight: 600, flexShrink: 0,
                          }}
                        >
                          {physician.name.replace(/^(MUDr\.|Mgr\.|Bc\.)\s*/i, '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: selected ? 'var(--blue-700)' : 'var(--ink)' }}>
                            {physician.name}
                          </div>
                          <div style={{ fontSize: '.85rem', color: 'var(--ink-2)' }}>
                            {localizeField(physician.role, locale)}
                          </div>
                        </div>
                        <span className="badge badge-green">
                          <span className="dot" aria-hidden />
                          {t('accepting')}
                        </span>
                        {selected && <Check size={18} color="var(--blue-700)" />}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Step 2: Patient details */}
              {selectedPhysicianId && (
                <section style={{ marginBottom: '2rem' }}>
                  <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>
                    {locale === 'sk' ? '2. Údaje pacienta' : '2. Patient details'}
                  </h2>
                  <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
                    <label className="field">
                      <span>{t('onboarding.nameLabel')}</span>
                      <input type="text" name="patientName" value={patientName} onChange={e => setPatientName(e.target.value)} required autoComplete="name" />
                    </label>

                    <div>
                      <label className="field">
                        <span>{t('onboarding.rcLabel')}</span>
                        <input
                          type="text"
                          name="patientRc"
                          value={patientRc}
                          onChange={e => { setPatientRc(e.target.value); setRcError(''); }}
                          required
                          inputMode="numeric"
                          placeholder="YYMMDD/CCCC"
                          aria-describedby={rcError ? 'rc-err' : undefined}
                          aria-invalid={!!rcError}
                        />
                      </label>
                      {rcError && <p id="rc-err" role="alert" style={{ color: 'var(--red)', fontSize: '.85rem', marginTop: '.3rem' }}>{rcError}</p>}
                    </div>

                    <label className="field">
                      <span>{t('onboarding.insurerLabel')}</span>
                      <select name="insurerCode" value={insurerCode} onChange={e => setInsurerCode(e.target.value)} required>
                        <option value="">— {locale === 'sk' ? 'Vyberte poisťovňu' : 'Select insurer'} —</option>
                        {INSURERS.map(ins => (
                          <option key={ins.code} value={ins.code}>{ins.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>{locale === 'sk' ? 'Telefónne číslo' : 'Phone number'}</span>
                      <input type="tel" name="phone" value={phone} onChange={e => setPhone(e.target.value)} required autoComplete="tel" placeholder="+421 9XX XXX XXX" />
                    </label>

                    <label className="field">
                      <span>{locale === 'sk' ? 'E-mail (nepovinné)' : 'Email (optional)'}</span>
                      <input type="email" name="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                    </label>
                  </div>
                </section>
              )}

              {error && (
                <div style={{ background: 'var(--red-50)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', padding: '.65rem 1rem', color: 'var(--red)', fontSize: '.9rem', marginBottom: '1rem' }} role="alert">
                  <AlertTriangle size={14} style={{ display: 'inline', marginRight: '.4em' }} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={!selectedPhysicianId || submitting}
              >
                {submitting ? '…' : t('onboarding.submit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
