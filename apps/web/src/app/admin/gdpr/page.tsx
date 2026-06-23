'use client';

/**
 * GDPR data management (Sprint A3) — wired to the patient-token web-tier APIs
 * (/api/gdpr/patient/export | erasure). Export: administrator|super_admin.
 * Erasure: super_admin only + confirm string + MFA re-verify (TOTP). The server
 * enforces all of this; this UI is cosmetic.
 *
 * (The legacy RC/booking DSAR endpoint /api/gdpr/export remains available via
 * the API; this page now drives the patient-token web-tier flow.)
 */
import { useCallback, useEffect, useState } from 'react';
import { Download, Trash2, AlertTriangle, Shield, Loader2 } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { showToast } from '@/components/admin/AdminToast';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface AuditRow { id: string; action: string; actorEmail: string; resourceId: string; createdAt: string }

function GdprPanel() {
  const { token, role } = useAdminAuth();
  const isSuper = role === 'super_admin';
  const [type, setType] = useState<'export' | 'erasure'>('export');
  const [patientToken, setPatientToken] = useState('');
  const [requestRef, setRequestRef] = useState('');
  const [reason, setReason] = useState('');
  const [confirmStr, setConfirmStr] = useState('');
  const [totp, setTotp] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ downloadUrl: string; kind: string } | null>(null);
  const [recent, setRecent] = useState<AuditRow[]>([]);

  const authHeaders = (): Record<string, string> => ({ ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' });

  const loadRecent = useCallback(async () => {
    try {
      const actions = ['gdpr_export_requested', 'gdpr_erasure_completed'];
      const results = await Promise.all(actions.map((a) =>
        fetch(`${API}/api/audit?action=${a}&limit=20`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
          .then((r) => (r.ok ? r.json() : { rows: [] }) as Promise<{ rows: AuditRow[] }>)));
      setRecent(results.flatMap((r) => r.rows).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20));
    } catch { /* non-fatal */ }
  }, [token]);

  useEffect(() => { void loadRecent(); }, [loadRecent]);

  async function submit() {
    setResult(null);
    setBusy(true);
    try {
      if (type === 'export') {
        const res = await fetch(`${API}/api/gdpr/patient/export`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ patientToken, requestReference: requestRef }) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { message?: string }).message ?? `HTTP ${res.status}`);
        const { downloadUrl } = (await res.json()) as { downloadUrl: string };
        setResult({ downloadUrl, kind: 'export' });
        showToast('Export pripravený.');
      } else {
        const res = await fetch(`${API}/api/gdpr/patient/erasure`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ patientToken, requestReference: requestRef, reason, totpCode: totp }) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { message?: string }).message ?? `HTTP ${res.status}`);
        const { downloadUrl } = (await res.json()) as { downloadUrl: string };
        setResult({ downloadUrl, kind: 'erasure' });
        showToast('Vymazanie dokončené — uložte potvrdenie.');
        setConfirmStr(''); setTotp('');
      }
      await loadRecent();
    } catch (e) {
      showToast(`Požiadavka zlyhala: ${String(e)}`, 'error');
    } finally { setBusy(false); }
  }

  const card: React.CSSProperties = { background: '#1a2533', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '1.5rem', marginBottom: '1rem' };
  const inp: React.CSSProperties = { width: '100%', marginTop: '.3rem', padding: '.55rem .7rem', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: '#0f1923', color: '#e2e8f0' };
  const lbl: React.CSSProperties = { fontSize: '.82rem', color: '#cbd5e1', display: 'block', marginBottom: '.6rem' };

  const ready = type === 'export'
    ? !!patientToken && !!requestRef && !busy
    : isSuper && !!patientToken && !!requestRef && confirmStr === 'ERASE' && totp.length >= 6 && !busy;

  return (
    <div style={{ maxWidth: 720, color: '#e2e8f0' }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontFamily: 'Newsreader, serif', color: '#fff', fontSize: '1.7rem', marginBottom: '1.2rem' }}>
        <Shield size={22} aria-hidden /> Správa dát GDPR / Data management
      </h1>

      <div style={card}>
        <h2 style={{ color: '#fff', fontSize: '1.1rem', margin: '0 0 .4rem' }}>Nová požiadavka (web-tier)</h2>
        <p style={{ color: 'rgba(255,255,255,.5)', fontSize: '.82rem', marginTop: 0 }}>
          Klinické záznamy (diagnózy, lieky, výsledky) sú v HIS ako FHIR R4 — nie v tomto systéme.
        </p>
        <div style={{ display: 'flex', gap: '.6rem', margin: '.8rem 0' }}>
          <button onClick={() => { setType('export'); setResult(null); }} aria-pressed={type === 'export'}
            style={{ flex: 1, padding: '.55rem', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: type === 'export' ? '#2563a8' : 'transparent', color: '#fff', cursor: 'pointer' }}>
            Export (Art. 15)
          </button>
          <button onClick={() => { if (isSuper) { setType('erasure'); setResult(null); } }} aria-pressed={type === 'erasure'} disabled={!isSuper}
            title={isSuper ? '' : 'Len super admin'}
            style={{ flex: 1, padding: '.55rem', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: type === 'erasure' ? 'rgba(192,57,43,.3)' : 'transparent', color: isSuper ? '#fff' : '#64748b', cursor: isSuper ? 'pointer' : 'not-allowed' }}>
            Vymazanie (Art. 17)
          </button>
        </div>

        <label style={lbl}>Patient token<input value={patientToken} onChange={(e) => setPatientToken(e.target.value)} style={inp} aria-label="Patient token" /></label>
        <label style={lbl}>Číslo požiadavky / Request reference<input value={requestRef} onChange={(e) => setRequestRef(e.target.value)} placeholder="GDPR-2024-001" style={inp} aria-label="Číslo požiadavky" /></label>

        {type === 'erasure' && (
          <div style={{ border: '1px solid rgba(192,57,43,.3)', borderRadius: 8, padding: '.8rem', marginTop: '.4rem' }}>
            <p id="erasure-consequences" style={{ display: 'flex', gap: '.5rem', color: '#fca5a5', fontSize: '.82rem', margin: '0 0 .6rem' }}>
              <AlertTriangle size={16} aria-hidden />
              <span>Nevratné. Vymaže device readings (okrem FHIR-viazaných), súhlasy a notifikácie; anonymizuje audit meta. FHIR záznamy zostávajú (zákon 362/2011).</span>
            </p>
            <label style={lbl}>Dôvod / Reason<textarea value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...inp, minHeight: 60 }} aria-label="Dôvod vymazania" aria-describedby="erasure-consequences" /></label>
            <label style={lbl}>Napíšte <code>ERASE</code> pre potvrdenie<input value={confirmStr} onChange={(e) => setConfirmStr(e.target.value)} style={inp} aria-label="Potvrdenie vymazania" /></label>
            <label style={lbl}>MFA kód (opätovné overenie)<input value={totp} onChange={(e) => setTotp(e.target.value)} inputMode="numeric" style={inp} aria-label="MFA kód" /></label>
          </div>
        )}

        <button onClick={() => void submit()} disabled={!ready}
          style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '.9rem', padding: '.65rem 1.2rem', borderRadius: 9, border: 0, fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed', opacity: ready ? 1 : 0.5, background: type === 'erasure' ? 'rgba(192,57,43,.85)' : '#2563a8', color: '#fff' }}>
          {busy ? <Loader2 size={16} className="spin" /> : type === 'erasure' ? <Trash2 size={16} /> : <Download size={16} />}
          {type === 'erasure' ? 'Spustiť vymazanie' : 'Vytvoriť export'}
        </button>

        {result && (
          <div role="status" style={{ marginTop: '1rem', padding: '.8rem', borderRadius: 8, background: 'rgba(47,138,100,.15)', border: '1px solid rgba(47,138,100,.4)' }}>
            <p style={{ margin: '0 0 .4rem', color: '#6ee7b7', fontSize: '.85rem' }}>
              {result.kind === 'export' ? 'Stiahnite súbor do 5 minút:' : 'Stiahnite potvrdenie (uložte bezpečne):'}
            </p>
            <a href={result.downloadUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd', wordBreak: 'break-all', fontSize: '.82rem' }}>{result.downloadUrl}</a>
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={{ color: '#fff', fontSize: '1.05rem', margin: '0 0 .6rem' }}>Posledné požiadavky</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: '.74rem', textTransform: 'uppercase' }}>
            <th scope="col" style={{ padding: '.4rem .5rem' }}>Čas</th><th scope="col" style={{ padding: '.4rem .5rem' }}>Akcia</th><th scope="col" style={{ padding: '.4rem .5rem' }}>Aktér</th>
          </tr></thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,.07)', fontSize: '.84rem' }}>
                <td style={{ padding: '.4rem .5rem' }}>{new Date(r.createdAt).toLocaleString('sk')}</td>
                <td style={{ padding: '.4rem .5rem' }}>{r.action}</td>
                <td style={{ padding: '.4rem .5rem', color: '#94a3b8' }}>{r.actorEmail}</td>
              </tr>
            ))}
            {recent.length === 0 && <tr><td colSpan={3} style={{ padding: '.6rem .5rem', color: '#94a3b8', fontSize: '.84rem' }}>Žiadne požiadavky.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GdprAdminPage() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <GdprPanel />
      </AdminShell>
    </AdminAuthProvider>
  );
}
