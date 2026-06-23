'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Lock, User, Activity, Pill, FlaskConical, Calendar, LogOut, Download, ArrowRight, AlertTriangle, CreditCard, X, ShieldCheck, Video, Watch } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { WearablesTab } from './WearablesTab';
import type { SupportedLocale } from '@/i18n/config';
import type { FhirCondition, FhirMedicationRequest, FhirObservation, FhirAppointment } from '@ns/types';

type Tab = 'overview' | 'teleconsult' | 'records' | 'prescriptions' | 'labs' | 'payments' | 'wearables';
const FLAG_COLORS = { high: 'var(--amber)', low: 'var(--red)', normal: 'var(--green)', critical: 'var(--red)' };

// ── Teleconsult types ─────────────────────────────────────────

interface TeleconsultSession {
  id: string;
  scheduledAt: string;
  status: 'scheduled' | 'waiting' | 'active' | 'ended' | 'no_show' | 'cancelled';
  physicianName?: string;
  physicianSpecialty?: string;
  clinicName?: string;
  durationSeconds?: number;
}

function minutesUntil(isoDate: string): number {
  return Math.floor((new Date(isoDate).getTime() - Date.now()) / 60_000);
}

function fmtDuration(secs?: number): string {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function statusBadgeClass(status: TeleconsultSession['status']): string {
  switch (status) {
    case 'scheduled': return 'badge-blue';
    case 'waiting':   return 'badge-amber';
    case 'active':    return 'badge-green';
    case 'ended':     return 'badge-green';
    case 'no_show':   return 'badge-gray';
    case 'cancelled': return 'badge-gray';
    default:          return 'badge-gray';
  }
}

interface PaymentReceiptRow {
  id: string;
  transactionRef: string;
  bookingId?: string;
  createdAt: string;
}

interface PatientRecords {
  conditions:   FhirCondition[];
  medications:  FhirMedicationRequest[];
  observations: FhirObservation[];
  appointments: FhirAppointment[];
}

function loc(obj: Record<string, string>, locale: SupportedLocale): string {
  return obj[locale] ?? obj['sk'] ?? '';
}

interface PatientIdentity { sub: string; name: string; }

// ── Lab PDF step-up 2FA widget ────────────────────────────────

function LabPdfButton({ observationId, locale }: { observationId: string; locale: SupportedLocale }) {
  const [phase,   setPhase]   = useState<'idle' | 'phone' | 'otp' | 'busy' | 'done' | 'error'>('idle');
  const [phone,   setPhone]   = useState('');
  const [otp,     setOtp]     = useState('');
  const [errMsg,  setErrMsg]  = useState('');

  async function sendChallenge() {
    setPhase('busy');
    const r = await fetch(`/api/portal/labs?action=challenge&id=${observationId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    setPhase(r.ok ? 'otp' : 'error');
    if (!r.ok) setErrMsg(locale === 'sk' ? 'Nepodarilo sa odoslať kód.' : 'Failed to send code.');
  }

  async function downloadPdf() {
    setPhase('busy');
    const r = await fetch(`/api/portal/labs?action=download&id=${observationId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });
    if (!r.ok) {
      const body = await r.json() as { message?: string };
      setErrMsg(body.message ?? (locale === 'sk' ? 'Neplatný kód.' : 'Invalid code.'));
      setPhase('error');
      return;
    }
    // Trigger browser download from the blob
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `lab-result-${observationId}.pdf`; a.click();
    URL.revokeObjectURL(url);
    setPhase('done');
  }

  if (phase === 'idle') {
    return (
      <button className="btn btn-ghost btn-sm" onClick={() => setPhase('phone')} aria-haspopup="dialog">
        <Download size={13} aria-hidden="true" />
        {locale === 'sk' ? 'Stiahnuť PDF' : 'Download PDF'}
      </button>
    );
  }

  if (phase === 'phone') {
    return (
      <span style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
        <input
          type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="+421900…" aria-label={locale === 'sk' ? 'Telefón' : 'Phone'}
          style={{ width: 120, padding: '.25rem .4rem', border: '1px solid var(--line)', borderRadius: 6, fontSize: '.82rem' }}
        />
        <button className="btn btn-primary btn-sm" onClick={() => void sendChallenge()}
          disabled={!phone} aria-label={locale === 'sk' ? 'Odoslať kód' : 'Send code'}>
          {locale === 'sk' ? 'Odoslať' : 'Send'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setPhase('idle')} aria-label="Cancel">✕</button>
      </span>
    );
  }

  if (phase === 'otp') {
    return (
      <span style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
        <input
          type="text" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)}
          placeholder="123456" maxLength={6} aria-label={locale === 'sk' ? 'SMS kód' : 'SMS code'}
          style={{ width: 80, padding: '.25rem .4rem', border: '1px solid var(--line)', borderRadius: 6, fontSize: '.82rem', fontFamily: 'monospace' }}
        />
        <button className="btn btn-primary btn-sm" onClick={() => void downloadPdf()}
          disabled={otp.length < 6} aria-label={locale === 'sk' ? 'Overiť a stiahnuť' : 'Verify & download'}>
          {locale === 'sk' ? 'Overiť' : 'Verify'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setPhase('idle')} aria-label="Cancel">✕</button>
      </span>
    );
  }

  if (phase === 'busy') {
    return <span style={{ fontSize: '.82rem', color: 'var(--ink-3)' }}>…</span>;
  }
  if (phase === 'done') {
    return <span className="badge badge-green" style={{ fontSize: '.78rem' }}>✓</span>;
  }
  // error
  return (
    <span style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
      <span role="alert" style={{ color: 'var(--red)', fontSize: '.78rem' }}>{errMsg}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => { setPhase('idle'); setErrMsg(''); }}>
        {locale === 'sk' ? 'Znovu' : 'Retry'}
      </button>
    </span>
  );
}

