'use client';

import { useRef } from 'react';
import { Download, Upload, RotateCcw, AlertTriangle } from 'lucide-react';
import { AdminAuthProvider } from '@/components/admin/AdminAuthContext';
import { AdminShell, useAdminData } from '@/components/admin/AdminShell';
import { showToast } from '@/components/admin/AdminToast';
import { cloneSeed } from '@/components/admin/admin-store';

function ToolsPage() {
  const { data, updateCollection, updateSingleton } = useAdminData();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nemocnica-snina-export-${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export dokončený.');
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result ?? '{}')) as Record<string, unknown>;
        const collKeys = ['departments','clinics','physicians','services','facilities','news','disclosures'] as const;
        collKeys.forEach((k) => { if (parsed[k]) updateCollection(k, parsed[k] as unknown[]); });
        if (parsed['hospital']) updateSingleton('hospital', parsed['hospital']);
        if (parsed['pages']) updateSingleton('pages', parsed['pages']);
        showToast('Import dokončený.');
      } catch {
        showToast('Chyba pri importe — neplatný JSON.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleReset() {
    if (!confirm('Naozaj obnoviť všetok obsah na predvolené hodnoty? Vaše zmeny sa stratia.')) return;
    const seed = cloneSeed();
    const collKeys = ['departments','clinics','physicians','services','facilities','news','disclosures'] as const;
    collKeys.forEach((k) => updateCollection(k, seed[k] as unknown[]));
    updateSingleton('hospital', seed.hospital);
    updateSingleton('pages', seed.pages);
    showToast('Obsah obnovený na predvolené hodnoty.');
  }

  const cardStyle: React.CSSProperties = {
    background: '#1a2533',
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 12,
    padding: '1.5rem',
  };

  const btnStyle = (danger = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '.6rem',
    background: danger ? 'rgba(192,57,43,.2)' : 'rgba(255,255,255,.07)',
    color: danger ? '#fca5a5' : 'rgba(255,255,255,.8)',
    border: `1px solid ${danger ? 'rgba(192,57,43,.4)' : 'rgba(255,255,255,.12)'}`,
    borderRadius: 9, padding: '.7em 1.4em',
    fontFamily: 'Mulish, sans-serif', fontWeight: 700, fontSize: '.95rem',
    cursor: 'pointer', width: '100%', marginTop: '.75rem',
  });

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: 'Newsreader, serif', color: '#fff', fontSize: '1.7rem', marginBottom: '1.5rem' }}>
        Nástroje
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Export */}
        <div style={cardStyle}>
          <h2 style={{ color: '#fff', fontSize: '1.1rem', margin: '0 0 .4rem' }}>Export dát</h2>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: '.88rem', margin: '0 0 .75rem' }}>
            Stiahnuť všetok obsah ako JSON súbor. Použite na zálohu alebo migráciu.
          </p>
          <button onClick={handleExport} style={btnStyle()}>
            <Download size={16} />
            Exportovať JSON
          </button>
        </div>

        {/* Import */}
        <div style={cardStyle}>
          <h2 style={{ color: '#fff', fontSize: '1.1rem', margin: '0 0 .4rem' }}>Import dát</h2>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: '.88rem', margin: '0 0 .75rem' }}>
            Nahrať JSON súbor exportovaný z tohto systému. Aktuálny obsah bude prepísaný.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: 'none' }}
            aria-label="Vybrať JSON súbor"
          />
          <button onClick={() => fileRef.current?.click()} style={btnStyle()}>
            <Upload size={16} />
            Importovať JSON
          </button>
        </div>

        {/* Reset */}
        <div style={{ ...cardStyle, border: '1px solid rgba(192,57,43,.3)' }}>
          <div style={{ display: 'flex', gap: '.6rem', alignItems: 'flex-start', marginBottom: '.75rem' }}>
            <AlertTriangle size={18} color="#fca5a5" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <h2 style={{ color: '#fca5a5', fontSize: '1.1rem', margin: '0 0 .3rem' }}>Obnoviť predvolené</h2>
              <p style={{ color: 'rgba(255,160,150,.6)', fontSize: '.88rem', margin: 0 }}>
                Prepíše všetok obsah pôvodnými hodnotami zo seed dát. Táto akcia je nevratná.
              </p>
            </div>
          </div>
          <button onClick={handleReset} style={btnStyle(true)}>
            <RotateCcw size={16} />
            Obnoviť predvolené
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
