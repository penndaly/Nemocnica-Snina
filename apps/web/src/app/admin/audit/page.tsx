'use client';

/**
 * Audit log viewer (Sprint A3) — read-only, role administrator|super_admin.
 * Wired to /api/audit (server-enforced role gate; this UI is cosmetic). No
 * edit/delete controls exist — the log is append-only.
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollText, RefreshCw } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { showToast } from '@/components/admin/AdminToast';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface AuditRow {
  id: string; action: string; actorEmail: string; actorRole: string;
  resource: string; resourceId: string; detail: unknown; ip: string | null; createdAt: string;
}

function AuditInner() {
  const { token } = useAdminAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: '50' });
      if (action) qs.set('action', action);
      const res = await fetch(`${API}/api/audit?${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { rows: AuditRow[]; total: number };
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) {
      showToast(`Načítanie zlyhalo: ${String(e)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, action, token]);

  useEffect(() => { void load(); }, [load]);

  const cell: React.CSSProperties = { padding: '.6rem .8rem', borderBottom: '1px solid rgba(255,255,255,.07)', fontSize: '.85rem', verticalAlign: 'top' };
  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <div style={{ padding: '1.5rem 2rem', color: '#e2e8f0' }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '1.4rem', marginBottom: '1rem' }}>
        <ScrollText size={22} aria-hidden /> Audit log
      </h1>

      <div style={{ display: 'flex', gap: '.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '.82rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Akcia / Action
          <input value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }} placeholder="napr. staff_login_success"
            style={{ padding: '.45rem .6rem', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: '#0f1923', color: '#e2e8f0', minWidth: 260 }} />
        </label>
        <button onClick={() => void load()} aria-label="Obnoviť" style={{ alignSelf: 'flex-end', background: 'transparent', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, color: '#cbd5e1', padding: '.5rem .7rem', cursor: 'pointer' }}>
          <RefreshCw size={16} aria-hidden />
        </button>
      </div>

      {loading ? <p style={{ color: '#94a3b8' }}>Načítavam…</p> : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,.03)', borderRadius: 10, overflow: 'hidden' }}>
            <caption style={{ textAlign: 'left', color: '#94a3b8', fontSize: '.78rem', padding: '.3rem .2rem' }}>
              {total} záznamov · strana {page}/{pages} (read-only, append-only)
            </caption>
            <thead>
              <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: '.74rem', textTransform: 'uppercase' }}>
                <th scope="col" style={cell}>Čas</th><th scope="col" style={cell}>Aktér</th>
                <th scope="col" style={cell}>Akcia</th><th scope="col" style={cell}>Cieľ</th><th scope="col" style={cell}>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={cell}>{new Date(r.createdAt).toLocaleString('sk')}</td>
                  <td style={cell}>{r.actorEmail}<br /><span style={{ color: '#94a3b8' }}>{r.actorRole}</span></td>
                  <td style={cell}>{r.action}</td>
                  <td style={cell}>{r.resource}{r.resourceId ? ` / ${r.resourceId}` : ''}</td>
                  <td style={{ ...cell, color: '#94a3b8' }}>{r.ip ?? '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td style={{ ...cell, color: '#94a3b8' }} colSpan={5}>Žiadne záznamy.</td></tr>}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', alignItems: 'center' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={pgBtn}>← Predošlá</button>
            <span style={{ color: '#94a3b8', fontSize: '.85rem' }}>{page} / {pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} style={pgBtn}>Ďalšia →</button>
          </div>
        </>
      )}
    </div>
  );
}

const pgBtn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, color: '#cbd5e1', padding: '.4rem .8rem', cursor: 'pointer' };

export default function AuditPage() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <AuditInner />
      </AdminShell>
    </AdminAuthProvider>
  );
}