// ── Medication refill request button ─────────────────────────

function RefillButton({ medicationId, locale }: { medicationId: string; locale: SupportedLocale }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function requestRefill() {
    setState('busy');
    try {
      const r = await fetch('/api/portal/refill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicationRequestId: medicationId }),
      });
      setState(r.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <span role="status" aria-live="polite" style={{ fontSize: '.82rem', color: 'var(--green)', fontWeight: 600 }}>
        {locale === 'sk' ? 'Žiadosť odoslaná.' : 'Request sent.'}
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span role="alert" aria-live="assertive" style={{ fontSize: '.82rem', color: 'var(--red)' }}>
        {locale === 'sk' ? 'Chyba — skúste znovu.' : 'Error — please retry.'}
      </span>
    );
  }
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => void requestRefill()}
      disabled={state === 'busy'}
      aria-live="polite"
    >
      {state === 'busy'
        ? (locale === 'sk' ? 'Odosielam…' : 'Sending…')
        : (locale === 'sk' ? 'Obnoviť recept' : 'Request refill')}
    </button>
  );
}

// ── Cancel appointment link ───────────────────────────────────

function CancelAppointmentLink({ bookingId, locale }: { bookingId: string; locale: SupportedLocale }) {
  const [href, setHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchCancelToken() {
    setLoading(true);
    try {
      const r = await fetch(`/api/portal/appointments/${bookingId}/cancel-token`);
      if (r.ok) {
        const data = await r.json() as { cancelToken?: string };
        if (data.cancelToken) {
          setHref(`/${locale}/objednanie/zrusit/${data.cancelToken}`);
        }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  if (href) {
    return (
      <a href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem', fontSize: '.82rem', color: 'var(--red)', textDecoration: 'none' }}>
        <X size={13} />
        {locale === 'sk' ? 'Zrušiť termín' : 'Cancel appointment'}
      </a>
    );
  }

  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => void fetchCancelToken()}
      disabled={loading}
      style={{ color: 'var(--red)', fontSize: '.82rem' }}
    >
      {loading
        ? '…'
        : (locale === 'sk' ? 'Zrušiť termín' : 'Cancel appointment')}
    </button>
  );
}

// ── Teleconsult summary PDF step-up 2FA ─────────────────────

function SummaryPdfButton({ sessionId, locale }: { sessionId: string; locale: SupportedLocale }) {
  const [phase,  setPhase]  = useState<'idle' | 'phone' | 'otp' | 'busy' | 'done' | 'error'>('idle');
  const [phone,  setPhone]  = useState('');
  const [otp,    setOtp]    = useState('');
  const [errMsg, setErrMsg] = useState('');

  async function sendChallenge() {
    setPhase('busy');
    const r = await fetch(`/api/telehealth/sessions/${sessionId}/summary?action=pdf-challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    setPhase(r.ok ? 'otp' : 'error');
    if (!r.ok) setErrMsg(locale === 'sk' ? 'Nepodarilo sa odoslať kód.' : 'Failed to send code.');
  }

  async function downloadPdf() {
    setPhase('busy');
    const r = await fetch(`/api/telehealth/sessions/${sessionId}/summary?action=pdf-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });
    if (!r.ok) {
      const body = await r.json() as { message?: string };
      setErrMsg(body.message ?? (locale === 'sk' ? 'Neplatný kód.' : 'Invalid code.'));
      setPhase('error');
      return;
    }
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `summary-${sessionId}.pdf`; a.click();
    URL.revokeObjectURL(url);
    setPhase('done');
  }

  if (phase === 'idle') return (
    <button className="btn btn-ghost btn-sm" onClick={() => setPhase('phone')} aria-haspopup="dialog">
      <Download size={13} aria-hidden="true" />
      {locale === 'sk' ? 'PDF' : 'PDF'}
    </button>
  );

  if (phase === 'phone') return (
    <span style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
        placeholder="+421900…" aria-label={locale === 'sk' ? 'Telefón' : 'Phone'}
        style={{ width: 120, padding: '.25rem .4rem', border: '1px solid var(--line)', borderRadius: 6, fontSize: '.82rem' }} />
      <button className="btn btn-primary btn-sm" onClick={() => void sendChallenge()} disabled={!phone}>
        {locale === 'sk' ? 'Odoslať' : 'Send'}
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => setPhase('idle')}>✕</button>
    </span>
  );

  if (phase === 'otp') return (
    <span style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
      <input type="text" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)}
        placeholder="123456" maxLength={6} aria-label={locale === 'sk' ? 'SMS kód' : 'SMS code'}
        style={{ width: 80, padding: '.25rem .4rem', border: '1px solid var(--line)', borderRadius: 6, fontSize: '.82rem', fontFamily: 'monospace' }} />
      <button className="btn btn-primary btn-sm" onClick={() => void downloadPdf()} disabled={otp.length < 6}>
        {locale === 'sk' ? 'Overiť' : 'Verify'}
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => setPhase('idle')}>✕</button>
    </span>
  );

  if (phase === 'busy') return <span style={{ fontSize: '.82rem', color: 'var(--ink-3)' }}>…</span>;
  if (phase === 'done') return <span className="badge badge-green" style={{ fontSize: '.78rem' }}>✓</span>;
  return (
    <span style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
      <span role="alert" style={{ color: 'var(--red)', fontSize: '.78rem' }}>{errMsg}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => { setPhase('idle'); setErrMsg(''); }}>
        {locale === 'sk' ? 'Znovu' : 'Retry'}
      </button>
    </span>
  );
}

