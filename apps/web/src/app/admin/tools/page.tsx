'use client';

/**
 * CMS Tools (Sprint A3) — production export/import/reset wired to /api/cms/tools.
 * Replaces the prototype's localStorage-backed buttons. Server enforces roles
 * (export: administrator|super_admin; import/reset: super_admin) and the reset
 * confirm-string + password re-entry.
 */
import { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { showToast } from '@/components/admin/AdminToast';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const RESET_CONFIRM = 'RESET_ALL_CONTENT';

function ToolsPage() {
  const { token } = useAdminAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'import' | 'reset' | null>(null);
  const [confirmStr, setConfirmStr] = useState('');
  const [password, setPassword] = useState('');

  const authHeaders = (json = false): Record<string, string> => ({
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  });

  async function handleExport() {
    setBusy('export');
    try {
      const res = await fetch(`${API}/api/cms/tools/export`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { downloadUrl } = (await res.json()) as { downloadUrl: string };
      window.open(downloadUrl, '_blank');
      showToast('Export pripravený — stiahnite súbor do 5 minút.');
    } catch (e) {
      showToast(`Export zlyhal: ${String(e)}`, 'error');
    } finally { setBusy(null); }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('import');
    try {
      const bundle = JSON.parse(await file.text()) as unknown;
      const res = await fetch(`${API}/api/cms/tools/import`, { method: 'POST', headers: authHeaders(true), body: JSON.stringify(bundle) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { message?: string }).message ?? `HTTP ${res.status}`);
      showToast('Import dokončený.');
    } catch (err) {
      showToast(`Import zlyhal: ${String(err)}`, 'error');
    } finally { setBusy(null); }
  }

  async function handleReset() {
    setBusy('reset');
    try {
      const res = await fetch(`${API}/api/cms/tools/reset`, { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ confirm: confirmStr, password }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { message?: string }).message ?? `HTTP ${res.status}`);
      showToast('Obsah obnovený na SEED v8.');
      setConfirmStr(''); setPassword('');
    } catch (e) {
      showToast(`Reset zlyhal: ${String(e)}`, 'error');
    } finally { setBusy(null); }
  }

  const card: React.CSSProperties = { background: '#1a2533', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '1.5rem' };
  const btn = (danger = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.6rem',
    background: danger ? 'rgba(192,57,43,.2)' : 'rgba(255,255,255,.07)',
    color: danger ? '#fca5a5' : 'rgba(255,255,255,.85)',
    border: `1px solid ${danger ? 'rgba(192,57,43,.4)' : 'rgba(255,255,255,.12)'}`,
    borderRadius: 9, padding: '.7em 1.4em', fontWeight: 700, fontSize: '.95rem', cursor: 'pointer', width: '100%', marginTop: '.75rem',
  });
  const inp: React.CSSProperties = { width: '100%', marginTop: '.5rem', padding: '.55rem .7rem', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: '#0f1923', color: '#e2e8f0' };
  const resetReady = confirmStr === RESET_CONFIRM && password.length > 0 && busy !== 'reset';

  return (
    <div style={{ maxWidth: 640, color: '#e2e8f0' }}>
      <h1 style={{ fontFamily: 'Newsreader, serif', color: '#fff', fontSize: '1.7rem', marginBottom: '1.5rem' }}>Nástroje obsahu / Content tools</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={card}>
          <h2 style={{ color: '#fff', fontSize: '1.1rem', margin: '0 0 .4rem' }}>Export dát</h2>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: '.88rem', margin: '0 0 .25rem' }}>Stiahnuť všetok obsah ako šifrovaný JSON (podpísaný odkaz, platný 5 min).</p>
          <button onClick={() => void handleExport()} disabled={busy === 'export'} style={btn()}>
            {busy === 'export' ? <Loader2 size={16} className="spin" /> : <Download size={16} />} Exportovať JSON
          </button>
        </div>

        <div style={card}>
          <h2 style={{ color: '#fff', fontSize: '1.1rem', margin: '0 0 .4rem' }}>Import dát</h2>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: '.88rem', margin: '0 0 .25rem' }}>Nahrať JSON exportovaný z tohto systému. Médiá (fotky, PDF) sa nemenia.</p>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} aria-label="Vybrať JSON súbor na import" />
          <button onClick={() => fileRef.current?.click()} disabled={busy === 'import'} style={btn()}>
            {busy === 'import' ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Importovať JSON
          </button>
        </div>

        <div style={{ ...card, border: '1px solid rgba(192,57,43,.3)' }}>
          <div style={{ display: 'flex', gap: '.6rem', alignItems: 'flex-start', marginBottom: '.5rem' }}>
            <AlertTriangle size={18} color="#fca5a5" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden />
            <div>
              <h2 style={{ color: '#fca5a5', fontSize: '1.1rem', margin: '0 0 .3rem' }}>Obnoviť na SEED v8</h2>
              <p style={{ color: 'rgba(255,160,150,.6)', fontSize: '.88rem', margin: 0 }}>Prepíše obsah seed dátami. Účty, audit log, dáta pacientov a médiá zostávajú. Nevratné.</p>
            </div>
          </div>
          <label style={{ fontSize: '.82rem', color: '#cbd5e1', display: 'block', marginTop: '.6rem' }}>
            Napíšte <code>{RESET_CONFIRM}</code> pre potvrdenie
            <input value={confirmStr} onChange={(e) => setConfirmStr(e.target.value)} style={inp} aria-label="Potvrdzovací reťazec" />
          </label>
          <label style={{ fontSize: '.82rem', color: '#cbd5e1', display: 'block', marginTop: '.6rem' }}>
            Zadajte heslo (opätovné overenie)
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inp} aria-label="Heslo na opätovné overenie" />
          </label>
          <button onClick={() => void handleReset()} disabled={!resetReady} style={{ ...btn(true), opacity: resetReady ? 1 : 0.5, cursor: resetReady ? 'pointer' : 'not-allowed' }}>
            {busy === 'reset' ? <Loader2 size={16} className="spin" /> : <RotateCcw size={16} />} Obnoviť predvolené
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <ToolsPage />
      </AdminShell>
    </AdminAuthProvider>
  );
}
