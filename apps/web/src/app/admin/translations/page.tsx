'use client';

/**
 * Translation review (Sprint A3) — review queue + side-by-side review + approve/
 * reject, wired to /api/cms/translations. Approve publishes the locale entry
 * (server-side gate); reject keeps it a draft. All roles may review.
 */
import { useCallback, useEffect, useState } from 'react';
import { Globe, Check, X, RefreshCw, Loader2 } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { showToast } from '@/components/admin/AdminToast';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const LOCALES = ['cs', 'pl', 'hu', 'uk'] as const;

interface PendingItem { id: number; slug: string; locale: string; title: string }
interface PendingResp { total: number; byCollection: Record<string, PendingItem[]>; byLocale: Record<string, number> }
type ReviewTarget = { collection: string; item: PendingItem };

function TranslationsInner() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<PendingResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [localeFilter, setLocaleFilter] = useState<string>('');
  const [review, setReview] = useState<ReviewTarget | null>(null);

  const headers = useCallback((): Record<string, string> => (token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }), [token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/cms/translations/pending`, { headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as PendingResp);
    } catch (e) {
      showToast(`Načítanie zlyhalo: ${String(e)}`, 'error');
    } finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ padding: '1.5rem 2rem', color: '#e2e8f0', maxWidth: 920 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '1.4rem' }}>
          <Globe size={22} aria-hidden /> Preklady / Translations
          {data && data.total > 0 && (
            <span aria-label={`${data.total} čaká na kontrolu`} style={{ background: 'rgba(192,138,46,.2)', color: '#fcd34d', borderRadius: 999, padding: '.1rem .6rem', fontSize: '.8rem' }}>{data.total}</span>
          )}
        </h1>
        <button onClick={() => void load()} aria-label="Obnoviť" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, color: '#cbd5e1', padding: '.5rem .7rem', cursor: 'pointer' }}>
          <RefreshCw size={16} aria-hidden />
        </button>
      </div>

      <div role="group" aria-label="Filter podľa jazyka" style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem' }}>
        <button onClick={() => setLocaleFilter('')} aria-pressed={localeFilter === ''} style={chip(localeFilter === '')}>Všetky</button>
        {LOCALES.map((l) => (
          <button key={l} onClick={() => setLocaleFilter(l)} aria-pressed={localeFilter === l} style={chip(localeFilter === l)}>
            {l.toUpperCase()}{data?.byLocale[l] ? ` (${data.byLocale[l]})` : ''}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: '#94a3b8' }}>Načítavam…</p> : !data || data.total === 0 ? (
        <p style={{ color: '#94a3b8' }}>Žiadne preklady nečakajú na kontrolu. 🎉</p>
      ) : (
        Object.entries(data.byCollection).map(([collection, items]) => {
          const shown = items.filter((i) => !localeFilter || i.locale === localeFilter);
          if (!shown.length) return null;
          return (
            <section key={collection} style={{ marginBottom: '1.2rem' }}>
              <h2 style={{ fontSize: '.95rem', color: '#cbd5e1', textTransform: 'capitalize', marginBottom: '.5rem' }}>{collection} ({shown.length})</h2>
              <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 10, overflow: 'hidden' }}>
                {shown.map((item) => (
                  <div key={`${item.id}-${item.locale}`} style={{ display: 'flex', alignItems: 'center', gap: '.8rem', padding: '.7rem .9rem', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                    <span style={{ flex: 1, fontSize: '.9rem' }}>{item.title || item.slug}</span>
                    <span style={{ background: 'rgba(37,99,168,.2)', color: '#93c5fd', borderRadius: 6, padding: '.1rem .5rem', fontSize: '.78rem' }}>{item.locale.toUpperCase()}</span>
                    <span style={{ color: '#fcd34d', fontSize: '.78rem' }}>needs review</span>
                    <button onClick={() => setReview({ collection, item })} style={btn('#2563a8')}>Skontrolovať</button>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}

      {review && (
        <ReviewDrawer target={review} headers={headers} onClose={() => setReview(null)} onDone={() => { setReview(null); void load(); }} />
      )}
    </div>
  );
}

function ReviewDrawer({ target, headers, onClose, onDone }: { target: ReviewTarget; headers: () => Record<string, string>; onClose: () => void; onDone: () => void }) {
  const { collection, item } = target;
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const [detail, setDetail] = useState<unknown>(null);

  useEffect(() => {
    fetch(`${API}/api/cms/translations/${collection}/${item.id}`, { headers: headers() })
      .then((r) => (r.ok ? r.json() : null)).then(setDetail).catch(() => setDetail(null));
  }, [collection, item.id, headers]);

  async function submit(status: 'approved' | 'rejected') {
    setBusy(status);
    try {
      const res = await fetch(`${API}/api/cms/translations/${collection}/${item.id}/${item.locale}/review`, {
        method: 'PUT', headers: headers(), body: JSON.stringify({ status, notes: notes || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { message?: string }).message ?? `HTTP ${res.status}`);
      showToast(status === 'approved' ? 'Schválené a publikované.' : 'Zamietnuté (zostáva koncept).');
      onDone();
    } catch (e) {
      showToast(`Akcia zlyhala: ${String(e)}`, 'error');
    } finally { setBusy(null); }
  }

  const panel: React.CSSProperties = { background: '#0f1923', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '.8rem', fontSize: '.85rem', minHeight: 120, whiteSpace: 'pre-wrap', overflow: 'auto' };

  return (
    <div role="dialog" aria-modal="true" aria-label={`Kontrola prekladu — ${item.title} ${item.locale.toUpperCase()}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }}>
      <div style={{ width: 'min(720px, 100%)', height: '100%', overflowY: 'auto', background: '#111c27', padding: '1.5rem', color: '#e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>{item.title || item.slug} · {item.locale.toUpperCase()}</h2>
          <button onClick={onClose} aria-label="Zavrieť" style={{ background: 'transparent', border: 0, color: '#cbd5e1', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '.78rem', color: '#94a3b8', marginBottom: '.3rem' }}>SK (originál)</div>
            <div style={panel}>{extractText(detail, 'sk') || 'Originál sa nepodarilo načítať (vyžaduje sa Strapi).'}</div>
          </div>
          <div>
            <div style={{ fontSize: '.78rem', color: '#94a3b8', marginBottom: '.3rem' }}>{item.locale.toUpperCase()} (strojový preklad)</div>
            <div style={panel}>{extractText(detail, item.locale) || 'Preklad sa nepodarilo načítať.'}</div>
          </div>
        </div>

        <label style={{ fontSize: '.82rem', color: '#cbd5e1', display: 'block', marginBottom: '1rem' }}>
          Poznámky ku kontrole (nepovinné)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', marginTop: '.3rem', minHeight: 70, padding: '.55rem .7rem', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: '#0f1923', color: '#e2e8f0' }} aria-label="Poznámky ku kontrole" />
        </label>

        <div style={{ display: 'flex', gap: '.6rem' }}>
          <button onClick={() => void submit('approved')} disabled={busy !== null} style={btn('rgba(47,138,100,.85)')}>
            {busy === 'approved' ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Schváliť a publikovať
          </button>
          <button onClick={() => void submit('rejected')} disabled={busy !== null} style={btn('rgba(192,57,43,.7)')}>
            {busy === 'rejected' ? <Loader2 size={15} className="spin" /> : <X size={15} />} Zamietnuť
          </button>
          <button onClick={onClose} style={btn('transparent', true)}>← Späť na zoznam</button>
        </div>
      </div>
    </div>
  );
}

/** Best-effort extraction of a representative text field for a locale from the Strapi response. */
function extractText(detail: unknown, locale: string): string {
  if (!detail || typeof detail !== 'object') return '';
  const root = (detail as { data?: { attributes?: Record<string, unknown> } }).data?.attributes ?? (detail as Record<string, unknown>);
  const pick = (a: Record<string, unknown> | undefined) => {
    if (!a) return '';
    for (const k of ['summary', 'desc', 'body', 'name', 'title']) {
      if (typeof a[k] === 'string' && a[k]) return a[k] as string;
    }
    return '';
  };
  const a = root as Record<string, unknown>;
  if ((a['locale'] as string) === locale) return pick(a);
  const locs = (a['localizations'] as { data?: { attributes?: Record<string, unknown> }[] })?.data ?? [];
  for (const l of locs) {
    if ((l.attributes?.['locale'] as string) === locale) return pick(l.attributes);
  }
  return '';
}

const chip = (active: boolean): React.CSSProperties => ({ padding: '.35rem .7rem', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: active ? '#2563a8' : 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.82rem' });
const btn = (bg: string, ghost = false): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.5rem .9rem', borderRadius: 8, border: ghost ? '1px solid rgba(255,255,255,.15)' : 0, background: bg, color: ghost ? '#cbd5e1' : '#fff', cursor: 'pointer', fontSize: '.85rem', fontWeight: 700 });

export default function TranslationsPage() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <TranslationsInner />
      </AdminShell>
    </AdminAuthProvider>
  );
}