const OIDC_ERROR_MESSAGES: Record<string, Record<SupportedLocale, string>> = {
  oidc_access_denied:  { sk: 'Prihlásenie cez eID bolo zamietnuté.',       en: 'eID login was denied.',               cs: 'Přihlášení přes eID bylo zamítnuto.', pl: 'Logowanie przez eID zostało odrzucone.', hu: 'Az eID bejelentkezést elutasították.', uk: 'Вхід через eID було відхилено.' },
  missing_code:        { sk: 'Neplatná odpoveď od prihlasovacieho servera.', en: 'Invalid response from login server.', cs: 'Neplatná odpověď od přihlašovacího serveru.', pl: 'Nieprawidłowa odpowiedź serwera logowania.', hu: 'Érvénytelen válasz a bejelentkezési szervertől.', uk: 'Недійсна відповідь від сервера входу.' },
  missing_verifier:    { sk: 'Platnosť relácie vypršala. Skúste znovu.',    en: 'Session expired. Please try again.',   cs: 'Relace vypršela. Zkuste to znovu.', pl: 'Sesja wygasła. Spróbuj ponownie.', hu: 'A munkamenet lejárt. Próbálja újra.', uk: 'Сесія закінчилася. Спробуйте ще раз.' },
  auth_failed:         { sk: 'Prihlásenie zlyhalo. Skúste znovu.',          en: 'Authentication failed. Please try again.', cs: 'Ověření selhalo. Zkuste to znovu.', pl: 'Uwierzytelnianie nie powiodło się. Spróbuj ponownie.', hu: 'A hitelesítés sikertelen. Próbálja újra.', uk: 'Помилка автентифікації. Спробуйте ще раз.' },
};

