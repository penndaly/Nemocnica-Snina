'use client';

import { useState, useEffect, useCallback } from 'react';
import { Video, Clock, Calendar, X, ChevronRight, AlertCircle } from 'lucide-react';
import { AdminAuthProvider } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthContext';

interface TelehealthSession {
  id: string;
  scheduledAt: string;
  status: 'scheduled' | 'waiting' | 'active' | 'ended' | 'no_show' | 'cancelled';
  patientToken: string;
  physicianId?: string;
  clinicId?: string;
  clinicName?: string;
  durationSeconds?: number;
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  scheduled: { label: 'Naplánovaná',  bg: 'rgba(30,82,144,.2)',  color: '#6ab0f5' },
  waiting:   { label: 'Čaká',         bg: 'rgba(192,138,46,.2)', color: '#f5c842' },
  active:    { label: 'Prebieha',     bg: 'rgba(47,138,100,.2)', color: '#4ade80' },
  ended:     { label: 'Ukončená',     bg: 'rgba(47,138,100,.1)', color: '#6ee7b7' },
  no_show:   { label: 'Neprišiel/a', bg: 'rgba(100,100,100,.2)', color: '#aaa' },
  cancelled: { label: 'Zrušená',      bg: 'rgba(200,50,50,.15)', color: '#f87171' },
};

function StatusBadge({ status }: { status: TelehealthSession['status'] }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE['scheduled']!;
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '.2em .7em', fontSize: '.74rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function fmtTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'short' });
}
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Cancel modal ─────────────────────────────────────────────────────────────

