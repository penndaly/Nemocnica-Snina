'use client';

import { useState, useEffect } from 'react';
import { Check, X, User, RefreshCw } from 'lucide-react';
import { AdminAuthProvider } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthContext';
import { showToast } from '@/components/admin/AdminToast';

interface Application {
  id: string;
  physicianId: string;
  patientName: string;
  insurerCode: string;
  phone: string;
  email?: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';
  reviewNote?: string;
  createdAt: string;
}

const INSURER_NAMES: Record<string, string> = {
  '25': 'VšZP',
  '27': 'Dôvera',
  '24': 'Union',
};

const STATUS_CFG = {
  SUBMITTED:     { label: 'Odoslaná',         bg: 'rgba(37,99,168,.15)',  color: '#93c5fd' },
  UNDER_REVIEW:  { label: 'V spracovaní',     bg: 'rgba(192,138,46,.15)', color: '#fcd34d' },
  ACCEPTED:      { label: 'Prijatá',           bg: 'rgba(47,138,100,.15)', color: '#6ee7b7' },
  REJECTED:      { label: 'Zamietnutá',        bg: 'rgba(192,57,43,.15)', color: '#fca5a5' },
};

// Demo data — real queue reads from API
const DEMO_APPLICATIONS: Application[] = [
  { id: 'APP-1A2B3C', physicianId: 'borscova', patientName: 'Jana Nováková', insurerCode: '25', phone: '+421 904 123 456', status: 'SUBMITTED', createdAt: '2024-11-01T10:30:00Z' },
  { id: 'APP-4D5E6F', physicianId: 'pavlovcin', patientName: 'Peter Sloboda', insurerCode: '27', phone: '+421 912 987 654', status: 'UNDER_REVIEW', createdAt: '2024-10-30T08:15:00Z' },
  { id: 'APP-7G8H9I', physicianId: 'nebesnik', patientName: 'Marta Kováčová', insurerCode: '24', phone: '+421 918 555 111', status: 'ACCEPTED', createdAt: '2024-10-28T14:45:00Z' },
];

