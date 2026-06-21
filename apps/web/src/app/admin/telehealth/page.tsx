'use client';

import { useState, useEffect, useCallback } from 'react';
import { Video, Clock, Calendar, X, ChevronRight, AlertCircle, ToggleLeft, ToggleRight, Users, Building2 } from 'lucide-react';
import { AdminAuthProvider } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface ClinicConfig {
  id: string | number;
  name: string;
  telehealth: boolean;
  telehealthWindow: string | null;
  telehealthRule: string | null;
}

interface PhysicianConfig {
  id: string | number;
  name: string;
  specialty: string;
  telehealth: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function Toggle({ enabled, onChange, loading }: { enabled: boolean; onChange: (v: boolean) => void; loading?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => !loading && onChange(!enabled)}
      style={{
        display: 'flex', alignItems: 'center', background: 'none', border: 'none',
        cursor: loading ? 'wait' : 'pointer', padding: 0,
        color: enabled ? '#4ade80' : 'rgba(255,255,255,.3)',
        opacity: loading ? .5 : 1, transition: 'color .15s',
      }}
    >
      {enabled
        ? <ToggleRight size={28} aria-hidden="true" />
        : <ToggleLeft size={28} aria-hidden="true" />}
    </button>
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

// ── Cancel modal ──────────────────────────────────────────────────────────────

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
          <button onClick={onClose} style={{ padding: '.45rem 1rem', background: 'none', border: '1px solid rgba(255,255,255,.2)', borderRadius: 7, color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontFamily: 'Mulish, sans-serif', fontWeight: 600 }}>
            Zavrieť
          </button>
          <button onClick={() => void submit()} disabled={!reason.trim() || state === 'busy'}
            style={{ padding: '.45rem 1rem', background: 'rgba(200,50,50,.7)', border: 'none', borderRadius: 7, color: '#fff', cursor: 'pointer', fontFamily: 'Mulish, sans-serif', fontWeight: 700 }}>
            {state === 'busy' ? 'Zrušujem…' : 'Zrušiť konzultáciu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Clinics subview ───────────────────────────────────────────────────────────

function ClinicsView({ token }: { token: string }) {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
  const [clinics,  setClinics]  = useState<ClinicConfig[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<Record<string, boolean>>({});
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/telehealth/clinics`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) setClinics(await res.json() as ClinicConfig[]);
      else setError('Načítanie ambulancií zlyhalo.');
    } catch { setError('Chyba siete.'); }
    setLoading(false);
  }, [token, apiUrl]);

  useEffect(() => { void load(); }, [load]);

  async function save(id: string | number, updates: Partial<ClinicConfig>) {
    setSaving((p) => ({ ...p, [String(id)]: true }));
    try {
      const res = await fetch(`${apiUrl}/api/admin/telehealth/clinics/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setClinics((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c));
      } else {
        setError('Uloženie zlyhalo.');
      }
    } catch { setError('Chyba siete.'); }
    setSaving((p) => ({ ...p, [String(id)]: false }));
  }

  if (loading) return <div style={{ padding: '2.5rem', color: 'rgba(255,255,255,.35)', textAlign: 'center' }}>Načítavam ambulancie…</div>;

  return (
    <div>
      {error && <p role="alert" style={{ color: 'var(--red)', marginBottom: '1rem', fontSize: '.88rem' }}>{error}</p>}
      <p style={{ color: 'rgba(255,255,255,.4)', fontSize: '.85rem', marginBottom: '1rem' }}>
        Zmeny sa prejavia na verejnej stránke Telehealth do {process.env['NEXT_PUBLIC_CONTENT_REVALIDATE_SECONDS'] ?? '60'} sekúnd.
        Každá zmena je zaznamenaná v audit logu.
      </p>
      <div style={{ background: '#1a2533', borderRadius: 12, border: '1px solid rgba(255,255,255,.07)', overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 150px 180px', gap: '1rem', padding: '.6rem 1.2rem', borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)' }}>
          {['Ambulancia', 'Telehealth', 'Video okno', 'Pravidlo (SK)'].map((h) => (
            <span key={h} style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }}>{h}</span>
          ))}
        </div>
        {clinics.map((c) => (
          <div key={String(c.id)} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 150px 180px', gap: '1rem', alignItems: 'center', padding: '.75rem 1.2rem', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
            <span style={{ color: '#c8d5e8', fontWeight: 600, fontSize: '.9rem' }}>{c.name as string}</span>
            <Toggle
              enabled={c.telehealth}
              loading={saving[String(c.id)]}
              onChange={(v) => void save(c.id, { telehealth: v })}
            />
            <input
              type="text"
              defaultValue={c.telehealthWindow ?? ''}
              placeholder="napr. 08:00–12:00"
              aria-label={`Video okno pre ${String(c.name)}`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (c.telehealthWindow ?? '')) void save(c.id, { telehealthWindow: v || null });
              }}
              style={{ padding: '.35rem .6rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, color: '#e8ecf1', fontSize: '.85rem', fontFamily: 'Mulish, sans-serif', width: '100%', boxSizing: 'border-box' }}
            />
            <input
              type="text"
              defaultValue={c.telehealthRule ?? ''}
              placeholder="Pravidlo pre pacientov"
              aria-label={`Pravidlo rezervácie pre ${String(c.name)}`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (c.telehealthRule ?? '')) void save(c.id, { telehealthRule: v || null });
              }}
              style={{ padding: '.35rem .6rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, color: '#e8ecf1', fontSize: '.85rem', fontFamily: 'Mulish, sans-serif', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        ))}
        {clinics.length === 0 && (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Žiadne ambulancie nenájdené.</div>
        )}
      </div>
    </div>
  );
}

// ── Physicians subview ────────────────────────────────────────────────────────

function PhysiciansView({ token }: { token: string }) {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
  const [physicians, setPhysicians] = useState<PhysicianConfig[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState<Record<string, boolean>>({});
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/telehealth/physicians`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) setPhysicians(await res.json() as PhysicianConfig[]);
      else setError('Načítanie lekárov zlyhalo.');
    } catch { setError('Chyba siete.'); }
    setLoading(false);
  }, [token, apiUrl]);

  useEffect(() => { void load(); }, [load]);

  async function toggle(id: string | number, value: boolean) {
    setSaving((p) => ({ ...p, [String(id)]: true }));
    try {
      const res = await fetch(`${apiUrl}/api/admin/telehealth/physicians/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ telehealth: value }),
      });
      if (res.ok) {
        setPhysicians((prev) => prev.map((p) => p.id === id ? { ...p, telehealth: value } : p));
      } else {
        setError('Uloženie zlyhalo.');
      }
    } catch { setError('Chyba siete.'); }
    setSaving((p) => ({ ...p, [String(id)]: false }));
  }

  if (loading) return <div style={{ padding: '2.5rem', color: 'rgba(255,255,255,.35)', textAlign: 'center' }}>Načítavam lekárov…</div>;

  return (
    <div>
      {error && <p role="alert" style={{ color: 'var(--red)', marginBottom: '1rem', fontSize: '.88rem' }}>{error}</p>}
      <div style={{ background: '#1a2533', borderRadius: 12, border: '1px solid rgba(255,255,255,.07)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: '1rem', padding: '.6rem 1.2rem', borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)' }}>
          {['Lekár', 'Špeciálnosť', 'Telehealth'].map((h) => (
            <span key={h} style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }}>{h}</span>
          ))}
        </div>
        {physicians.map((p) => (
          <div key={String(p.id)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: '1rem', alignItems: 'center', padding: '.75rem 1.2rem', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
            <span style={{ color: '#c8d5e8', fontWeight: 600, fontSize: '.9rem' }}>{p.name as string}</span>
            <span style={{ color: 'rgba(255,255,255,.45)', fontSize: '.85rem' }}>{p.specialty as string}</span>
            <Toggle
              enabled={p.telehealth}
              loading={saving[String(p.id)]}
              onChange={(v) => void toggle(p.id, v)}
            />
          </div>
        ))}
        {physicians.length === 0 && (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Žiadni lekári nenájdení.</div>
        )}
      </div>
    </div>
  );
}