export default function PortalPage() {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations();
  const searchParams = useSearchParams();

  const [identity, setIdentity] = useState<PatientIdentity | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [records, setRecords]   = useState<PatientRecords | null>(null);
  const [receipts, setReceipts] = useState<PaymentReceiptRow[]>([]);
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab | null) ?? 'overview');

  // Teleconsult state
  const [tcUpcoming, setTcUpcoming] = useState<TeleconsultSession[]>([]);
  const [tcPast,     setTcPast]     = useState<TeleconsultSession[]>([]);
  const [tcSubTab,   setTcSubTab]   = useState<'upcoming' | 'past'>('upcoming');
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<Record<string, { clinicalNote?: string; followUpRecommendationSk?: string; followUpRecommendationEn?: string }>>({});

  const oidcError = searchParams.get('error');
  const oidcErrorMsg = oidcError
    ? (OIDC_ERROR_MESSAGES[oidcError]?.[locale] ?? OIDC_ERROR_MESSAGES[oidcError]?.['sk'])
    : null;

  // On mount: check session, then fetch FHIR records
  useEffect(() => {
    fetch('/api/portal/me')
      .then((r) => r.ok ? r.json() as Promise<PatientIdentity> : null)
      .then((id) => {
        setIdentity(id);
        setSessionLoading(false);
        if (id) {
          fetch('/api/portal/records')
            .then((r) => r.ok ? r.json() as Promise<PatientRecords> : null)
            .then((rec) => { if (rec) setRecords(rec); })
            .catch(() => {});
          fetch('/api/portal/receipts')
            .then((r) => r.ok ? r.json() as Promise<PaymentReceiptRow[]> : null)
            .then((rows) => { if (rows) setReceipts(rows); })
            .catch(() => {});
          fetch('/api/telehealth/sessions?status=scheduled,waiting,active')
            .then((r) => r.ok ? r.json() as Promise<TeleconsultSession[]> : null)
            .then((rows) => { if (rows) setTcUpcoming(rows); })
            .catch(() => {});
          fetch('/api/telehealth/sessions?status=ended,no_show')
            .then((r) => r.ok ? r.json() as Promise<TeleconsultSession[]> : null)
            .then((rows) => { if (rows) setTcPast(rows); })
            .catch(() => {});
        }
      })
      .catch(() => setSessionLoading(false));
  }, []);

  if (sessionLoading) {
    return (
      <SiteLayout activePath={`/${locale}/portal`}>
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }} role="status" aria-live="polite">
          <span style={{ color: 'var(--ink-2)' }}>
            {locale === 'sk' ? 'Načítavam…' : 'Loading…'}
          </span>
        </div>
      </SiteLayout>
    );
  }

  if (!identity) {
    return (
      <SiteLayout activePath={`/${locale}/portal`}>
        <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div className="card" style={{ overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ background: 'var(--blue-900)', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.6rem', color: '#d6e2f0' }}>
                <Lock size={28} aria-hidden="true" />
                <h1 style={{ color: '#fff', margin: 0, fontFamily: 'Newsreader, serif', fontSize: '1.4rem' }}>{t('portal.title')}</h1>
                <p style={{ margin: 0, fontSize: '.85rem', opacity: .6 }}>Nemocnica Snina</p>
              </div>
              <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {oidcErrorMsg && (
                  <p role="alert" style={{ background: 'var(--red-50)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', padding: '.6rem .8rem', color: 'var(--red)', fontSize: '.88rem', margin: 0 }}>
                    {oidcErrorMsg}
                  </p>
                )}
                <a
                  href={`/${locale}/portal/login`}
                  className="btn btn-primary btn-block btn-lg"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}
                >
                  <ShieldCheck size={18} aria-hidden="true" />
                  {locale === 'sk' ? 'Prihlásiť sa cez eID (Slovensko.sk)' : t('login')}
                </a>
                <p style={{ fontSize: '.78rem', color: 'var(--ink-3)', textAlign: 'center', margin: 0 }}>
                  {locale === 'sk'
                    ? 'Prihlasovanie prebieha cez národnú identitu (eID). Vaše údaje nie sú uložené na tomto serveri.'
                    : 'Login is handled by the national identity provider (eID). Your credentials are never stored on this server.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const tabConfig: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: 'overview',      label: t('portal.overview'),           icon: <User         size={16} /> },
    { key: 'teleconsult',   label: t('portal.teleconsultTitle'),   icon: <Video        size={16} /> },
    { key: 'records',       label: t('portal.records'),            icon: <Activity     size={16} /> },
    { key: 'prescriptions', label: t('portal.prescriptions'),      icon: <Pill         size={16} /> },
    { key: 'labs',          label: t('portal.labs'),               icon: <FlaskConical size={16} /> },
    { key: 'payments',      label: locale === 'sk' ? 'Platby' : 'Payments', icon: <CreditCard size={16} /> },
    { key: 'wearables',     label: locale === 'sk' ? 'Zariadenia' : 'Wearables', icon: <Watch size={16} /> },
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
              <div className="avatar avatar-lg">
                {identity.name ? identity.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
              </div>
              <div>
                <h2 style={{ margin: 0 }}>{identity.name || (locale === 'sk' ? 'Pacient' : 'Patient')}</h2>
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.3rem' }}>
                  <span className="chip" style={{ fontSize: '.78rem', color: 'var(--green)' }}>
                    {locale === 'sk' ? 'Overený cez eID' : 'Verified via eID'}
                  </span>
                </div>
              </div>
            </div>
            <a
              href={`/${locale}/portal/logout`}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}
            >
              <LogOut size={14} />
              {t('portal.logout')}
            </a>
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
                  {(records?.appointments ?? []).length > 0 && (
                    <div className="card card-pad" style={{ marginBottom: '1rem' }}>
                      <p className="eyebrow" style={{ marginBottom: '.5rem' }}>
                        {locale === 'sk' ? 'Najbližší termín' : 'Upcoming appointment'}
                      </p>
                      {(records?.appointments ?? []).map((a) => (
                        <div key={a.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'var(--blue-50)', color: 'var(--blue-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Calendar size={20} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700 }}>{loc(a.clinic, locale)}</div>
                            <div style={{ fontSize: '.85rem', color: 'var(--ink-2)' }}>{a.date} {a.time} · {a.doctor}</div>
                          </div>
                          <CancelAppointmentLink bookingId={a.id} locale={locale} />
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

              {tab === 'teleconsult' && (
                <div>
                  <h3 style={{ marginBottom: '1rem' }}>{t('portal.teleconsultTitle')}</h3>

                  {/* Summary PDF note */}
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
                    {t('portal.summaryPdfNote')}
                  </div>

                  {/* Sub-tabs */}
                  <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
                    {(['upcoming', 'past'] as const).map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setTcSubTab(sub)}
                        aria-pressed={tcSubTab === sub}
                        style={{
                          padding: '.4rem .9rem', borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--line)',
                          background: tcSubTab === sub ? 'var(--blue-700)' : 'var(--surface)',
                          color: tcSubTab === sub ? '#fff' : 'var(--ink-2)',
                          fontFamily: 'Mulish, sans-serif', fontWeight: 600, fontSize: '.88rem',
                          cursor: 'pointer',
                        }}
                      >
                        {sub === 'upcoming' ? t('portal.teleconsultUpcoming') : t('portal.teleconsultPast')}
                      </button>
                    ))}
                  </div>

                  {/* Upcoming */}
                  {tcSubTab === 'upcoming' && (
                    <>
                      {tcUpcoming.length === 0 ? (
                        <div className="card card-pad" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                          <Video size={32} color="var(--ink-3)" style={{ margin: '0 auto .75rem', display: 'block' }} aria-hidden="true" />
                          <p style={{ color: 'var(--ink-2)', marginBottom: '1rem' }}>{t('portal.teleconsultEmptyUpcoming')}</p>
                          <a href={`/${locale}/objednanie?mode=telehealth`} className="btn btn-primary btn-sm">
                            {t('portal.teleconsultEmptyCta')}
                          </a>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                          {tcUpcoming.map((s) => {
                            const mins = minutesUntil(s.scheduledAt);
                            const joinActive = mins <= 10;
                            const dateLabel = new Date(s.scheduledAt).toLocaleString(locale === 'sk' ? 'sk-SK' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
                            return (
                              <div key={s.id} className="card card-pad" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'var(--blue-50)', color: 'var(--blue-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Video size={20} aria-hidden="true" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700 }}>{s.physicianName ?? '—'}</div>
                                  <div style={{ fontSize: '.85rem', color: 'var(--ink-2)' }}>
                                    {s.physicianSpecialty && <span style={{ marginRight: '.5rem' }}>{s.physicianSpecialty}</span>}
                                    <span className="chip" style={{ fontSize: '.78rem' }}>{dateLabel}</span>
                                  </div>
                                </div>
                                <span className={`badge ${statusBadgeClass(s.status)}`} style={{ flexShrink: 0 }}>
                                  {s.status}
                                </span>
                                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexShrink: 0 }}>
                                  {joinActive ? (
                                    <a
                                      href={`/${locale}/telehealth/konzultacia/${s.id}`}
                                      className="btn btn-primary btn-sm"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}
                                    >
                                      <Video size={13} aria-hidden="true" />
                                      {t('portal.joinBtn')}
                                    </a>
                                  ) : (
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      disabled
                                      aria-label={t('portal.joinCountdown').replace('{mins}', String(Math.max(0, mins)))}
                                      title={t('portal.joinCountdown').replace('{mins}', String(Math.max(0, mins)))}
                                    >
                                      <Video size={13} aria-hidden="true" />
                                      {mins > 0
                                        ? t('portal.joinCountdown').replace('{mins}', String(mins))
                                        : t('portal.joinBtn')}
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--red)', fontSize: '.82rem' }}
                                    onClick={() => {
                                      if (confirm(locale === 'sk' ? 'Zrušiť konzultáciu?' : 'Cancel this consultation?')) {
                                        fetch(`/api/telehealth/sessions/${s.id}/cancel`, { method: 'POST' }).catch(() => {});
                                      }
                                    }}
                                  >
                                    <X size={13} aria-hidden="true" />
                                    {t('portal.cancelLink')}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {/* Past */}
                  {tcSubTab === 'past' && (
                    <>
                      {tcPast.length === 0 ? (
                        <div className="card card-pad" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                          <p style={{ color: 'var(--ink-2)', marginBottom: '1rem' }}>
                            {locale === 'sk' ? 'Žiadne minulé videokonzultácie.' : 'No past video consultations.'}
                          </p>
                          <a href={`/${locale}/objednanie?mode=telehealth`} className="btn btn-primary btn-sm">
                            {t('portal.teleconsultEmptyCta')}
                          </a>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                          {tcPast.map((s) => {
                            const dateLabel = new Date(s.scheduledAt).toLocaleString(locale === 'sk' ? 'sk-SK' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
                            const expanded = expandedSummary === s.id;
                            const sumData  = summaryData[s.id];
                            return (
                              <div key={s.id} className="card" style={{ overflow: 'visible' }}>
                                <div className="card-pad" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'var(--warm-100)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Video size={20} aria-hidden="true" />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700 }}>{s.physicianName ?? '—'}</div>
                                    <div style={{ fontSize: '.85rem', color: 'var(--ink-2)', display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.2rem' }}>
                                      <span className="chip" style={{ fontSize: '.78rem' }}>{dateLabel}</span>
                                      {s.durationSeconds != null && (
                                        <span className="chip" style={{ fontSize: '.78rem' }}>
                                          {t('portal.teleconsultDuration')}: {fmtDuration(s.durationSeconds)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`badge ${statusBadgeClass(s.status)}`} style={{ flexShrink: 0 }}>
                                    {s.status === 'no_show' ? t('portal.teleconsultNoShow') : s.status}
                                  </span>
                                  <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexShrink: 0 }}>
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      aria-expanded={expanded}
                                      onClick={async () => {
                                        if (expanded) { setExpandedSummary(null); return; }
                                        setExpandedSummary(s.id);
                                        if (!summaryData[s.id]) {
                                          try {
                                            const r = await fetch(`/api/telehealth/sessions/${s.id}/summary`);
                                            if (r.ok) {
                                              const d = await r.json() as { clinicalNote?: string; followUpRecommendationSk?: string; followUpRecommendationEn?: string };
                                              setSummaryData((prev) => ({ ...prev, [s.id]: d }));
                                            }
                                          } catch { /* non-blocking */ }
                                        }
                                      }}
                                    >
                                      {expanded
                                        ? (locale === 'sk' ? 'Skryť' : 'Hide')
                                        : t('portal.viewSummary')}
                                    </button>
                                    <SummaryPdfButton sessionId={s.id} locale={locale} />
                                  </div>
                                </div>
                                {expanded && (
                                  <div
                                    style={{
                                      borderTop: '1px solid var(--line)',
                                      padding: '1rem 1.25rem',
                                      background: 'var(--bg-2)',
                                    }}
                                    aria-live="polite"
                                  >
                                    {!sumData ? (
                                      <p style={{ color: 'var(--ink-3)', fontSize: '.88rem', margin: 0 }}>
                                        {locale === 'sk' ? 'Načítavam zhrnutie…' : 'Loading summary…'}
                                      </p>
                                    ) : (
                                      <>
                                        {sumData.clinicalNote && (
                                          <div style={{ marginBottom: '.75rem' }}>
                                            <p className="eyebrow" style={{ marginBottom: '.3rem', color: 'var(--ink-3)' }}>
                                              {locale === 'sk' ? 'Klinická poznámka' : 'Clinical note'}
                                            </p>
                                            <p style={{ margin: 0, fontSize: '.9rem' }}>{sumData.clinicalNote}</p>
                                          </div>
                                        )}
                                        {(sumData.followUpRecommendationSk ?? sumData.followUpRecommendationEn) && (
                                          <div>
                                            <p className="eyebrow" style={{ marginBottom: '.3rem', color: 'var(--ink-3)' }}>
                                              {locale === 'sk' ? 'Odporúčanie' : 'Follow-up'}
                                            </p>
                                            <p style={{ margin: 0, fontSize: '.9rem' }}>
                                              {locale === 'sk' ? sumData.followUpRecommendationSk : sumData.followUpRecommendationEn}
                                            </p>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
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
                        {(records?.conditions ?? []).map((c) => (
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
                    {(records?.medications ?? []).map((m) => (
                      <div key={m.id} className="card card-pad" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <Pill size={20} color="var(--blue-600)" />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{m.name}</div>
                          <div style={{ fontSize: '.85rem', color: 'var(--ink-2)' }}>{loc(m.dose, locale)} · {locale === 'sk' ? `${m.refills} obnov.` : `${m.refills} refills`}</div>
                        </div>
                        {m.refills > 0 && <RefillButton medicationId={m.id} locale={locale} />}
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
                      ? 'Stiahnutie PDF výsledkov vyžaduje overenie kódom z SMS.'
                      : 'PDF download requires SMS verification code.'}
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
                        {(records?.observations ?? []).map((l) => (
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
                              <LabPdfButton observationId={l.id} locale={locale} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'payments' && (
                <div>
                  <h3 style={{ marginBottom: '1rem' }}>{locale === 'sk' ? 'Platby a pokladničné doklady' : 'Payments & receipts'}</h3>
                  {receipts.length === 0 ? (
                    <div className="card card-pad" style={{ color: 'var(--ink-2)', fontSize: '.9rem' }}>
                      {locale === 'sk' ? 'Žiadne platby.' : 'No payments found.'}
                    </div>
                  ) : (
                    <div className="card" style={{ overflowX: 'auto' }}>
                      <table className="data">
                        <thead>
                          <tr>
                            <th>{locale === 'sk' ? 'Dátum' : 'Date'}</th>
                            <th>{locale === 'sk' ? 'Transakcia' : 'Transaction'}</th>
                            <th>{locale === 'sk' ? 'Rezervácia' : 'Booking'}</th>
                            <th>{locale === 'sk' ? 'Doklad' : 'Receipt'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receipts.map((r) => (
                            <tr key={r.id}>
                              <td>{new Date(r.createdAt).toLocaleDateString(locale === 'sk' ? 'sk-SK' : 'en-GB')}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>{r.transactionRef.slice(0, 16)}…</td>
                              <td style={{ fontSize: '.82rem' }}>{r.bookingId ?? '—'}</td>
                              <td>
                                <a
                                  href={`/api/payments/receipt/${r.transactionRef}`}
                                  download={`receipt-${r.transactionRef}.pdf`}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem', fontSize: '.82rem', color: 'var(--blue-700)', textDecoration: 'none' }}
                                >
                                  <Download size={13} />
                                  PDF
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {tab === 'wearables' && <WearablesTab locale={locale} />}
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
