'use client';

/**
 * Physician wearables view (Sprint W5) — /admin/patients/[patientToken]/wearables.
 *
 * Summary cards · 7-day alert history · per-device panels (trend sparkline +
 * last-10 readings + manual FHIR export) · clinician threshold editor.
 * Server gates access (403 PHYSICIAN_ACCESS_DENIED) unless the physician has a
 * relationship to the patient; non-clinician roles cannot set thresholds.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Activity, AlertTriangle, Download, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';

const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Reading { id: string; metricType: string; metricLabel: Record<string, string>; value: string; unit: string; flag: string; recordedAt: string; inHis: boolean }
interface Device { id: string; brand: string; model: string; deviceType: string; status: string; lastSyncAt: string | null; readings: Reading[] }
interface Alert { id: string; deviceId: string | null; metricType: string | null; value: string | null; flag: string | null; severity: string; createdAt: string }
interface PhysicianView { patientToken: string; devices: Device[]; alerts: Alert[] }

const FLAG_COLOR: Record<string, string> = { normal: '#4ade80', high: '#f5c842', low: '#f5c842', critical: '#f87171' };
const METRICS = [
  { code: '14745-4', label: 'Glukóza', unit: 'mmol/l' },
  { code: '8867-4', label: 'Tep', unit: 'bpm' },
  { code: '8480-6', label: 'Systolický TK', unit: 'mmHg' },
  { code: '59408-5', label: 'SpO₂', unit: '%' },
];

function timeAgo(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`;
}

function Sparkline({ readings }: { readings: Reading[] }) {
  const nums = readings.map((r) => Number(r.value)).filter((n) => !Number.isNaN(n)).slice(0, 24).reverse();
  if (nums.length < 2) return <span style={{ color: '#888', fontSize: '.8rem' }}>—</span>;
  const min = Math.min(...nums), max = Math.max(...nums), range = max - min || 1;
  const W = 220, H = 40;
  const pts = nums.map((n, i) => `${(i / (nums.length - 1)) * W},${H - ((n - min) / range) * H}`).join(' ');
  return (
    <svg width={W} height={H} role="img" aria-label={`Trend ${nums.length} meraní, rozsah ${min}–${max}`} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke="#6ab0f5" strokeWidth={2} />
      {readings.slice(0, 24).reverse().map((r, i) => {
        const n = Number(r.value);
        if (Number.isNaN(n) || (r.flag !== 'high' && r.flag !== 'critical')) return null;
        return <circle key={r.id} cx={(i / (nums.length - 1)) * W} cy={H - ((n - min) / range) * H} r={3} fill={FLAG_COLOR[r.flag]} />;
      })}
    </svg>
  );
}

function PhysicianWearables() {
  const { token, role } = useAdminAuth();
  const params = useParams();
  const patientToken = String(params['patientToken'] ?? '');
  const [view, setView] = useState<PhysicianView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${apiUrl}/api/wearables/physician/${patientToken}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 403) { setErr('PHYSICIAN_ACCESS_DENIED'); return; }
    if (!res.ok) { setErr('LOAD_FAILED'); return; }
    setView(await res.json() as PhysicianView);
  }, [token, patientToken]);

  useEffect(() => { void load(); }, [load]);

  async function exportFhir(deviceId: string) {
    await fetch(`${apiUrl}/api/wearables/devices/${deviceId}/export-fhir`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    setToast('Export do HIS spustený');
    setTimeout(() => void load(), 1500);
  }

  if (err === 'PHYSICIAN_ACCESS_DENIED') {
    return <div style={{ padding: '2rem', color: '#f87171' }} role="alert">Prístup zamietnutý — k tomuto pacientovi nemáte aktívny vzťah.</div>;
  }
  if (!view) return <div style={{ padding: '2rem', color: '#aaa' }} role="status" aria-live="polite">Načítavam…</div>;

  // Latest reading per metric across all devices for the summary row.
  const latestByMetric = new Map<string, { reading: Reading; device: Device }>();
  for (const d of view.devices) for (const r of d.readings) {
    if (!latestByMetric.has(r.metricType)) latestByMetric.set(r.metricType, { reading: r, device: d });
  }

  return (
    <div style={{ padding: '1.5rem', color: '#e6e6e6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Nositeľné zariadenia — pacient {patientToken.slice(0, 8)}…</h1>
        <button onClick={() => setEditorOpen(true)} style={{ marginLeft: 'auto', display: 'inline-flex', gap: '.4rem', alignItems: 'center', background: '#1e5290', color: '#fff', border: 'none', borderRadius: 6, padding: '.5rem .9rem', cursor: 'pointer' }}>
          <SlidersHorizontal size={15} aria-hidden="true" /> Nastaviť prahy
        </button>
      </div>

      {toast && <div role="status" style={{ marginBottom: '1rem', color: '#4ade80' }}>{toast}</div>}

      {/* 1 — Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '.75rem', marginBottom: '2rem' }}>
        {[...latestByMetric.values()].map(({ reading, device }) => (
          <div key={reading.metricType} style={{ background: '#172033', borderRadius: 8, padding: '.9rem', borderTop: `4px solid ${FLAG_COLOR[reading.flag] ?? '#4ade80'}` }}>
            <div style={{ fontSize: '.78rem', color: '#9bb', marginBottom: '.3rem' }}>{reading.metricLabel['sk'] ?? reading.metricType}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{reading.value}{reading.unit ? ` ${reading.unit}` : ''}</div>
            <div style={{ fontSize: '.72rem', color: '#889' }}>{device.brand} · pred {timeAgo(reading.recordedAt)}</div>
            <span style={{ fontSize: '.7rem', color: FLAG_COLOR[reading.flag] }}>{reading.flag === 'normal' ? 'Normálne' : reading.flag === 'critical' ? 'Kritické' : reading.flag === 'high' ? 'Vysoké' : 'Nízke'}</span>
          </div>
        ))}
      </div>

      {/* 2 — Alert history (7 days) */}
      <h2 style={{ fontSize: '1.05rem' }}>Upozornenia (7 dní)</h2>
      {view.alerts.length === 0 ? (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', color: '#4ade80', marginBottom: '2rem' }}>
          <CheckCircle2 size={16} aria-hidden="true" /> Za posledných 7 dní žiadne upozornenia.
        </div>
      ) : (
        <div style={{ marginBottom: '2rem' }}>
          {view.alerts.map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: '.6rem', alignItems: 'center', padding: '.4rem 0', borderBottom: '1px solid #223' }}>
              <span style={{ width: 70, fontSize: '.74rem', color: '#889' }}>pred {timeAgo(a.createdAt)}</span>
              <AlertTriangle size={14} color={FLAG_COLOR[a.flag ?? 'high']} aria-hidden="true" />
              <span style={{ flex: 1, fontSize: '.85rem' }}>{a.metricType} = {a.value}</span>
              <span style={{ fontSize: '.72rem', color: FLAG_COLOR[a.flag ?? 'high'], textTransform: 'uppercase' }}>{a.severity}</span>
            </div>
          ))}
        </div>
      )}

      {/* 3 — Per-device panels */}
      {view.devices.map((d) => (
        <details key={d.id} style={{ background: '#172033', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <summary style={{ cursor: 'pointer', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <Activity size={16} aria-hidden="true" />
            <strong>{d.brand} {d.model}</strong>
            <span style={{ fontSize: '.74rem', color: d.status === 'error' ? '#f87171' : '#4ade80' }}>{d.status === 'error' ? 'Chyba' : 'Aktívne'}</span>
            <span style={{ marginLeft: 'auto', fontSize: '.72rem', color: '#889' }}>{d.lastSyncAt ? `sync pred ${timeAgo(d.lastSyncAt)}` : '—'}</span>
          </summary>
          <div style={{ marginTop: '.75rem' }}>
            <Sparkline readings={d.readings} />
            <table style={{ width: '100%', marginTop: '.75rem', fontSize: '.82rem', borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', color: '#9bb' }}><th>Čas</th><th>Metrika</th><th>Hodnota</th><th>Flag</th><th>FHIR</th></tr></thead>
              <tbody>
                {d.readings.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #223' }}>
                    <td>pred {timeAgo(r.recordedAt)}</td>
                    <td>{r.metricLabel['sk'] ?? r.metricType}</td>
                    <td>{r.value}{r.unit ? ` ${r.unit}` : ''}</td>
                    <td style={{ color: FLAG_COLOR[r.flag] }}>{r.flag}</td>
                    <td>{r.inHis ? <span style={{ color: '#6ab0f5' }}>V HIS</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => void exportFhir(d.id)} style={{ marginTop: '.6rem', display: 'inline-flex', gap: '.4rem', alignItems: 'center', background: 'transparent', color: '#6ab0f5', border: '1px solid #1e5290', borderRadius: 6, padding: '.4rem .8rem', cursor: 'pointer' }}>
              <Download size={14} aria-hidden="true" /> Export do HIS
            </button>
          </div>
        </details>
      ))}

      {editorOpen && (
        <ThresholdEditor
          patientToken={patientToken}
          token={token ?? ''}
          canEdit={role === 'CLINICIAN' || role === 'ADMIN'}
          onClose={() => setEditorOpen(false)}
          onSaved={() => { setToast('Prahy uložené'); setEditorOpen(false); }}
        />
      )}
    </div>
  );
}

function ThresholdEditor({ patientToken, token, canEdit, onClose, onSaved }: { patientToken: string; token: string; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const [vals, setVals] = useState<Record<string, { high: string; low: string; criticalHigh: string; criticalLow: string }>>(
    Object.fromEntries(METRICS.map((m) => [m.code, { high: '', low: '', criticalHigh: '', criticalLow: '' }])),
  );

  async function save(code: string) {
    const v = vals[code]!;
    await fetch(`${apiUrl}/api/wearables/physician/${patientToken}/thresholds`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        metricType: code,
        high: v.high ? Number(v.high) : null,
        low: v.low ? Number(v.low) : null,
        criticalHigh: v.criticalHigh ? Number(v.criticalHigh) : null,
        criticalLow: v.criticalLow ? Number(v.criticalLow) : null,
      }),
    });
    onSaved();
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Editor prahov" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, background: '#0f1626', boxShadow: '-4px 0 20px rgba(0,0,0,.4)', padding: '1.5rem', overflowY: 'auto', zIndex: 1000, color: '#e6e6e6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <strong>Prahy upozornení</strong>
        <button onClick={onClose} aria-label="Zavrieť" style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>✕</button>
      </div>
      {!canEdit && <p style={{ color: '#f5c842', fontSize: '.82rem' }}>Iba lekár (klinik) môže meniť prahy.</p>}
      {METRICS.map((m) => (
        <fieldset key={m.code} disabled={!canEdit} style={{ border: '1px solid #223', borderRadius: 8, padding: '.75rem', marginBottom: '.75rem' }}>
          <legend style={{ fontSize: '.84rem' }}>{m.label} (LOINC {m.code}) {m.unit}</legend>
          {(['high', 'low', 'criticalHigh', 'criticalLow'] as const).map((k) => (
            <label key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.8rem', marginTop: '.3rem' }}>
              {k}
              <input type="number" step="0.1" value={vals[m.code]![k]}
                onChange={(e) => setVals((s) => ({ ...s, [m.code]: { ...s[m.code]!, [k]: e.target.value } }))}
                style={{ width: 80, background: '#172033', border: '1px solid #223', color: '#fff', borderRadius: 4, padding: '.2rem .4rem' }} />
            </label>
          ))}
          {canEdit && <button onClick={() => void save(m.code)} style={{ marginTop: '.5rem', background: '#1e5290', color: '#fff', border: 'none', borderRadius: 6, padding: '.35rem .8rem', cursor: 'pointer', fontSize: '.8rem' }}>Uložiť {m.label}</button>}
        </fieldset>
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <PhysicianWearables />
      </AdminShell>
    </AdminAuthProvider>
  );
}