function CancelModal({ sessionId, onClose, onDone, token }: { sessionId: string; onClose: () => void; onDone: () => void; token: string }) {
  const [reason, setReason] = useState('');
  const [state,  setState]  = useState<'idle' | 'busy' | 'error'>('idle');
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

  async function submit() {
    if (!reason.trim()) return;
    setState('busy');
    try {
      const res = await fetch(`${apiUrl}/api/telehealth/sessions/${sessionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) { onDone(); }
      else { setState('error'); }
    } catch { setState('error'); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
      <div style={{ background: '#1a2533', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', padding: '1.5rem', maxWidth: 440, width: '100%' }}>
        <h3 id="cancel-modal-title" style={{ color: '#fff', margin: '0 0 .75rem' }}>Zrušiť konzultáciu</h3>
        <p style={{ color: 'rgba(255,255,255,.5)', marginBottom: '1rem', fontSize: '.88rem' }}>Zadajte dôvod zrušenia. Táto akcia je nezvratná.</p>
        {state === 'error' && (
          <p role="alert" style={{ color: 'var(--red)', fontSize: '.85rem', marginBottom: '.75rem' }}>Chyba pri zrušení. Skúste znovu.</p>
        )}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Napr. Lekár nie je k dispozícii"
          rows={3}
          aria-label="Dôvod zrušenia"
          style={{ width: '100%', padding: '.6rem .75rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, color: '#e8ecf1', fontSize: '.9rem', fontFamily: 'Mulish, sans-serif', resize: 'vertical', boxSizing: 'border-box', marginBottom: '1rem' }}
        />
        <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '.45rem 1rem', background: 'none', border: '1px solid rgba(255,255,255,.2)', borderRadius: 7, color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontFamily: 'Mulish, sans-serif', fontWeight: 600 }}
          >
            Zavrieť
          </button>
          <button
            onClick={() => void submit()}
            disabled={!reason.trim() || state === 'busy'}
            style={{ padding: '.45rem 1rem', background: 'rgba(200,50,50,.7)', border: 'none', borderRadius: 7, color: '#fff', cursor: 'pointer', fontFamily: 'Mulish, sans-serif', fontWeight: 700 }}
          >
            {state === 'busy' ? 'Zrušujem…' : 'Zrušiť konzultáciu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main schedule component ───────────────────────────────────────────────────

function TelehealthSchedule() {
  const { token, role } = useAdminAuth();
  const [sessions, setSessions] = useState<TelehealthSession[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<'today' | 'week'>('today');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/telehealth/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) setSessions(await res.json() as TelehealthSession[]);
    } catch { /* non-blocking */ }
    setLoading(false);
  }, [token, apiUrl]);

  useEffect(() => { void fetchSessions(); }, [fetchSessions]);

  // Role guard — clinician and admin only
  if (role && !['CLINICIAN', 'ADMIN'].includes(role)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--red)', padding: '2rem' }}>
        <AlertCircle size={20} />
        <span>Prístup zamietnutý. Táto sekcia je dostupná len pre lekárov a adminov.</span>
      </div>
    );
  }

  const today = isoDay(new Date());
  const todaySessions = sessions.filter((s) => isoDay(new Date(s.scheduledAt)) === today);

  // 7-day window
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div>
      {cancelId && (
        <CancelModal
          sessionId={cancelId}
          token={token ?? ''}
          onClose={() => setCancelId(null)}
          onDone={() => { setCancelId(null); void fetchSessions(); }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Newsreader, serif', color: '#fff', margin: 0, fontSize: '1.7rem' }}>
            Telehealth — plán konzultácií
          </h1>
          <p style={{ color: 'rgba(255,255,255,.4)', margin: '.25rem 0 0', fontSize: '.88rem' }}>
            {loading ? 'Načítavam…' : `${sessions.length} konzultácií · aktualizované práve teraz`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          {(['today', 'week'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              style={{
                display: 'flex', alignItems: 'center', gap: '.4rem',
                padding: '.45rem .9rem', borderRadius: 8,
                background: view === v ? 'var(--blue-700)' : 'rgba(255,255,255,.07)',
                color: view === v ? '#fff' : 'rgba(255,255,255,.65)',
                border: 'none', cursor: 'pointer',
                fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '.85rem',
              }}
            >
              {v === 'today' ? <Clock size={14} /> : <Calendar size={14} />}
              {v === 'today' ? 'Dnes' : '7 dní'}
            </button>
          ))}
        </div>
      </div>

      {/* Today's schedule */}
      {view === 'today' && (
        <div style={{ background: '#1a2533', borderRadius: 12, border: '1px solid rgba(255,255,255,.07)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'rgba(255,255,255,.35)' }}>Načítavam…</div>
          ) : todaySessions.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>
              <Video size={32} style={{ margin: '0 auto .75rem', display: 'block', opacity: .4 }} aria-hidden="true" />
              <p style={{ margin: 0 }}>Na dnes nie sú naplánované žiadne videokonzultácie.</p>
            </div>
          ) : (
            todaySessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onCancel={() => setCancelId(s.id)}
              />
            ))
          )}
        </div>
      )}

      {/* 7-day calendar */}
      {view === 'week' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {weekDays.map((day) => {
            const dayKey = isoDay(day);
            const daySessions = sessions.filter((s) => isoDay(new Date(s.scheduledAt)) === dayKey);
            const isToday = dayKey === today;
            return (
              <div key={dayKey} style={{ background: '#1a2533', borderRadius: 12, border: `1px solid ${isToday ? 'rgba(30,82,144,.6)' : 'rgba(255,255,255,.07)'}`, overflow: 'hidden' }}>
                <div style={{ padding: '.75rem 1.2rem', background: isToday ? 'rgba(30,82,144,.15)' : 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                  <span style={{ fontFamily: 'Mulish, sans-serif', fontWeight: 800, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.1em', color: isToday ? '#6ab0f5' : 'rgba(255,255,255,.45)' }}>
                    {fmtDate(day.toISOString())}
                  </span>
                  {isToday && (
                    <span style={{ background: 'var(--blue-700)', color: '#fff', borderRadius: 999, padding: '.15em .6em', fontSize: '.7rem', fontWeight: 700 }}>DNES</span>
                  )}
                  <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.3)', fontSize: '.82rem' }}>
                    {daySessions.length} {daySessions.length === 1 ? 'konzultácia' : 'konzultácií'}
                  </span>
                </div>
                {daySessions.length === 0 ? (
                  <div style={{ padding: '1rem 1.2rem', color: 'rgba(255,255,255,.25)', fontSize: '.85rem' }}>Žiadne konzultácie</div>
                ) : (
                  daySessions.map((s) => (
                    <SessionRow key={s.id} session={s} onCancel={() => setCancelId(s.id)} />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Session row ───────────────────────────────────────────────────────────────

function SessionRow({ session: s, onCancel }: { session: TelehealthSession; onCancel: () => void }) {
  const canJoin = ['scheduled', 'waiting', 'active'].includes(s.status);
  const canCancel = ['scheduled', 'waiting'].includes(s.status);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.9rem 1.2rem', borderBottom: '1px solid rgba(255,255,255,.04)', flexWrap: 'wrap' }}>
      {/* Time */}
      <div style={{ minWidth: 52, textAlign: 'center' }}>
        <div style={{ fontWeight: 800, color: '#e8f0fb', fontSize: '1.1rem', fontFamily: 'Mulish, sans-serif', lineHeight: 1 }}>{fmtTime(s.scheduledAt)}</div>
      </div>

      {/* Patient token (anonymised) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: '#c8d5e8', fontSize: '.9rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {`…${s.patientToken.slice(-8)}`}
        </div>
        {s.clinicName && (
          <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.35)', marginTop: '.15rem' }}>{s.clinicName}</div>
        )}
      </div>

      {/* Status */}
      <StatusBadge status={s.status} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0 }}>
        {canJoin && (
          <a
            href={`/sk/telehealth/konzultacia/${s.id}?role=physician`}
            title="Pripojiť sa"
            aria-label={`Pripojiť sa ku konzultácii ${s.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: '.35rem', padding: '.4rem .8rem', borderRadius: 7, background: 'var(--blue-700)', color: '#fff', textDecoration: 'none', fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '.82rem', whiteSpace: 'nowrap' }}
          >
            <Video size={13} aria-hidden="true" />
            Vstúpiť
          </a>
        )}
        {canCancel && (
          <button
            onClick={onCancel}
            title="Zrušiť"
            aria-label={`Zrušiť konzultáciu ${s.id}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 7, background: 'rgba(192,57,43,.15)', color: 'rgba(255,140,130,.8)', border: 'none', cursor: 'pointer' }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
        {!canJoin && !canCancel && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '.35rem', padding: '.4rem .8rem', borderRadius: 7, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.3)', fontFamily: 'Mulish, sans-serif', fontSize: '.82rem' }}>
            <ChevronRight size={13} aria-hidden="true" />
            Zobraz.
          </span>
        )}
      </div>
    </div>
  );
}

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function AdminTelehealthPage() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <TelehealthSchedule />
      </AdminShell>
    </AdminAuthProvider>
  );
}
