'use client';

/**
 * Booking management (Sprint A4 Part B UI) — wired to /api/admin/bookings.
 *
 * Clinic scoping for the `clinician` role is enforced server-side (the list
 * query fails closed for a clinician with no clinic scopes). This UI mirrors
 * that gate cosmetically: reschedule is administrator+ only, matching
 * @StaffRoles on the controller. A forged request is still rejected by the API.
 *
 * Patients are shown only as `patientTokenPreview` — never name, RC or phone.
 */
import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, RefreshCw, X, CalendarClock, UserX } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { showToast } from '@/components/admin/AdminToast';
import { useAdminApi, qs, API_BASE } from '@/components/admin/admin-api';
import { Badge, Card, StatTile, btn, cell, th, field, MUTED, type Tone } from '@/components/admin/admin-ui';

type BookingStatus = 'pending' | 'booked' | 'cancelled' | 'completed' | 'no_show';

interface BookingItem {
  id: string;
  patientTokenPreview: string;
  clinicId: string;
  clinicName: string;
  physicianId?: string;
  physicianSlug?: string;
  slot: string;
  durationMin: number;
  status: BookingStatus;
  paymentStatus: 'free' | 'paid' | 'refunded' | 'pending';
  bookedAt: string;
  updatedAt: string;
}

interface ListResponse { items: BookingItem[]; total: number; page: number; limit: number }

interface Stats {
  today: { booked: number; cancelled: number; noShow: number; completed: number };
  week: { booked: number; cancelled: number; noShow: number };
  pendingReview: number;
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Čaká', booked: 'Potvrdené', cancelled: 'Zrušené', completed: 'Dokončené', no_show: 'Nedostavil sa',
};
const STATUS_TONE: Record<BookingStatus, Tone> = {
  pending: 'warn', booked: 'ok', cancelled: 'neutral', completed: 'info', no_show: 'crit',
};
const PAYMENT_LABEL: Record<BookingItem['paymentStatus'], string> = {
  free: 'Bez platby', paid: 'Zaplatené', refunded: 'Vrátené', pending: 'Čaká na platbu',
};

