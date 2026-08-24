'use client';

/**
 * Wearables administration (Sprint A4 Part C UI) — wired to
 * /api/admin/wearables/platforms (super_admin) and
 * /api/admin/wearables/monitoring (administrator|super_admin).
 *
 * Credential fields are write-only by design: the API never returns secrets, so
 * this UI shows only `credentialsConfigured` and links to the env var that
 * supplies them. Partnership-gated and EU-blocked platforms cannot be enabled —
 * the server returns 422 partnership_required / eu_adequacy_blocked and the
 * toggle is disabled here to match.
 *
 * Threshold resolution is physician (per-patient) → global default (here) →
 * hardcoded DEFAULT_THRESHOLDS. That order is shown in the UI so an admin
 * understands a global edit does not override a clinician's per-patient value.
 */
import { useCallback, useEffect, useState } from 'react';
import { Watch, RefreshCw, Download, Activity, Plug, ShieldAlert } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { showToast } from '@/components/admin/AdminToast';
import { useAdminApi, qs, AdminApiError } from '@/components/admin/admin-api';
import { Badge, Card, StatTile, Tabs, TabPanel, btn, cell, th, field, MUTED, type Tone } from '@/components/admin/admin-ui';

interface PlatformStatus {
  id: string; name: string; category: 'medical' | 'consumer';
  partnershipRequired: boolean; manualUploadOnly: boolean; iosAppRequired: boolean;
  euBlocked: boolean; enabled: boolean; credentialsConfigured: boolean;
  connectedDeviceCount: number; lastSyncAt: string | null; connectionTestUrl: string | null;
}
interface TestResult { ok: boolean; latencyMs: number; httpStatus?: number; error?: string }
interface MonitoringSummary {
  totalConnected: number;
  byPlatform: Record<string, { connected: number; syncErrors: number }>;
  consentExpiringSoon: number; consentGracePending: number; pendingAlerts: number;
}
interface AlertRow {
  id: string; severity: string; metricType: string | null; platformId: string | null;
  patientTokenPreview: string; thresholdValue: number | null; readingValue: string | null;
  ts: string; acknowledged: boolean;
}
interface GlobalThreshold {
  metricType: string; key: string; label: string; unit: string;
  criticalLow: number | null; highLow: number | null; highHigh: number | null; criticalHigh: number | null;
}

type TabId = 'platforms' | 'monitoring' | 'thresholds';

const SEVERITY_TONE: Record<string, Tone> = { critical: 'crit', high: 'warn', normal: 'ok', info: 'info' };

const GATE_REASON: Record<string, string> = {
  eu_adequacy_blocked: 'Blokované — EÚ primeranosť (GDPR kap. V)',
  partnership_required: 'Vyžaduje podpísanú zmluvu s výrobcom',
};

