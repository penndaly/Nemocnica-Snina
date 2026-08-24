'use client';

/**
 * Integration & infra health dashboard (Sprint: Phase 2).
 *
 * Reads the single /api/admin/health aggregator — the UI never fans out to N
 * service endpoints itself. Auto-refreshes on an interval that the operator can
 * pause, because an always-polling page is a nuisance on a wall display.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, RefreshCw, Database, Server, Radio, Clock, Pause, Play } from 'lucide-react';
import { AdminAuthProvider } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { showToast } from '@/components/admin/AdminToast';
import { useAdminApi } from '@/components/admin/admin-api';
import { Badge, Card, ScrollArea, btn, cell, th, MUTED, LINE, type Tone } from '@/components/admin/admin-ui';

type HealthState = 'ok' | 'degraded' | 'down' | 'unknown';
type RunMode = 'mock' | 'live' | 'disabled';

interface IntegrationStatus {
  id: string; name: string; group: string; state: HealthState; mode: RunMode;
  credentialsConfigured: boolean; lastSuccessAt: string | null; errorsLastHour: number; detail?: string;
}
interface InfraStatus {
  id: string; name: string; state: HealthState; latencyMs: number | null;
  detail?: string; metrics?: Record<string, number | string>;
}
interface CronStatus {
  job: string; state: HealthState; expectedEveryMs: number; lastRunAt?: string;
  lastOutcome?: 'ok' | 'error'; lastError?: string; durationMs?: number; runs?: number; errors?: number; detail?: string;
}
interface HealthReport {
  generatedAt: string; overall: HealthState;
  integrations: IntegrationStatus[]; infra: InfraStatus[]; crons: CronStatus[];
}

const STATE_TONE: Record<HealthState, Tone> = { ok: 'ok', degraded: 'warn', down: 'crit', unknown: 'neutral' };
const STATE_LABEL: Record<HealthState, string> = { ok: 'V poriadku', degraded: 'Obmedzené', down: 'Nedostupné', unknown: 'Neznáme' };
const MODE_LABEL: Record<RunMode, string> = { mock: 'Mock', live: 'Ostrá', disabled: 'Vypnuté' };
const CRON_LABEL: Record<string, string> = {
  'telehealth.no-show': 'Telemedicína — nedostavenie',
  'booking.reminders': 'Pripomienky objednaní',
  'wearables.sync': 'Nositeľné — flush digestov',
  'wearables.retention-purge': 'Nositeľné — retenčná čistka',
  'wearables.consent-grace': 'Nositeľné — odklad súhlasu',
};

const ago = (iso: string | null | undefined): string => {
  if (!iso) return 'nikdy';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `pred ${s} s`;
  if (s < 3600) return `pred ${Math.round(s / 60)} min`;
  if (s < 86400) return `pred ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleString('sk-SK');
};

const everyLabel = (ms: number): string =>
  ms >= 86_400_000 ? `každých ${ms / 86_400_000} dní` : ms >= 3_600_000 ? `každú ${ms / 3_600_000} h` : `každých ${ms / 60_000} min`;

function HealthInner() {
  const api = useAdminApi();
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setReport(await api.get<HealthReport>('/api/admin/health'));
    } catch (e) {
      showToast(`Načítanie stavu zlyhalo: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!auto) return;
    timer.current = setInterval(() => void load(true), 30_000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [auto, load]);

  const groups: Array<[string, string]> = [
    ['identity', 'Identita'], ['clinical', 'Klinické systémy'], ['messaging', 'Notifikácie'],
    ['payments', 'Platby'], ['content', 'Obsah'], ['video', 'Video'], ['wearables', 'Nositeľné zariadenia'],
  ];

  return (
    <div style={{ color: '#e2e8f0' }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '1.4rem', marginBottom: '.4rem' }}>
        <Activity size={22} aria-hidden /> Stav integrácií a infraštruktúry
      </h1>

      <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        {report && (
          <>
            <Badge tone={STATE_TONE[report.overall]}>Celkovo: {STATE_LABEL[report.overall]}</Badge>
            <span style={{ color: MUTED, fontSize: '.8rem' }}>
              aktualizované {ago(report.generatedAt)}
            </span>
          </>
        )}
        <button onClick={() => void load()} style={btn('ghost')} aria-label="Obnoviť teraz">
          <RefreshCw size={15} aria-hidden /> Obnoviť
        </button>
        <button onClick={() => setAuto((a) => !a)} style={btn('ghost')}
          aria-pressed={auto} aria-label={auto ? 'Vypnúť automatické obnovovanie' : 'Zapnúť automatické obnovovanie'}>
          {auto ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
          {auto ? 'Auto 30 s' : 'Auto vypnuté'}
        </button>
      </div>

      {loading && !report ? <p style={{ color: MUTED }}>Načítavam…</p> : report && (
        <>
          <h2 style={{ fontSize: '1rem', margin: '0 0 .6rem' }}>Integrácie</h2>
          {groups.map(([g, label]) => {
            const items = report.integrations.filter((i) => i.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g} style={{ marginBottom: '.8rem' }}>
                <p style={{ color: MUTED, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 .35rem' }}>{label}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '.6rem' }}>
                  {items.map((i) => (
                    <div key={i.id} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: '.75rem .85rem', background: 'rgba(255,255,255,.03)' }}>
                      <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', marginBottom: '.4rem' }}>
                        <strong style={{ fontSize: '.88rem', flex: 1 }}>{i.name}</strong>
                        <Badge tone={STATE_TONE[i.state]}>{STATE_LABEL[i.state]}</Badge>
                      </div>
                      <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap', marginBottom: '.4rem' }}>
                        <Badge tone={i.mode === 'live' ? 'info' : 'neutral'}>{MODE_LABEL[i.mode]}</Badge>
                        <Badge tone={i.credentialsConfigured ? 'ok' : 'neutral'}>
                          {i.credentialsConfigured ? 'Údaje OK' : 'Bez údajov'}
                        </Badge>
                        {i.errorsLastHour > 0 && <Badge tone="crit">{i.errorsLastHour} chýb/h</Badge>}
                      </div>
                      <div style={{ color: MUTED, fontSize: '.76rem' }}>
                        Posledné úspešné volanie: {ago(i.lastSuccessAt)}
                      </div>
                      {i.detail && <div style={{ color: MUTED, fontSize: '.74rem', marginTop: '.3rem' }}>{i.detail}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <h2 style={{ fontSize: '1rem', margin: '1.4rem 0 .6rem', display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <Server size={17} aria-hidden /> Infraštruktúra
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '.6rem', marginBottom: '1rem' }}>
            {report.infra.map((s) => (
              <div key={s.id} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: '.75rem .85rem', background: 'rgba(255,255,255,.03)' }}>
                <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', marginBottom: '.4rem' }}>
                  {s.id === 'postgres' ? <Database size={15} aria-hidden /> : s.id === 'rabbitmq' ? <Radio size={15} aria-hidden /> : <Server size={15} aria-hidden />}
                  <strong style={{ fontSize: '.88rem', flex: 1 }}>{s.name}</strong>
                  <Badge tone={STATE_TONE[s.state]}>{STATE_LABEL[s.state]}</Badge>
                </div>
                <div style={{ color: MUTED, fontSize: '.76rem' }}>
                  Odozva: {s.latencyMs === null ? '—' : `${s.latencyMs} ms`}
                </div>
                {s.metrics && Object.entries(s.metrics).length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '.4rem 0 0', color: MUTED, fontSize: '.74rem' }}>
                    {Object.entries(s.metrics).map(([k, v]) => (
                      <li key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
                        <span style={{ fontFamily: 'ui-monospace, monospace' }}>{k}</span>
                        <span style={{ color: typeof v === 'number' && v > 0 && k.includes('dlq') ? '#fca5a5' : undefined }}>
                          {v === -1 ? 'neexistuje' : v}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {s.detail && <div style={{ color: '#fcd34d', fontSize: '.74rem', marginTop: '.35rem' }}>{s.detail}</div>}
              </div>
            ))}
          </div>

          <Card title="Plánované úlohy (cron)">
            <p style={{ color: MUTED, fontSize: '.78rem', marginTop: 0, display: 'flex', gap: '.35rem', alignItems: 'center' }}>
              <Clock size={13} aria-hidden />
              Časy sa evidujú v pamäti procesu — po reštarte API sa počítajú odznova.
            </p>
            <ScrollArea label="Tabuľka plánovaných úloh">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                <thead>
                  <tr>
                    <th style={th} scope="col">Úloha</th>
                    <th style={th} scope="col">Stav</th>
                    <th style={th} scope="col">Posledný beh</th>
                    <th style={th} scope="col">Interval</th>
                    <th style={th} scope="col">Behy / chyby</th>
                  </tr>
                </thead>
                <tbody>
                  {report.crons.map((c) => (
                    <tr key={c.job}>
                      <td style={cell}>
                        {CRON_LABEL[c.job] ?? c.job}
                        <div style={{ color: MUTED, fontSize: '.72rem', fontFamily: 'ui-monospace, monospace' }}>{c.job}</div>
                      </td>
                      <td style={cell}><Badge tone={STATE_TONE[c.state]}>{STATE_LABEL[c.state]}</Badge></td>
                      <td style={cell}>
                        {ago(c.lastRunAt)}
                        {c.lastError && <div style={{ color: '#fca5a5', fontSize: '.73rem' }}>{c.lastError}</div>}
                        {c.detail && !c.lastError && <div style={{ color: MUTED, fontSize: '.73rem' }}>{c.detail}</div>}
                      </td>
                      <td style={{ ...cell, color: MUTED }}>{everyLabel(c.expectedEveryMs)}</td>
                      <td style={cell}>
                        {c.runs ?? 0} / {c.errors ? <span style={{ color: '#fca5a5' }}>{c.errors}</span> : 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </Card>
        </>
      )}
    </div>
  );
}

export default function HealthPage() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <HealthInner />
      </AdminShell>
    </AdminAuthProvider>
  );
}