/** Reschedule needs a free AvailabilitySlot id in the SAME clinic (API-enforced). */
function RescheduleDialog({
  booking, onClose, onDone,
}: { booking: BookingItem; onClose: () => void; onDone: () => void }) {
  const api = useAdminApi();
  const [date, setDate] = useState(booking.slot.slice(0, 10));
  const [slots, setSlots] = useState<Array<{ id: string; time: string }>>([]);
  const [slotId, setSlotId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Public endpoint — free slots for this clinic/date.
    fetch(`${API_BASE}/api/booking/slots${qs({ clinicId: booking.clinicId, date })}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((s: Array<{ id: string; time: string }>) => { if (!cancelled) { setSlots(s); setSlotId(''); } })
      .catch(() => { if (!cancelled) setSlots([]); });
    return () => { cancelled = true; };
  }, [booking.clinicId, date]);

  const submit = async () => {
    if (!slotId) return;
    setBusy(true);
    try {
      await api.post(`/api/admin/bookings/${booking.id}/reschedule`, { newSlotId: slotId, reason: reason || undefined });
      showToast('Objednanie preobjednané.', 'success');
      onDone();
    } catch (e) {
      showToast(`Preobjednanie zlyhalo: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="resch-title"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ background: '#131e2b', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '1.2rem', width: 'min(460px,100%)' }}>
        <h2 id="resch-title" style={{ fontSize: '1rem', marginTop: 0 }}>Preobjednať — {booking.clinicName}</h2>
        <p style={{ color: MUTED, fontSize: '.82rem' }}>
          Nový termín musí byť voľný slot v tej istej ambulancii.
        </p>
        <label style={{ display: 'block', fontSize: '.82rem', marginBottom: '.6rem' }}>
          Dátum
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...field, display: 'block', marginTop: '.2rem', width: '100%' }} />
        </label>
        <label style={{ display: 'block', fontSize: '.82rem', marginBottom: '.6rem' }}>
          Voľný termín
          <select value={slotId} onChange={(e) => setSlotId(e.target.value)} style={{ ...field, display: 'block', marginTop: '.2rem', width: '100%' }}>
            <option value="">— vyberte —</option>
            {slots.map((s) => <option key={s.id} value={s.id}>{s.time}</option>)}
          </select>
        </label>
        {slots.length === 0 && <p style={{ color: '#fcd34d', fontSize: '.8rem' }}>Na tento deň nie sú voľné termíny.</p>}
        <label style={{ display: 'block', fontSize: '.82rem', marginBottom: '.9rem' }}>
          Dôvod (voliteľné)
          <input value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...field, display: 'block', marginTop: '.2rem', width: '100%' }} />
        </label>
        <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('ghost')}>Zrušiť</button>
          <button onClick={() => void submit()} disabled={!slotId || busy} style={{ ...btn('primary'), opacity: !slotId || busy ? 0.5 : 1 }}>
            {busy ? 'Ukladám…' : 'Preobjednať'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelDialog({ booking, onClose, onDone }: { booking: BookingItem; onClose: () => void; onDone: () => void }) {
  const api = useAdminApi();
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/api/admin/bookings/${booking.id}/cancel`, { reason, notifyPatient: notify });
      showToast('Objednanie zrušené.', 'success');
      onDone();
    } catch (e) {
      showToast(`Zrušenie zlyhalo: ${(e as Error).message}`, 'error');
    } finally { setBusy(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cancel-title"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ background: '#131e2b', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '1.2rem', width: 'min(440px,100%)' }}>
        <h2 id="cancel-title" style={{ fontSize: '1rem', marginTop: 0 }}>Zrušiť objednanie</h2>
        <label style={{ display: 'block', fontSize: '.82rem', marginBottom: '.7rem' }}>
          Dôvod zrušenia
          <input value={reason} onChange={(e) => setReason(e.target.value)} required
            style={{ ...field, display: 'block', marginTop: '.2rem', width: '100%' }} />
        </label>
        <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', fontSize: '.82rem', marginBottom: '.9rem' }}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Informovať pacienta SMS-kou
        </label>
        <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('ghost')}>Späť</button>
          <button onClick={() => void submit()} disabled={!reason.trim() || busy} style={{ ...btn('danger'), opacity: !reason.trim() || busy ? 0.5 : 1 }}>
            {busy ? 'Ruším…' : 'Zrušiť objednanie'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingsInner() {
  const api = useAdminApi();
  const { role } = useAdminAuth();
  const canReschedule = ['administrator', 'super_admin'].includes(role ?? '');

  const [rows, setRows] = useState<BookingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | BookingStatus>('');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<BookingItem | null>(null);
  const [rescheduling, setRescheduling] = useState<BookingItem | null>(null);

  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        api.get<ListResponse>(`/api/admin/bookings${qs({ page, limit: LIMIT, status: status || undefined, date: date || undefined })}`),
        api.get<Stats>('/api/admin/bookings/stats').catch(() => null),
      ]);
      setRows(list.items);
      setTotal(list.total);
      if (s) setStats(s);
    } catch (e) {
      showToast(`Načítanie zlyhalo: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [api, page, status, date]);

  useEffect(() => { void load(); }, [load]);

  const markNoShow = async (b: BookingItem) => {
    try {
      await api.post(`/api/admin/bookings/${b.id}/no-show`);
      showToast('Označené ako "nedostavil sa".', 'success');
      void load();
    } catch (e) {
      showToast(`Akcia zlyhala: ${(e as Error).message}`, 'error');
    }
  };

  // Client-side narrowing only — the server already scoped the page to this
  // staff member's clinics. Filters the current page, not the whole dataset.
  const shown = search
    ? rows.filter((r) =>
        `${r.clinicName} ${r.patientTokenPreview} ${r.physicianSlug ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    : rows;

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div style={{ color: '#e2e8f0' }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '1.4rem', marginBottom: '1rem' }}>
        <CalendarCheck size={22} aria-hidden /> Objednania
      </h1>

      {stats && (
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <StatTile label="Dnes potvrdené" value={stats.today.booked} tone="ok" />
          <StatTile label="Dnes zrušené" value={stats.today.cancelled} />
          <StatTile label="Dnes nedostavil" value={stats.today.noShow} tone={stats.today.noShow > 0 ? 'crit' : 'neutral'} />
          <StatTile label="Týždeň potvrdené" value={stats.week.booked} tone="info" />
          <StatTile label="Čaká na kontrolu" value={stats.pendingReview} tone={stats.pendingReview > 0 ? 'warn' : 'neutral'} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '.6rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: '.82rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Stav
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as BookingStatus | ''); }} style={field}>
            <option value="">Všetky</option>
            {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '.82rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Dátum
          <input type="date" value={date} onChange={(e) => { setPage(1); setDate(e.target.value); }} style={field} />
        </label>
        <label style={{ fontSize: '.82rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Hľadať (ambulancia / pacient)
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="napr. Kardiologická" style={{ ...field, minWidth: 220 }} />
        </label>
        <button onClick={() => void load()} aria-label="Obnoviť zoznam" style={btn('ghost')}>
          <RefreshCw size={16} aria-hidden />
        </button>
      </div>

      {loading ? <p style={{ color: MUTED }}>Načítavam…</p> : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <caption style={{ textAlign: 'left', color: MUTED, fontSize: '.8rem', paddingBottom: '.5rem' }}>
                {total} objednaní celkom — strana {page} z {pages}
              </caption>
              <thead>
                <tr>
                  <th style={th} scope="col">Termín</th>
                  <th style={th} scope="col">Ambulancia</th>
                  <th style={th} scope="col">Pacient</th>
                  <th style={th} scope="col">Stav</th>
                  <th style={th} scope="col">Platba</th>
                  <th style={th} scope="col">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((b) => {
                  const closed = b.status === 'cancelled' || b.status === 'completed';
                  return (
                    <tr key={b.id}>
                      <td style={cell}>
                        {b.slot.slice(0, 10)}<br />
                        <span style={{ color: MUTED }}>{b.slot.slice(11, 16)} · {b.durationMin} min</span>
                      </td>
                      <td style={cell}>
                        {b.clinicName}
                        {b.physicianSlug && <><br /><span style={{ color: MUTED, fontSize: '.78rem' }}>{b.physicianSlug}</span></>}
                      </td>
                      <td style={{ ...cell, fontFamily: 'ui-monospace, monospace', fontSize: '.78rem' }}>{b.patientTokenPreview}</td>
                      <td style={cell}><Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge></td>
                      <td style={cell}><span style={{ color: MUTED, fontSize: '.8rem' }}>{PAYMENT_LABEL[b.paymentStatus]}</span></td>
                      <td style={cell}>
                        <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
                          <button onClick={() => setCancelling(b)} disabled={closed} title="Zrušiť"
                            aria-label={`Zrušiť objednanie ${b.slot.slice(0, 16)}`}
                            style={{ ...btn('danger'), opacity: closed ? 0.4 : 1 }}><X size={14} aria-hidden /></button>
                          {canReschedule && (
                            <button onClick={() => setRescheduling(b)} disabled={closed} title="Preobjednať"
                              aria-label={`Preobjednať ${b.slot.slice(0, 16)}`}
                              style={{ ...btn('ghost'), opacity: closed ? 0.4 : 1 }}><CalendarClock size={14} aria-hidden /></button>
                          )}
                          <button onClick={() => void markNoShow(b)} disabled={closed || b.status === 'no_show'} title="Nedostavil sa"
                            aria-label={`Označiť ako nedostavil sa — ${b.slot.slice(0, 16)}`}
                            style={{ ...btn('ghost'), opacity: closed || b.status === 'no_show' ? 0.4 : 1 }}><UserX size={14} aria-hidden /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr><td style={{ ...cell, color: MUTED }} colSpan={6}>Žiadne objednania pre zvolený filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', alignItems: 'center' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={btn('ghost')}>← Predošlá</button>
            <span style={{ color: MUTED, fontSize: '.85rem' }}>{page} / {pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} style={btn('ghost')}>Ďalšia →</button>
          </div>
        </Card>
      )}

      {cancelling && <CancelDialog booking={cancelling} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); void load(); }} />}
      {rescheduling && <RescheduleDialog booking={rescheduling} onClose={() => setRescheduling(null)} onDone={() => { setRescheduling(null); void load(); }} />}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <BookingsInner />
      </AdminShell>
    </AdminAuthProvider>
  );
}