function ReviewModal({
  app,
  onClose,
  onReview,
}: {
  app: Application;
  onClose: () => void;
  onReview: (id: string, decision: 'accept' | 'reject', note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handle(decision: 'accept' | 'reject') {
    setSaving(true);
    await onReview(app.id, decision, note);
    setSaving(false);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-dialog-title"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#1a2533', borderRadius: 14, border: '1px solid rgba(255,255,255,.1)', width: '100%', maxWidth: 480, padding: '1.75rem' }}>
        <h2 id="review-dialog-title" style={{ color: '#fff', fontFamily: 'Newsreader, serif', margin: '0 0 1.25rem', fontSize: '1.3rem' }}>
          Posúdiť žiadosť
        </h2>
        <dl style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', fontSize: '.9rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'ID', val: app.id },
            { label: 'Pacient', val: app.patientName },
            { label: 'Lekár', val: app.physicianId },
            { label: 'Poisťovňa', val: INSURER_NAMES[app.insurerCode] ?? app.insurerCode },
            { label: 'Tel.', val: app.phone },
          ].map(({ label, val }) => (
            <div key={label} style={{ display: 'flex', gap: '1rem' }}>
              <dt style={{ color: 'rgba(255,255,255,.4)', width: 80, flexShrink: 0 }}>{label}</dt>
              <dd style={{ margin: 0, color: '#e8f0fb' }}>{val}</dd>
            </div>
          ))}
        </dl>
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', color: 'rgba(255,255,255,.45)', fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.4rem' }}>
            Poznámka (nepovinné)
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: '1.5px solid rgba(255,255,255,.12)', borderRadius: 9, padding: '.6em .85em', color: '#e8f0fb', fontFamily: 'Mulish, sans-serif', fontSize: '.95rem', resize: 'vertical' }}
            placeholder="Dôvod prijatia / zamietnutia…"
          />
        </div>
        <div style={{ display: 'flex', gap: '.75rem' }}>
          <button
            onClick={() => handle('accept')}
            disabled={saving}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem', background: 'rgba(47,138,100,.2)', color: '#6ee7b7', border: '1px solid rgba(47,138,100,.5)', borderRadius: 9, padding: '.7em', fontFamily: 'Mulish, sans-serif', fontWeight: 700, cursor: 'pointer' }}
          >
            <Check size={16} /> Prijať
          </button>
          <button
            onClick={() => handle('reject')}
            disabled={saving}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem', background: 'rgba(192,57,43,.2)', color: '#fca5a5', border: '1px solid rgba(192,57,43,.5)', borderRadius: 9, padding: '.7em', fontFamily: 'Mulish, sans-serif', fontWeight: 700, cursor: 'pointer' }}
          >
            <X size={16} /> Zamietnuť
          </button>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, padding: '.7em 1.1em', fontFamily: 'Mulish, sans-serif', fontWeight: 700, cursor: 'pointer' }}
          >
            Zrušiť
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingQueue() {
  const { token } = useAdminAuth();
  const [apps, setApps] = useState<Application[]>(DEMO_APPLICATIONS);
  const [filter, setFilter] = useState<'ALL' | Application['status']>('ALL');
  const [reviewing, setReviewing] = useState<Application | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchQueue() {
    setLoading(true);
    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/onboarding`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (res.ok) setApps(await res.json() as Application[]);
    } catch { /* use demo data */ }
    finally { setLoading(false); }
  }

  useEffect(() => { void fetchQueue(); }, []);

  async function handleReview(id: string, decision: 'accept' | 'reject', note: string) {
    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
      await fetch(`${apiUrl}/api/onboarding/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ decision, note }),
      });
    } catch { /* dev: update local state */ }
    setApps(prev => prev.map(a =>
      a.id === id
        ? { ...a, status: decision === 'accept' ? 'ACCEPTED' : 'REJECTED', reviewNote: note }
        : a
    ));
    showToast(decision === 'accept' ? 'Žiadosť prijatá.' : 'Žiadosť zamietnutá.');
  }

  const filtered = filter === 'ALL' ? apps : apps.filter(a => a.status === filter);

  const FILTERS: Array<{ key: 'ALL' | Application['status']; label: string }> = [
    { key: 'ALL',          label: `Všetky (${apps.length})` },
    { key: 'SUBMITTED',    label: `Nové (${apps.filter(a => a.status === 'SUBMITTED').length})` },
    { key: 'UNDER_REVIEW', label: `V spracovaní (${apps.filter(a => a.status === 'UNDER_REVIEW').length})` },
    { key: 'ACCEPTED',     label: `Prijaté` },
    { key: 'REJECTED',     label: `Zamietnuté` },
  ];

  return (
    <>
      {reviewing && (
        <ReviewModal
          app={reviewing}
          onClose={() => setReviewing(null)}
          onReview={handleReview}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Newsreader, serif', color: '#fff', margin: 0, fontSize: '1.7rem' }}>
            eDohody — Žiadosti o registráciu
          </h1>
          <p style={{ color: 'rgba(255,255,255,.4)', margin: '.25rem 0 0', fontSize: '.88rem' }}>
            Nové žiadosti o kapičáciu od pacientov
          </p>
        </div>
        <button
          onClick={() => void fetchQueue()}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '.5rem', background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, padding: '.55em 1.1em', fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '.88rem', cursor: 'pointer' }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
          Obnoviť
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              background: filter === key ? 'var(--blue-700,#1e5290)' : 'rgba(255,255,255,.07)',
              color: filter === key ? '#fff' : 'rgba(255,255,255,.6)',
              border: 'none', borderRadius: 8, padding: '.4em .9em',
              fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '.82rem', cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#1a2533', borderRadius: 12, border: '1px solid rgba(255,255,255,.07)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>
            Žiadne žiadosti.
          </div>
        ) : filtered.map((app) => {
          const sc = STATUS_CFG[app.status];
          const canReview = app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW';
          return (
            <div
              key={app.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '.9rem 1.2rem',
                borderBottom: '1px solid rgba(255,255,255,.05)',
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#e8f0fb', fontSize: '.95rem' }}>{app.patientName}</div>
                <div style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.4)', marginTop: '.15rem' }}>
                  {app.id} · {INSURER_NAMES[app.insurerCode] ?? app.insurerCode} · {app.phone}
                  {' · '}{new Date(app.createdAt).toLocaleDateString('sk-SK')}
                </div>
              </div>
              <span style={{ background: sc.bg, color: sc.color, borderRadius: 999, padding: '.25em .75em', fontSize: '.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
                {sc.label}
              </span>
              {canReview ? (
                <button
                  onClick={() => setReviewing(app)}
                  style={{ background: 'var(--blue-700,#1e5290)', color: '#fff', border: 'none', borderRadius: 8, padding: '.4em .9em', fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Posúdiť
                </button>
              ) : (
                <div style={{ width: 80, flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function OnboardingAdminPage() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <OnboardingQueue />
      </AdminShell>
    </AdminAuthProvider>
  );
}