// ── Sessions subview ──────────────────────────────────────────────────────────

function SessionRow({ session: s, onCancel }: { session: TelehealthSession; onCancel: () => void }) {
  const canJoin   = ['scheduled', 'waiting', 'active'].includes(s.status);
  const canCancel = ['scheduled', 'waiting'].includes(s.status);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.9rem 1.2rem', borderBottom: '1px solid rgba(255,255,255,.04)', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 52, textAlign: 'center' }}>
        <div style={{ fontWeight: 800, color: '#e8f0fb', fontSize: '1.1rem', fontFamily: 'Mulish, sans-serif', lineHeight: 1 }}>{fmtTime(s.scheduledAt)}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: '#c8d5e8', fontSize: '.9rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {`…${s.patientToken.slice(-8)}`}
        </div>
        {s.clinicName && (
          <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.35)', marginTop: '.15rem' }}>{s.clinicName}</div>
        )}
      </div>
      <StatusBadge status={s.status} />
      <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0 }}>
        {canJoin && (
          <a href={`/sk/telehealth/konzultacia/${s.id}?role=physician`}
            aria-label={`Pripojiť sa ku konzultácii ${s.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: '.35rem', padding: '.4rem .8rem', borderRadius: 7, background: 'var(--blue-700)', color: '#fff', textDecoration: 'none', fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '.82rem', whiteSpace: 'nowrap' }}>
            <Video size={13} aria-hidden="true" />
            Vstúpiť
          </a>
        )}
        {canCancel && (
          <button onClick={onCancel} aria-label={`Zrušiť konzultáciu ${s.id}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 7, background: 'rgba(192,57,43,.15)', color: 'rgba(255,140,130,.8)', border: 'none', cursor: 'pointer' }}>
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

function SessionsView({ token }: { token: string }) {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
  const [sessions, setSessions] = useState<TelehealthSession[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<'today' | 'week'>('today');
  const [cancelId, setCancelId] = useState<string | null>(null);

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

  const today = isoDay(new Date());
  const todaySessions = sessions.filter((s) => isoDay(new Date(s.scheduledAt)) === today);
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
          token={token}
          onClose={() => setCancelId(null)}
          onDone={() => { setCancelId(null); void fetchSessions(); }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', justifyContent: 'space-between' }}>
        <p style={{ color: 'rgba(255,255,255,.4)', margin: 0, fontSize: '.88rem' }}>
          {loading ? 'Načítavam…' : `${sessions.length} konzultácií`}
        </p>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          {(['today', 'week'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
              style={{ display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.45rem .9rem', borderRadius: 8, background: view === v ? 'var(--blue-700)' : 'rgba(255,255,255,.07)', color: view === v ? '#fff' : 'rgba(255,255,255,.65)', border: 'none', cursor: 'pointer', fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '.85rem' }}>
              {v === 'today' ? <Clock size={14} /> : <Calendar size={14} />}
              {v === 'today' ? 'Dnes' : '7 dní'}
            </button>
          ))}
        </div>
      </div>

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
            todaySessions.map((s) => <SessionRow key={s.id} session={s} onCancel={() => setCancelId(s.id)} />)
          )}
        </div>
      )}

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
                  {isToday && <span style={{ background: 'var(--blue-700)', color: '#fff', borderRadius: 999, padding: '.15em .6em', fontSize: '.7rem', fontWeight: 700 }}>DNES</span>}
                  <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.3)', fontSize: '.82rem' }}>
                    {daySessions.length} {daySessions.length === 1 ? 'konzultácia' : 'konzultácií'}
                  </span>
                </div>
                {daySessions.length === 0 ? (
                  <div style={{ padding: '1rem 1.2rem', color: 'rgba(255,255,255,.25)', fontSize: '.85rem' }}>Žiadne konzultácie</div>
                ) : (
                  daySessions.map((s) => <SessionRow key={s.id} session={s} onCancel={() => setCancelId(s.id)} />)
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'clinics' | 'physicians' | 'sessions';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'clinics',    label: 'Ambulancie',    icon: <Building2 size={15} aria-hidden="true" /> },
  { id: 'physicians', label: 'Lekári',        icon: <Users     size={15} aria-hidden="true" /> },
  { id: 'sessions',   label: 'Konzultácie',   icon: <Video     size={15} aria-hidden="true" /> },
];

function TelehealthAdmin() {
  const { token, role } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<Tab>('clinics');

  if (role && !['CLINICIAN', 'ADMIN'].includes(role)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--red)', padding: '2rem' }}>
        <AlertCircle size={20} />
        <span>Prístup zamietnutý. Táto sekcia je dostupná len pre lekárov a adminov.</span>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontFamily: 'Newsreader, serif', color: '#fff', margin: '0 0 .35rem', fontSize: '1.7rem' }}>
          Telehealth — konfigurácia
        </h1>
        <p style={{ color: 'rgba(255,255,255,.4)', margin: 0, fontSize: '.88rem' }}>
          Správa videokonzultácií: ambulancie, lekári, plán konzultácií.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: '0' }} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '.45rem',
              padding: '.55rem 1rem',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '.88rem',
              color: activeTab === t.id ? '#fff' : 'rgba(255,255,255,.45)',
              borderBottom: activeTab === t.id ? '2px solid var(--blue-600)' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'color .12s',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {token && (
        <>
          {activeTab === 'clinics'    && <ClinicsView    token={token} />}
          {activeTab === 'physicians' && <PhysiciansView token={token} />}
          {activeTab === 'sessions'   && <SessionsView   token={token} />}
        </>
      )}
    </div>
  );
}

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function AdminTelehealthPage() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <TelehealthAdmin />
      </AdminShell>
    </AdminAuthProvider>
  );
}
