'use client';

/**
 * Portal Wearables tab (Sprint W4) — connected devices, unified readings
 * timeline, connect-a-device panel, and the GDPR consent notice. Wired to the
 * live API via wearables-api (mock provider in dev/CI). No medical data ever
 * touches localStorage — React state + API responses only.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, Watch, HeartPulse, ChevronDown, RefreshCw, ShieldCheck, Upload, X, Bell,
} from 'lucide-react';
import {
  getWearables, connectDevice, syncDevice, getSyncJob, updateConsent, uploadDeviceData,
  getNotifications, markNotificationsRead,
  type WearablesResponse, type WearableDevice, type WearableReading, type AvailablePlatform,
  type WearableNotification,
} from '@/lib/wearables-api';

type Locale = string;

const L = (locale: Locale) => {
  const sk = locale === 'sk';
  return {
    title:            sk ? 'Nositeľné zariadenia' : 'Wearables & Devices',
    optional:         sk ? 'Voliteľné' : 'Optional',
    connected:        sk ? 'Pripojené zariadenia' : 'Connected devices',
    noDevices:        sk ? 'Žiadne pripojené zariadenia.' : 'No connected devices yet.',
    shareWithPhysician: sk ? 'Zdieľať s lekárom' : 'Share with physician',
    recentReadings:   sk ? 'Posledné merania' : 'Recent readings',
    loadMore:         sk ? 'Načítať ďalšie' : 'Load more',
    syncNow:          sk ? 'Synchronizovať' : 'Sync now',
    syncing:          sk ? 'Synchronizujem…' : 'Syncing…',
    syncedAgo:        sk ? 'synchronizované' : 'synced',
    inHis:            sk ? 'V zdravotnom zázname' : 'In health record',
    active:           sk ? 'Aktívne' : 'Active',
    errorBadge:       sk ? 'Chyba synchronizácie' : 'Sync error',
    medical:          sk ? 'Medicínske' : 'Medical',
    medicalTab:       sk ? 'Medicínske' : 'Medical',
    fitnessTab:       sk ? 'Fitness & Wellness' : 'Fitness & Wellness',
    connectDevice:    sk ? 'Pripojiť zariadenie' : 'Connect a device',
    agreementRequired: sk ? 'Vyžaduje sa dohoda' : 'Agreement required',
    uploadData:       sk ? 'Nahrať údaje' : 'Upload data',
    iosRequired:      sk ? 'Vyžaduje iOS aplikáciu' : 'iOS app required',
    manageConsent:    sk ? 'Správa súhlasov' : 'Manage consent',
    gdprNotice:       sk
      ? 'Integrácia nositeľných zariadení je úplne dobrovoľná. Údaje sa zdieľajú výhradne s vaším ošetrujúcim lekárom. Súhlas môžete kedykoľvek odvolať.'
      : 'Wearable integration is fully optional. Data is shared exclusively with your treating physician. Withdraw consent at any time.',
    contactToConnect: sk
      ? 'Pripojenie tohto zariadenia vyžaduje podpísanú dohodu s výrobcom. Kontaktujte nás pre viac informácií.'
      : 'Connecting this device requires a signed manufacturer agreement. Contact us for details.',
    iosNotice:        sk
      ? 'Apple Health vyžaduje natívnu iOS aplikáciu, ktorá ešte nebola publikovaná.'
      : 'Apple Health requires a native iOS companion app that has not been published yet.',
    uploadNotice:     sk
      ? 'Toto zariadenie nemá živé API. Nahrajte exportovaný súbor s údajmi.'
      : 'This device has no live API. Upload an exported data file.',
    close:            sk ? 'Zavrieť' : 'Close',
    cancel:           sk ? 'Zrušiť' : 'Cancel',
    upload:           sk ? 'Nahrať' : 'Upload',
    consentUpdated:   sk ? 'Súhlas bol aktualizovaný' : 'Consent updated',
  };
};

function timeAgo(iso: string, locale: Locale): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const sk = locale === 'sk';
  if (diffMin < 1) return sk ? 'práve teraz' : 'just now';
  if (diffMin < 60) return sk ? `pred ${diffMin} min` : `${diffMin} min ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return sk ? `pred ${h} h` : `${h}h ago`;
  const d = Math.round(h / 24);
  return sk ? `pred ${d} d` : `${d}d ago`;
}

const FLAG_COLOR: Record<string, string> = {
  normal: 'var(--green)', high: 'var(--amber)', low: 'var(--amber)', critical: 'var(--red)', info: 'var(--blue-500)',
};
function flagText(flag: string, locale: Locale): string {
  const sk = locale === 'sk';
  switch (flag) {
    case 'critical': return sk ? 'Kritické' : 'Critical';
    case 'high':     return sk ? 'Vysoké' : 'High';
    case 'low':      return sk ? 'Nízke' : 'Low';
    default:         return sk ? 'Normálne' : 'Normal';
  }
}

function deviceIcon(type: string) {
  if (type === 'smartwatch' || type === 'fitness' || type === 'hybrid') return <Watch size={18} aria-hidden="true" />;
  if (type === 'cgm' || type === 'bp') return <Activity size={18} aria-hidden="true" />;
  return <HeartPulse size={18} aria-hidden="true" />;
}

interface Props { locale: Locale }

export function WearablesTab({ locale }: Props) {
  const t = L(locale);
  const [data, setData] = useState<WearablesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [timelineCount, setTimelineCount] = useState(20);
  const [panelOpen, setPanelOpen] = useState(false);
  const [availTab, setAvailTab] = useState<'medical' | 'consumer'>('medical');
  const [modal, setModal] = useState<{ kind: 'partnership' | 'ios' | 'upload'; platform: AvailablePlatform } | null>(null);
  const [liveMsg, setLiveMsg] = useState('');
  const [notifs, setNotifs] = useState<WearableNotification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getWearables();
      setData(res);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNotifs = useCallback(async () => {
    try { setNotifs(await getNotifications()); } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { void load(); void loadNotifs(); }, [load, loadNotifs]);
  // Lightweight poll for last_sync_at updates (no SWR dependency in this repo).
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const devices = data?.devices ?? [];
  const available = data?.available ?? [];

  // Unified, DESC readings timeline across all devices.
  const allReadings: Array<WearableReading & { deviceBrand: string }> = devices
    .flatMap((d) => d.readings.map((r) => ({ ...r, deviceBrand: d.brand })))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  async function onToggleShare(device: WearableDevice, next: boolean) {
    // Optimistic update.
    setData((prev) => prev && {
      ...prev,
      devices: prev.devices.map((d) => d.id === device.id ? { ...d, shareWithPhysician: next } : d),
    });
    try {
      await updateConsent(device.id, { type: 'physician_sharing', granted: next });
      setLiveMsg(t.consentUpdated);
    } catch {
      void load(); // revert from server on failure
    }
  }

  function onConnectClick(p: AvailablePlatform) {
    if (p.partnershipRequired) { setModal({ kind: 'partnership', platform: p }); return; }
    if (p.iosAppRequired) { setModal({ kind: 'ios', platform: p }); return; }
    if (p.manualUploadOnly) { setModal({ kind: 'upload', platform: p }); return; }
    void connectDevice(p.platform).then(({ authUrl }) => { window.location.href = authUrl; }).catch(() => setError(true));
  }

  if (loading) {
    return <div role="status" aria-live="polite" style={{ padding: '2rem', color: 'var(--ink-2)' }}>{locale === 'sk' ? 'Načítavam…' : 'Loading…'}</div>;
  }

  const unread = notifs.filter((n) => !n.readAt).length;
  const criticalRecent = notifs.find(
    (n) => n.severity === 'critical' && Date.now() - new Date(n.createdAt).getTime() < 24 * 3600_000,
  );
  const sk = locale === 'sk';

  async function openBell() {
    const next = !bellOpen;
    setBellOpen(next);
    if (next && unread > 0) {
      await markNotificationsRead().catch(() => {});
      await loadNotifs();
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>{t.title}</h3>
        <span className="badge badge-gray" style={{ fontSize: '.72rem' }}>{t.optional}</span>
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => void openBell()} aria-expanded={bellOpen}
            aria-label={`${sk ? 'Upozornenia' : 'Alerts'}${unread > 0 ? ` (${unread})` : ''}`}>
            <Bell size={16} aria-hidden="true" />
            {unread > 0 && <span className="badge badge-red" style={{ fontSize: '.66rem', marginLeft: '.3rem' }}>{unread}</span>}
          </button>
          {bellOpen && (
            <div role="menu" style={{ position: 'absolute', right: 0, top: '110%', width: 300, maxHeight: 400, overflowY: 'auto', background: 'var(--surface)', boxShadow: 'var(--shadow-lg)', borderRadius: 'var(--radius)', zIndex: 50, padding: '.5rem' }}>
              {notifs.length === 0 ? (
                <p style={{ fontSize: '.82rem', color: 'var(--ink-3)', padding: '.5rem' }}>{sk ? 'Žiadne upozornenia.' : 'No alerts.'}</p>
              ) : notifs.slice(0, 20).map((n) => (
                <div key={n.id} style={{ display: 'flex', gap: '.5rem', alignItems: 'center', padding: '.4rem .5rem', borderBottom: '1px solid var(--warm-100)' }}>
                  <span role="img" aria-label={flagText(n.flag ?? 'high', locale)} style={{ width: 8, height: 8, borderRadius: '50%', background: FLAG_COLOR[n.flag ?? 'high'] }} />
                  <span style={{ flex: 1, fontSize: '.8rem' }}>{n.metricType} = {n.value}</span>
                  <span style={{ fontSize: '.7rem', color: 'var(--ink-3)' }}>{timeAgo(n.createdAt, locale)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {devices.some((d) => Date.now() - new Date(d.connectedAt).getTime() > 365 * 24 * 3600_000) && (
        <div role="region" aria-label={t.manageConsent} className="card card-pad" style={{ background: 'var(--amber-50)', borderColor: 'var(--amber)', marginBottom: '1rem' }}>
          <p style={{ margin: 0, fontSize: '.86rem' }}>
            {sk
              ? 'Skontrolujte nastavenia súhlasu pre nositeľné zariadenia — naposledy ste ich kontrolovali pred viac ako 12 mesiacmi.'
              : 'Please review your wearable consent settings — last reviewed over 12 months ago.'}
          </p>
          <a href={`/${locale}/portal/wearables/sublas`} className="btn btn-ghost btn-sm" style={{ marginTop: '.5rem', display: 'inline-flex' }}>{t.manageConsent}</a>
        </div>
      )}

      {criticalRecent && (
        <div role="alert" className="card card-pad" style={{ background: 'var(--red-50)', borderColor: 'var(--red)', marginBottom: '1rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <span role="img" aria-label={flagText('critical', locale)} style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)' }} />
          <span style={{ fontSize: '.88rem', color: 'var(--red)' }}>
            {sk ? 'Kritické upozornenie zo zariadenia' : 'Critical wearable alert'} — {criticalRecent.metricType} {criticalRecent.value} · {timeAgo(criticalRecent.createdAt, locale)}
          </span>
        </div>
      )}

      {error && (
        <p role="alert" style={{ background: 'var(--red-50)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', padding: '.6rem .8rem', color: 'var(--red)', fontSize: '.88rem' }}>
          {locale === 'sk' ? 'Údaje sa nepodarilo načítať.' : 'Could not load wearables data.'}
        </p>
      )}

      <p aria-live="polite" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{liveMsg}</p>

      {/* 1 — Connected devices grid */}
      <section aria-label={t.connected} style={{ marginBottom: '2rem' }}>
        {devices.length === 0 ? (
          <p style={{ color: 'var(--ink-2)' }}>{t.noDevices}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {devices.map((d) => <DeviceCard key={d.id} device={d} locale={locale} t={t} onToggleShare={onToggleShare} onSynced={load} />)}
          </div>
        )}
      </section>

      {/* 2 — Recent readings timeline */}
      <section aria-label={t.recentReadings} style={{ marginBottom: '2rem' }}>
        <h4 style={{ marginBottom: '.75rem' }}>{t.recentReadings}</h4>
        <div className="card" style={{ overflow: 'hidden' }}>
          {allReadings.slice(0, timelineCount).map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.6rem .9rem', borderBottom: '1px solid var(--warm-100)' }}>
              <span style={{ width: 64, fontSize: '.78rem', color: 'var(--ink-3)' }}>{timeAgo(r.recordedAt, locale)}</span>
              <span role="img" aria-label={flagText(r.flag, locale)} style={{ width: 10, height: 10, borderRadius: '50%', background: FLAG_COLOR[r.flag] ?? 'var(--green)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '.9rem' }}>{r.metricLabel[locale] ?? r.metricLabel.en}</span>
              <span style={{ fontWeight: 700, fontSize: '.9rem' }}>{r.value}{r.unit ? ` ${r.unit}` : ''}</span>
              <span className="chip" style={{ fontSize: '.72rem' }}>{r.deviceBrand}</span>
              {r.inHis && <span className="badge badge-blue" style={{ fontSize: '.68rem' }}>{t.inHis}</span>}
            </div>
          ))}
          {allReadings.length === 0 && <div style={{ padding: '1rem', color: 'var(--ink-3)' }}>—</div>}
        </div>
        {allReadings.length > timelineCount && (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: '.6rem' }} onClick={() => setTimelineCount((c) => c + 20)}>{t.loadMore}</button>
        )}
      </section>

      {/* 3 — Connect a device panel */}
      <section style={{ marginBottom: '2rem' }}>
        <button
          className="btn btn-ghost"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((o) => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}
        >
          <ChevronDown size={16} style={{ transform: panelOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} aria-hidden="true" />
          {t.connectDevice}
        </button>
        {panelOpen && (
          <div className="card card-pad" style={{ marginTop: '.75rem' }}>
            <div role="tablist" aria-label={t.connectDevice} style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
              {(['medical', 'consumer'] as const).map((cat) => (
                <button key={cat} role="tab" aria-selected={availTab === cat} onClick={() => setAvailTab(cat)}
                  className={availTab === cat ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
                  {cat === 'medical' ? t.medicalTab : t.fitnessTab}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '.6rem' }}>
              {available.filter((p) => p.category === availTab).map((p) => (
                <button key={p.platform} className="card card-pad card-hover" onClick={() => onConnectClick(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: '.6rem', textAlign: 'left', border: 'none', background: 'var(--surface)', cursor: 'pointer' }}>
                  <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--blue-50)', color: 'var(--blue-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.8rem', flexShrink: 0 }}>
                    {p.brand.slice(0, 2).toUpperCase()}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: '.88rem' }}>{p.brand} {p.model}</span>
                    {p.partnershipRequired && <span className="badge badge-amber" style={{ fontSize: '.66rem', marginTop: '.2rem' }}>{t.agreementRequired}</span>}
                    {p.manualUploadOnly && <span className="badge badge-blue" style={{ fontSize: '.66rem', marginTop: '.2rem' }}>{t.uploadData}</span>}
                    {p.iosAppRequired && <span className="badge badge-gray" style={{ fontSize: '.66rem', marginTop: '.2rem' }}>{t.iosRequired}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 4 — GDPR consent notice */}
      <section className="card card-pad" style={{ background: 'var(--blue-50)', borderColor: 'var(--blue-200)' }}>
        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
          <ShieldCheck size={20} color="var(--blue-700)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: 0, fontSize: '.88rem', color: 'var(--ink-1)' }}>{t.gdprNotice}</p>
            <a href={`/${locale}/portal/wearables/sublas`} className="btn btn-ghost btn-sm" style={{ marginTop: '.6rem', display: 'inline-flex' }}>
              {t.manageConsent}
            </a>
          </div>
        </div>
      </section>

      {modal && (
        <PlatformModal
          kind={modal.kind}
          platform={modal.platform}
          t={t}
          onClose={() => setModal(null)}
          onUploaded={() => { setModal(null); void load(); }}
        />
      )}
    </div>
  );
}

// ── Device card ───────────────────────────────────────────────────────────────
function DeviceCard({
  device, locale, t, onToggleShare, onSynced,
}: {
  device: WearableDevice; locale: Locale; t: ReturnType<typeof L>;
  onToggleShare: (d: WearableDevice, next: boolean) => void; onSynced: () => Promise<void>;
}) {
  const [syncing, setSyncing] = useState(false);
  const top = device.readings.slice(0, 2);

  async function doSync() {
    if (device.partnershipRequired) return;
    setSyncing(true);
    try {
      const job = await syncDevice(device.id);
      // Poll up to 30s, 2s interval.
      for (let i = 0; i < 15 && job.status !== 'completed' && job.status !== 'failed'; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const j = await getSyncJob(device.id, job.jobId);
        if (j.status === 'completed' || j.status === 'failed') break;
      }
      await onSynced();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem' }}>
        <span style={{ color: 'var(--blue-700)' }}>{deviceIcon(device.deviceType)}</span>
        <span style={{ fontWeight: 700, fontSize: '.92rem' }}>{device.brand} {device.model}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '.3rem' }}>
          {device.status === 'error'
            ? <span className="badge badge-amber" style={{ fontSize: '.68rem' }}>{t.errorBadge}</span>
            : <span className="badge badge-green" style={{ fontSize: '.68rem' }}><span className="dot" />{t.active}</span>}
          {device.category === 'medical' && <span className="badge badge-blue" style={{ fontSize: '.68rem' }}>{t.medical}</span>}
        </span>
      </div>
      <div style={{ borderTop: '1px solid var(--warm-100)', paddingTop: '.5rem' }}>
        {top.map((r) => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', padding: '.2rem 0' }}>
            <span style={{ color: 'var(--ink-2)' }}>{r.metricLabel[locale] ?? r.metricLabel.en}</span>
            <span style={{ fontWeight: 700 }}>{r.value}{r.unit ? ` ${r.unit}` : ''}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--warm-100)', marginTop: '.5rem', paddingTop: '.5rem', display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => void doSync()} disabled={syncing || device.partnershipRequired}
          aria-label={`${t.syncNow} — ${device.brand} ${device.model}`}>
          <RefreshCw size={13} aria-hidden="true" style={{ animation: syncing ? 'spin 1s linear infinite' : undefined }} />
          {syncing ? t.syncing : (device.lastSyncAt ? `${t.syncedAgo} ${timeAgo(device.lastSyncAt, locale)}` : t.syncNow)}
        </button>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.82rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={device.shareWithPhysician}
            onChange={(e) => onToggleShare(device, e.target.checked)}
            aria-label={`${t.shareWithPhysician} — ${device.brand} ${device.model}`}
          />
          {t.shareWithPhysician}
        </label>
      </div>
    </div>
  );
}

// ── Platform connect modals ─────────────────────────────────────────────────────
function PlatformModal({
  kind, platform, t, onClose, onUploaded,
}: {
  kind: 'partnership' | 'ios' | 'upload'; platform: AvailablePlatform;
  t: ReturnType<typeof L>; onClose: () => void; onUploaded: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const titleId = 'wr-modal-title';
  const descId = 'wr-modal-desc';
  const desc = kind === 'partnership' ? t.contactToConnect : kind === 'ios' ? t.iosNotice : t.uploadNotice;

  async function doUpload() {
    setBusy(true);
    try {
      await uploadDeviceData(platform.platform, { filename: `${platform.brand}-export.pdf`, size: 1024 });
      onUploaded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="presentation" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,45,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} tabIndex={-1} ref={ref}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', maxWidth: 420, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--warm-100)' }}>
          <h4 id={titleId} style={{ margin: 0 }}>{platform.brand} {platform.model}</h4>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t.close}><X size={16} /></button>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <p id={descId} style={{ margin: 0, fontSize: '.9rem' }}>{desc}</p>
          {kind === 'partnership' && (
            <p style={{ marginTop: '.75rem', fontSize: '.82rem', color: 'var(--ink-2)' }}>
              <a href="mailto:wearables@nemocnicasnina.sk">wearables@nemocnicasnina.sk</a>
            </p>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', padding: '0 1.25rem 1.25rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t.cancel}</button>
          {kind === 'upload' && (
            <button className="btn btn-primary btn-sm" onClick={() => void doUpload()} disabled={busy}>
              <Upload size={14} aria-hidden="true" /> {t.upload}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