function PlatformsTab() {
  const api = useAdminApi();
  const [rows, setRows] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.get<PlatformStatus[]>('/api/admin/wearables/platforms'));
    } catch (e) {
      showToast(`Načítanie platforiem zlyhalo: ${(e as Error).message}`, 'error');
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (p: PlatformStatus) => {
    try {
      await api.put(`/api/admin/wearables/platforms/${p.id}/enabled`, { enabled: !p.enabled });
      showToast(`${p.name}: ${!p.enabled ? 'zapnuté' : 'vypnuté'}`, 'success');
      void load();
    } catch (e) {
      const err = e as AdminApiError;
      showToast(GATE_REASON[err.code ?? ''] ?? `Zmena zlyhala: ${err.message}`, 'error');
    }
  };

  const test = async (p: PlatformStatus) => {
    setTesting(p.id);
    try {
      const r = await api.post<TestResult>(`/api/admin/wearables/platforms/${p.id}/test`);
      setTests((t) => ({ ...t, [p.id]: r }));
    } catch (e) {
      setTests((t) => ({ ...t, [p.id]: { ok: false, latencyMs: 0, error: (e as Error).message } }));
    } finally { setTesting(null); }
  };

  if (loading) return <p style={{ color: MUTED }}>Načítavam…</p>;

  const groups: Array<['medical' | 'consumer', string]> = [['medical', 'Zdravotnícke platformy'], ['consumer', 'Spotrebiteľské platformy']];

  return (
    <>
      <p style={{ color: MUTED, fontSize: '.83rem', marginTop: 0 }}>
        Prihlasovacie údaje sa zadávajú výhradne cez premenné prostredia na serveri — API ich nikdy nevracia.
        Tu vidno len, či sú nastavené.
      </p>
      {groups.map(([cat, label]) => (
        <Card key={cat} title={label}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={th} scope="col">Platforma</th>
                  <th style={th} scope="col">Stav</th>
                  <th style={th} scope="col">Údaje</th>
                  <th style={th} scope="col">Zariadenia</th>
                  <th style={th} scope="col">Posledná synch.</th>
                  <th style={th} scope="col">Test</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter((r) => r.category === cat).map((p) => {
                  const blocked = p.euBlocked || p.partnershipRequired;
                  const t = tests[p.id];
                  return (
                    <tr key={p.id}>
                      <td style={cell}>
                        <strong>{p.name}</strong>
                        <div style={{ display: 'flex', gap: '.3rem', marginTop: '.25rem', flexWrap: 'wrap' }}>
                          {p.euBlocked && <Badge tone="crit">EÚ blok</Badge>}
                          {p.partnershipRequired && <Badge tone="warn">Zmluva</Badge>}
                          {p.manualUploadOnly && <Badge tone="info">Manuálny upload</Badge>}
                          {p.iosAppRequired && <Badge tone="neutral">iOS app</Badge>}
                        </div>
                      </td>
                      <td style={cell}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '.45rem', cursor: blocked ? 'not-allowed' : 'pointer' }}>
                          <input type="checkbox" checked={p.enabled} disabled={blocked}
                            onChange={() => void toggle(p)}
                            aria-label={`Povoliť platformu ${p.name}`} />
                          <Badge tone={p.enabled ? 'ok' : 'neutral'}>{p.enabled ? 'Zapnuté' : 'Vypnuté'}</Badge>
                        </label>
                        {blocked && (
                          <div style={{ color: '#fcd34d', fontSize: '.72rem', marginTop: '.3rem', display: 'flex', gap: '.25rem', alignItems: 'center' }}>
                            <ShieldAlert size={12} aria-hidden />
                            {p.euBlocked ? GATE_REASON['eu_adequacy_blocked'] : GATE_REASON['partnership_required']}
                          </div>
                        )}
                      </td>
                      <td style={cell}>
                        <Badge tone={p.credentialsConfigured ? 'ok' : 'neutral'}>
                          {p.credentialsConfigured ? 'Nastavené' : 'Chýbajú'}
                        </Badge>
                      </td>
                      <td style={cell}>{p.connectedDeviceCount}</td>
                      <td style={{ ...cell, color: MUTED, fontSize: '.8rem' }}>
                        {p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleString('sk-SK') : '—'}
                      </td>
                      <td style={cell}>
                        <button onClick={() => void test(p)} disabled={!p.connectionTestUrl || testing === p.id}
                          style={{ ...btn('ghost'), opacity: !p.connectionTestUrl ? 0.4 : 1 }}
                          aria-label={`Otestovať spojenie — ${p.name}`}>
                          <Plug size={14} aria-hidden /> {testing === p.id ? '…' : 'Test'}
                        </button>
                        {t && (
                          <div style={{ marginTop: '.3rem', fontSize: '.75rem' }}>
                            <Badge tone={t.ok ? 'ok' : 'crit'}>{t.ok ? `OK ${t.latencyMs}ms` : (t.error ?? `HTTP ${t.httpStatus}`)}</Badge>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </>
  );
}

function MonitoringTab() {
  const api = useAdminApi();
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState('');
  const [platformId, setPlatformId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    const query = qs({ severity, platformId, from, to, page, limit: LIMIT });
    try {
      const [s, a] = await Promise.all([
        api.get<MonitoringSummary>('/api/admin/wearables/monitoring/summary'),
        api.get<{ items: AlertRow[]; total: number } | AlertRow[]>(`/api/admin/wearables/monitoring/alerts${query}`),
      ]);
      setSummary(s);
      // Tolerate both a bare array and a paginated envelope.
      if (Array.isArray(a)) { setAlerts(a); setTotal(a.length); }
      else { setAlerts(a.items ?? []); setTotal(a.total ?? 0); }
    } catch (e) {
      showToast(`Načítanie monitoringu zlyhalo: ${(e as Error).message}`, 'error');
    } finally { setLoading(false); }
  }, [api, severity, platformId, from, to, page]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = async () => {
    try {
      await api.download(
        `/api/admin/wearables/monitoring/alerts/export${qs({ severity, platformId, from, to })}`,
        'wearable-alerts.csv',
      );
      showToast('CSV export stiahnutý (akcia je auditovaná).', 'success');
    } catch (e) {
      showToast(`Export zlyhal: ${(e as Error).message}`, 'error');
    }
  };

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <>
      {summary && (
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <StatTile label="Pripojené zariadenia" value={summary.totalConnected} tone="info" />
          <StatTile label="Čakajúce alerty" value={summary.pendingAlerts} tone={summary.pendingAlerts > 0 ? 'crit' : 'ok'} />
          <StatTile label="Súhlas končí čoskoro" value={summary.consentExpiringSoon} tone={summary.consentExpiringSoon > 0 ? 'warn' : 'neutral'} />
          <StatTile label="Odkladná lehota súhlasu" value={summary.consentGracePending} tone={summary.consentGracePending > 0 ? 'warn' : 'neutral'} />
        </div>
      )}

      {summary && Object.keys(summary.byPlatform).length > 0 && (
        <Card title="Podľa platformy">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th} scope="col">Platforma</th><th style={th} scope="col">Pripojené</th><th style={th} scope="col">Chyby synch.</th></tr></thead>
              <tbody>
                {Object.entries(summary.byPlatform).map(([id, v]) => (
                  <tr key={id}>
                    <td style={cell}>{id}</td>
                    <td style={cell}>{v.connected}</td>
                    <td style={cell}>{v.syncErrors > 0 ? <Badge tone="crit">{v.syncErrors}</Badge> : <span style={{ color: MUTED }}>0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card
        title="Záznam alertov"
        actions={
          <button onClick={() => void exportCsv()} style={btn('ghost')} aria-label="Exportovať alerty do CSV">
            <Download size={14} aria-hidden /> CSV
          </button>
        }
      >
        <div style={{ display: 'flex', gap: '.6rem', marginBottom: '.9rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ fontSize: '.8rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
            Závažnosť
            <select value={severity} onChange={(e) => { setPage(1); setSeverity(e.target.value); }} style={field}>
              <option value="">Všetky</option>
              <option value="critical">Kritická</option>
              <option value="high">Vysoká</option>
              <option value="normal">Normálna</option>
            </select>
          </label>
          <label style={{ fontSize: '.8rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
            Platforma
            <input value={platformId} onChange={(e) => { setPage(1); setPlatformId(e.target.value); }} placeholder="napr. fitbit" style={field} />
          </label>
          <label style={{ fontSize: '.8rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
            Od
            <input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} style={field} />
          </label>
          <label style={{ fontSize: '.8rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
            Do
            <input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} style={field} />
          </label>
          <button onClick={() => void load()} style={btn('ghost')} aria-label="Obnoviť alerty"><RefreshCw size={16} aria-hidden /></button>
        </div>

        {loading ? <p style={{ color: MUTED }}>Načítavam…</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={th} scope="col">Čas</th>
                  <th style={th} scope="col">Závažnosť</th>
                  <th style={th} scope="col">Metrika</th>
                  <th style={th} scope="col">Hodnota</th>
                  <th style={th} scope="col">Prah</th>
                  <th style={th} scope="col">Platforma</th>
                  <th style={th} scope="col">Pacient</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{new Date(a.ts).toLocaleString('sk-SK')}</td>
                    <td style={cell}><Badge tone={SEVERITY_TONE[a.severity] ?? 'neutral'}>{a.severity}</Badge></td>
                    <td style={cell}>{a.metricType ?? '—'}</td>
                    <td style={cell}>{a.readingValue ?? '—'}</td>
                    <td style={cell}>{a.thresholdValue ?? '—'}</td>
                    <td style={cell}>{a.platformId ?? '—'}</td>
                    <td style={{ ...cell, fontFamily: 'ui-monospace, monospace', fontSize: '.78rem' }}>{a.patientTokenPreview}</td>
                  </tr>
                ))}
                {alerts.length === 0 && <tr><td style={{ ...cell, color: MUTED }} colSpan={7}>Žiadne alerty.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {total > LIMIT && (
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', alignItems: 'center' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={btn('ghost')}>← Predošlá</button>
            <span style={{ color: MUTED, fontSize: '.85rem' }}>{page} / {pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} style={btn('ghost')}>Ďalšia →</button>
          </div>
        )}
      </Card>
    </>
  );
}

function ThresholdsTab() {
  const api = useAdminApi();
  const [rows, setRows] = useState<GlobalThreshold[]>([]);
  const [draft, setDraft] = useState<Record<string, Partial<GlobalThreshold>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<GlobalThreshold[]>('/api/admin/wearables/monitoring/thresholds/defaults');
      setRows(data);
      setDraft({});
    } catch (e) {
      showToast(`Načítanie prahov zlyhalo: ${(e as Error).message}`, 'error');
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const save = async (r: GlobalThreshold) => {
    setSaving(r.metricType);
    const d = draft[r.metricType] ?? {};
    try {
      await api.put(`/api/admin/wearables/monitoring/thresholds/defaults/${encodeURIComponent(r.metricType)}`, {
        criticalLow: d.criticalLow ?? r.criticalLow,
        highLow: d.highLow ?? r.highLow,
        highHigh: d.highHigh ?? r.highHigh,
        criticalHigh: d.criticalHigh ?? r.criticalHigh,
      });
      showToast(`Prahy pre ${r.label} uložené.`, 'success');
      void load();
    } catch (e) {
      showToast(`Uloženie zlyhalo: ${(e as Error).message}`, 'error');
    } finally { setSaving(null); }
  };

  const setVal = (metric: string, k: keyof GlobalThreshold, v: string) =>
    setDraft((d) => ({ ...d, [metric]: { ...d[metric], [k]: v === '' ? null : Number(v) } }));

  const numCell = (r: GlobalThreshold, k: 'criticalLow' | 'highLow' | 'highHigh' | 'criticalHigh') => {
    const cur = draft[r.metricType]?.[k];
    const val = cur === undefined ? r[k] : cur;
    return (
      <td style={cell}>
        <input
          type="number"
          value={val ?? ''}
          onChange={(e) => setVal(r.metricType, k, e.target.value)}
          aria-label={`${r.label} — ${k}`}
          style={{ ...field, width: 90 }}
        />
      </td>
    );
  };

  if (loading) return <p style={{ color: MUTED }}>Načítavam…</p>;

  return (
    <Card title="Globálne predvolené prahy">
      <p style={{ color: MUTED, fontSize: '.83rem', marginTop: 0 }}>
        Poradie vyhodnotenia: <strong style={{ color: '#93c5fd' }}>lekár (per pacient)</strong> → <strong>globálne (tu)</strong> → zabudované predvolené.
        Zmena tu neprepíše prah, ktorý lekár nastavil konkrétnemu pacientovi.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr>
              <th style={th} scope="col">Metrika</th>
              <th style={th} scope="col">LOINC</th>
              <th style={th} scope="col">Krit. min</th>
              <th style={th} scope="col">Vys. min</th>
              <th style={th} scope="col">Vys. max</th>
              <th style={th} scope="col">Krit. max</th>
              <th style={th} scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.metricType}>
                <td style={cell}>{r.label} <span style={{ color: MUTED }}>({r.unit})</span></td>
                <td style={{ ...cell, fontFamily: 'ui-monospace, monospace', fontSize: '.76rem', color: MUTED }}>{r.metricType}</td>
                {numCell(r, 'criticalLow')}
                {numCell(r, 'highLow')}
                {numCell(r, 'highHigh')}
                {numCell(r, 'criticalHigh')}
                <td style={cell}>
                  <button onClick={() => void save(r)} disabled={!draft[r.metricType] || saving === r.metricType}
                    style={{ ...btn('primary'), opacity: !draft[r.metricType] ? 0.4 : 1 }}>
                    {saving === r.metricType ? 'Ukladám…' : 'Uložiť'}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td style={{ ...cell, color: MUTED }} colSpan={7}>Žiadne prahy.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function WearablesAdminInner() {
  const { role } = useAdminAuth();
  const isSuper = role === 'super_admin';
  const [tab, setTab] = useState<TabId>(isSuper ? 'platforms' : 'monitoring');

  const tabs = [
    ...(isSuper ? [{ id: 'platforms' as const, label: 'Platformy' }] : []),
    { id: 'monitoring' as const, label: 'Monitoring' },
    { id: 'thresholds' as const, label: 'Prahy' },
  ];

  return (
    <div style={{ color: '#e2e8f0' }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '1.4rem', marginBottom: '.6rem' }}>
        <Watch size={22} aria-hidden /> Nositeľné zariadenia
      </h1>
      <p style={{ color: MUTED, fontSize: '.83rem', marginTop: 0, marginBottom: '1rem', display: 'flex', gap: '.35rem', alignItems: 'center' }}>
        <Activity size={14} aria-hidden />
        Modul je aktívny až po splnení compliance brány L9 (<code>WEARABLES_ENABLED</code>).
      </p>

      <Tabs tabs={tabs} active={tab} onChange={setTab} label="Sekcie modulu nositeľných zariadení" />

      {isSuper && <TabPanel id="platforms" active={tab}><PlatformsTab /></TabPanel>}
      <TabPanel id="monitoring" active={tab}><MonitoringTab /></TabPanel>
      <TabPanel id="thresholds" active={tab}><ThresholdsTab /></TabPanel>
    </div>
  );
}

export default function WearablesAdminPage() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <WearablesAdminInner />
      </AdminShell>
    </AdminAuthProvider>
  );
}
