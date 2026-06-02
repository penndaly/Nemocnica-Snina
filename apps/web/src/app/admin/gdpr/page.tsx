'use client';

import { useState } from 'react';
import { Download, Trash2, AlertTriangle, Shield, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { AdminAuthProvider } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthContext';
import { showToast } from '@/components/admin/AdminToast';

function DsarPanel() {
  const { token } = useAdminAuth();
  const [rc, setRc]           = useState('');
  const [showRc, setShowRc]   = useState(false);
  const [loading, setLoading] = useState<'export' | 'erase' | null>(null);
  const [exportData, setExportData] = useState<unknown>(null);
  const [eraseResult, setEraseResult] = useState<unknown>(null);
  const [error, setError]     = useState('');
  const [confirmErase, setConfirmErase] = useState(false);

  const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

  async function callApi(path: string, body: Record<string, unknown>) {
    const res = await fetch(`${API}/api/gdpr/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function handleExport() {
    if (!rc.trim()) return;
    setLoading('export'); setError(''); setExportData(null);
    try {
      const data = await callApi('export', { patientRc: rc.replace(/\s/g, '') });
      setExportData(data);
      showToast('Export dokončený.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba pri exporte.');
    } finally { setLoading(null); }
  }

  async function handleErase() {
    if (!rc.trim() || !confirmErase) return;
    setLoading('erase'); setError(''); setEraseResult(null);
    try {
      const data = await callApi('erase', { patientRc: rc.replace(/\s/g, ''), confirmErasure: true });
      setEraseResult(data);
      showToast('Anonymizácia dokončená. Audit záznam bol vytvorený.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba pri mazaní.');
    } finally { setLoading(null); setConfirmErase(false); }
  }

  function downloadExport() {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `dsar-export-${new Date().toISOString().substring(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  const fieldStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,.06)', border: '1.5px solid rgba(255,255,255,.12)',
    borderRadius: 9, padding: '.6em .85em', color: '#e8f0fb',
    fontFamily: 'Mulish, sans-serif', fontSize: '1rem', outline: 'none', flex: 1,
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontFamily: 'Newsreader, serif', color: '#fff', fontSize: '1.7rem', marginBottom: '.4rem' }}>
        GDPR — Práva dotknutých osôb
      </h1>
      <p style={{ color: 'rgba(255,255,255,.4)', fontSize: '.9rem', marginBottom: '2rem' }}>
        Čl. 15 (prístup) a čl. 17 (výmaz) GDPR · Len admin rola · Každá akcia je zaznamenaná v audit logu
      </p>

      {/* RC input */}
      <div style={{ background: '#1a2533', borderRadius: 12, border: '1px solid rgba(255,255,255,.07)', padding: '1.5rem', marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', color: 'rgba(255,255,255,.45)', fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>
          Rodné číslo dotknutej osoby
        </label>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <input
            type={showRc ? 'text' : 'password'}
            value={rc}
            onChange={e => setRc(e.target.value)}
            placeholder="YYMMDD/CCCC"
            style={fieldStyle}
            aria-label="Rodné číslo"
          />
          <button
            onClick={() => setShowRc(!showRc)}
            aria-label={showRc ? 'Skryť' : 'Zobraziť'}
            style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: 'rgba(255,255,255,.5)', cursor: 'pointer', padding: '0 .75rem' }}
          >
            {showRc ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p style={{ color: 'rgba(255,255,255,.25)', fontSize: '.75rem', marginTop: '.4rem' }}>
          Rodné číslo sa neuchováva — slúži len na vyhľadanie zašifrovaných záznamov.
        </p>
      </div>

      {/* Export (Art. 15) */}
      <div style={{ background: '#1a2533', borderRadius: 12, border: '1px solid rgba(255,255,255,.07)', padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', marginBottom: '1rem' }}>
          <Shield size={20} color="#93c5fd" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <h2 style={{ color: '#fff', fontSize: '1.05rem', margin: '0 0 .25rem' }}>Čl. 15 — Právo na prístup k údajom</h2>
            <p style={{ color: 'rgba(255,255,255,.4)', fontSize: '.85rem', margin: 0 }}>
              Export všetkých osobných údajov uložených na webovej vrstve (rezervácie, žiadosti, OTP záznamy).
              Klinické záznamy sú v HIS a sú mimo rozsahu tohto exportu.
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={!rc.trim() || loading !== null}
          style={{ display: 'flex', alignItems: 'center', gap: '.5rem', background: loading === 'export' ? 'rgba(30,82,144,.5)' : 'var(--blue-700,#1e5290)', color: '#fff', border: 'none', borderRadius: 9, padding: '.65em 1.3em', fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '.92rem', cursor: !rc.trim() || loading !== null ? 'not-allowed' : 'pointer' }}
        >
          {loading === 'export' ? <Loader2 size={15} /> : <Download size={15} />}
          Exportovať údaje
        </button>
        {exportData && (
          <div style={{ marginTop: '1rem', background: 'rgba(47,138,100,.1)', border: '1px solid rgba(47,138,100,.3)', borderRadius: 9, padding: '.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <span style={{ color: '#6ee7b7', fontSize: '.88rem' }}>
              <Check size={14} style={{ display: 'inline', marginRight: '.4em' }} />
              Export pripravený
            </span>
            <button
              onClick={downloadExport}
              style={{ display: 'flex', alignItems: 'center', gap: '.4rem', background: 'rgba(255,255,255,.08)', color: '#e8f0fb', border: '1px solid rgba(255,255,255,.12)', borderRadius: 7, padding: '.4em .9em', fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '.82rem', cursor: 'pointer' }}
            >
              <Download size={14} /> Stiahnuť JSON
            </button>
          </div>
        )}
      </div>

      {/* Erasure (Art. 17) */}
      <div style={{ background: '#1a2533', borderRadius: 12, border: '1px solid rgba(192,57,43,.3)', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', marginBottom: '1rem' }}>
          <AlertTriangle size={20} color="#fca5a5" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <h2 style={{ color: '#fca5a5', fontSize: '1.05rem', margin: '0 0 .25rem' }}>Čl. 17 — Právo na výmaz (anonymizácia)</h2>
            <p style={{ color: 'rgba(255,160,150,.6)', fontSize: '.85rem', margin: 0 }}>
              Anonymizuje osobné údaje v rezerváciách a žiadostiach. Záznamy pre účtovné a bezpečnostné účely zostanú zachované s odôvodnením. Audit záznam sa vždy vytvorí.
            </p>
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '.65rem', cursor: 'pointer', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            checked={confirmErase}
            onChange={e => setConfirmErase(e.target.checked)}
            style={{ marginTop: 3, width: 16, height: 16, accentColor: '#ef4444' }}
          />
          <span style={{ color: 'rgba(255,200,200,.7)', fontSize: '.88rem' }}>
            Potvrdzujem, že som overil totožnosť dotknutej osoby a mám právny základ pre výmaz. Táto akcia je nevratná.
          </span>
        </label>
        <button
          onClick={handleErase}
          disabled={!rc.trim() || !confirmErase || loading !== null}
          style={{ display: 'flex', alignItems: 'center', gap: '.5rem', background: !rc.trim() || !confirmErase || loading !== null ? 'rgba(192,57,43,.15)' : 'rgba(192,57,43,.4)', color: !rc.trim() || !confirmErase ? 'rgba(255,140,130,.4)' : '#fca5a5', border: '1px solid rgba(192,57,43,.4)', borderRadius: 9, padding: '.65em 1.3em', fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '.92rem', cursor: !rc.trim() || !confirmErase || loading !== null ? 'not-allowed' : 'pointer' }}
        >
          {loading === 'erase' ? <Loader2 size={15} /> : <Trash2 size={15} />}
          Anonymizovať údaje
        </button>
        {eraseResult && (
          <div style={{ marginTop: '1rem', background: 'rgba(47,138,100,.1)', border: '1px solid rgba(47,138,100,.3)', borderRadius: 9, padding: '.75rem 1rem', color: '#6ee7b7', fontSize: '.88rem' }}>
            <Check size={14} style={{ display: 'inline', marginRight: '.4em' }} />
            Anonymizácia dokončená. Audit záznam ID: {(eraseResult as { auditEntryId?: string }).auditEntryId ?? '—'}
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginTop: '1rem', background: 'rgba(192,57,43,.2)', border: '1px solid rgba(192,57,43,.4)', borderRadius: 9, padding: '.65rem 1rem', color: '#fca5a5', fontSize: '.9rem' }} role="alert">
          {error}
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,.03)', borderRadius: 9, fontSize: '.8rem', color: 'rgba(255,255,255,.3)' }}>
        Klinické záznamy (diagnózy, lieky, laboratórne výsledky) sú uložené v HIS a podliehajú zodpovednosti prevádzkovateľa HIS. Žiadosť o prístup ku klinickým záznamom musí byť smerovaná na HIS správcu dát.
      </div>
    </div>
  );
}

export default function GdprAdminPage() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <DsarPanel />
      </AdminShell>
    </AdminAuthProvider>
  );
}
