'use client';

/**
 * GDPR consent management — /[lang]/portal/wearables/sublas (Sprint W4).
 *
 * Per-device consent control (data_storage locked-on, physician_sharing +
 * his_export toggles), an append-only consent audit trail (GDPR Art. 5(2)),
 * disconnect-device + withdraw-all flows, and a dismissible GDPR rights banner.
 * Built to the SPRINT_W4 Part D spec (consent-management.html visual vocabulary).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { ShieldCheck, X, Trash2, AlertTriangle } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import {
  getWearables, getConsents, getConsentAuditLog, updateConsent, disconnectDevice,
  type WearableDevice, type ConsentDto, type ConsentAuditEntry,
} from '@/lib/wearables-api';

const COPY = (sk: boolean) => ({
  breadcrumbPortal: sk ? 'Portál' : 'Portal',
  breadcrumbWear:   sk ? 'Zariadenia' : 'Wearables',
  title:            sk ? 'Správa súhlasov GDPR' : 'GDPR Consent management',
  rightsTitle:      sk ? 'Vaše práva podľa GDPR' : 'Your rights under GDPR',
  rights:           sk
    ? 'Máte právo svoj súhlas kedykoľvek odvolať (čl. 7), požiadať o vymazanie údajov (čl. 17) a namietať proti spracúvaniu (čl. 21).'
    : 'You may withdraw consent at any time (Art. 7), request erasure (Art. 17), and object to processing (Art. 21).',
  dismiss:          sk ? 'Zavrieť' : 'Dismiss',
  dataStorage:      sk ? 'Ukladanie meraní' : 'Store readings',
  dataStorageNote:  sk ? 'Povinné — odvolá sa odpojením zariadenia' : 'Required — withdraw by disconnecting the device',
  physicianSharing: sk ? 'Zdieľanie s lekárom' : 'Share with physician',
  hisExport:        sk ? 'Export do FHIR záznamu' : 'Export to FHIR record',
  granted:          sk ? 'Udelené' : 'Granted',
  notActive:        sk ? 'Neaktívne' : 'Not active',
  active:           sk ? 'Aktívne' : 'Active',
  medical:          sk ? 'Medicínske' : 'Medical',
  disconnect:       sk ? 'Odpojiť zariadenie' : 'Disconnect device',
  withdrawAll:      sk ? 'Odvolať všetky súhlasy' : 'Withdraw all consent',
  auditTrail:       sk ? 'Auditný záznam súhlasov' : 'Consent audit trail',
  colDate:          sk ? 'Dátum a čas' : 'Date & time',
  colDevice:        sk ? 'Zariadenie' : 'Device',
  colType:          sk ? 'Typ súhlasu' : 'Consent type',
  colAction:        sk ? 'Akcia' : 'Action',
  colIp:            sk ? 'IP (hash)' : 'IP (hash)',
  withdrawn:        sk ? 'Odvolané' : 'Withdrawn',
  auditImmutable:   sk ? 'Auditný záznam je nemenný — iba pridávanie (GDPR čl. 5 ods. 2).' : 'Audit trail is immutable — append-only (GDPR Art. 5(2)).',
  confirmDisconnect: sk ? 'Naozaj odpojiť toto zariadenie?' : 'Disconnect this device?',
  disconnectConseq: sk
    ? 'Odpojením sa odvolá súhlas, zruší prístupový token poskytovateľa a vymažú sa neexportované merania. Merania už zapísané v zdravotnom zázname zostanú zachované.'
    : 'Disconnecting withdraws consent, revokes the provider token, and deletes readings not yet exported. Readings already in your health record are preserved.',
  confirmWithdrawAll: sk ? 'Odvolať všetky súhlasy?' : 'Withdraw all consent?',
  withdrawAllConseq: sk
    ? 'Odpoja sa všetky zariadenia, zrušia sa tokeny a vymažú sa neexportované merania. Túto akciu nie je možné vrátiť.'
    : 'All devices are disconnected, tokens revoked, and unexported readings deleted. This cannot be undone.',
  reasonOptional:   sk ? 'Dôvod (voliteľné)' : 'Reason (optional)',
  cancel:           sk ? 'Zrušiť' : 'Cancel',
  confirm:          sk ? 'Potvrdiť' : 'Confirm',
  noDevices:        sk ? 'Žiadne pripojené zariadenia.' : 'No connected devices.',
  loginPrompt:      sk ? 'Pre zobrazenie sa prihláste.' : 'Please log in to view this page.',
  loading:          sk ? 'Načítavam…' : 'Loading…',
  updated:          sk ? 'Súhlas bol aktualizovaný' : 'Consent updated',
});

const REASONS = (sk: boolean) => [
  { v: '', l: sk ? '—' : '—' },
  { v: 'no_longer_needed', l: sk ? 'Už nepotrebujem' : 'No longer needed' },
  { v: 'privacy', l: sk ? 'Obavy o súkromie' : 'Privacy concerns' },
  { v: 'switching', l: sk ? 'Mením zariadenie' : 'Switching device' },
  { v: 'other', l: sk ? 'Iné' : 'Other' },
];

export default function ConsentManagementPage() {
  const locale = useLocale();
  const sk = locale === 'sk';
  const c = COPY(sk);

  const [devices, setDevices] = useState<WearableDevice[]>([]);
  const [consents, setConsents] = useState<Record<string, ConsentDto>>({});
  const [audit, setAudit] = useState<ConsentAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [liveMsg, setLiveMsg] = useState('');
  const [disconnectTarget, setDisconnectTarget] = useState<WearableDevice | null>(null);
  const [withdrawAllOpen, setWithdrawAllOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { devices: ds } = await getWearables();
      setDevices(ds);
      const entries = await Promise.all(ds.map((d) => getConsents(d.id).then((cs) => [d.id, cs] as const)));
      setConsents(Object.fromEntries(entries));
      setAudit(await getConsentAuditLog());
      setAuthed(true);
    } catch (err) {
      if (String(err).includes('401')) setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setBannerOpen(sessionStorage.getItem('ns_gdpr_banner') !== 'dismissed');
    void load();
  }, [load]);

  function dismissBanner() {
    sessionStorage.setItem('ns_gdpr_banner', 'dismissed');
    setBannerOpen(false);
  }

  function consentRow(deviceId: string, type: 'physician_sharing' | 'his_export') {
    return consents[deviceId]?.consents.find((r) => r.consentType === type);
  }

  async function toggle(device: WearableDevice, type: 'physician_sharing' | 'his_export', granted: boolean) {
    // Optimistic
    setConsents((prev) => {
      const cur = prev[device.id];
      if (!cur) return prev;
      const others = cur.consents.filter((r) => r.consentType !== type);
      return {
        ...prev,
        [device.id]: {
          ...cur,
          shareWithPhysician: type === 'physician_sharing' ? granted : cur.shareWithPhysician,
          consents: [...others, { consentType: type, granted, grantedAt: new Date().toISOString(), withdrawnAt: granted ? null : new Date().toISOString() }],
        },
      };
    });
    try {
      await updateConsent(device.id, { type, granted });
      setLiveMsg(c.updated);
      setAudit(await getConsentAuditLog());
    } catch {
      void load();
    }
  }

  async function doDisconnect(device: WearableDevice) {
    await disconnectDevice(device.id);
    setDisconnectTarget(null);
    await load();
  }

  async function doWithdrawAll() {
    for (const d of devices) {
      try { await disconnectDevice(d.id); } catch { /* continue */ }
    }
    setWithdrawAllOpen(false);
    await load();
  }

  return (
    <SiteLayout activePath={`/${locale}/portal`}>
      <div style={{ padding: '2rem 0 4rem' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" style={{ fontSize: '.82rem', color: 'var(--ink-3)', marginBottom: '1rem' }}>
            <a href={`/${locale}/portal`}>{c.breadcrumbPortal}</a>
            {' › '}
            <a href={`/${locale}/portal?tab=wearables`}>{c.breadcrumbWear}</a>
            {' › '}
            <span aria-current="page">{c.title}</span>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <h1 style={{ margin: 0, fontFamily: 'Newsreader, serif', fontSize: '1.6rem' }}>{c.title}</h1>
            {devices.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setWithdrawAllOpen(true)}
                style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
                <Trash2 size={14} aria-hidden="true" /> {c.withdrawAll}
              </button>
            )}
          </div>

          <p aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{liveMsg}</p>

          {/* GDPR rights banner */}
          {bannerOpen && (
            <div className="card card-pad" role="region" aria-label={c.rightsTitle}
              style={{ background: 'var(--blue-50)', borderColor: 'var(--blue-200)', marginBottom: '1.5rem', display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
              <ShieldCheck size={20} color="var(--blue-700)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '.9rem' }}>{c.rightsTitle}</strong>
                <p style={{ margin: '.3rem 0 0', fontSize: '.86rem' }}>{c.rights}</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={dismissBanner} aria-label={c.dismiss}><X size={16} /></button>
            </div>
          )}

          {!authed ? (
            <div className="card card-pad">
              <p>{c.loginPrompt}</p>
              <a href={`/${locale}/portal/login`} className="btn btn-primary btn-sm">eID</a>
            </div>
          ) : loading ? (
            <div role="status" aria-live="polite" style={{ color: 'var(--ink-2)' }}>{c.loading}</div>
          ) : devices.length === 0 ? (
            <p style={{ color: 'var(--ink-2)' }}>{c.noDevices}</p>
          ) : (
            <>
              {/* Per-device consent cards */}
              {devices.map((d) => (
                <div key={d.id} className="card card-pad" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
                    <strong>{d.brand} {d.model}</strong>
                    <span className="badge badge-green" style={{ fontSize: '.68rem' }}><span className="dot" />{c.active}</span>
                    {d.category === 'medical' && <span className="badge badge-blue" style={{ fontSize: '.68rem' }}>{c.medical}</span>}
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--red)' }}
                      onClick={() => setDisconnectTarget(d)}>
                      {c.disconnect}
                    </button>
                  </div>

                  {/* data_storage — locked */}
                  <ConsentLine label={c.dataStorage} note={c.dataStorageNote} accent="var(--blue-700)">
                    <span className="badge badge-blue" style={{ fontSize: '.7rem' }}>{c.active}</span>
                  </ConsentLine>

                  {/* physician_sharing */}
                  <ConsentLine
                    label={c.physicianSharing}
                    note={statusNote(consentRow(d.id, 'physician_sharing'), c, locale)}
                    accent="var(--green)"
                  >
                    <Toggle
                      checked={consents[d.id]?.shareWithPhysician ?? false}
                      ariaLabel={`${c.physicianSharing} — ${d.brand} ${d.model}`}
                      onChange={(v) => void toggle(d, 'physician_sharing', v)}
                      color="var(--green)"
                    />
                  </ConsentLine>

                  {/* his_export */}
                  <ConsentLine
                    label={c.hisExport}
                    note={statusNote(consentRow(d.id, 'his_export'), c, locale)}
                    accent="var(--terra)"
                  >
                    <Toggle
                      checked={(consentRow(d.id, 'his_export')?.granted) ?? false}
                      ariaLabel={`${c.hisExport} — ${d.brand} ${d.model}`}
                      onChange={(v) => void toggle(d, 'his_export', v)}
                      color="var(--terra)"
                    />
                  </ConsentLine>
                </div>
              ))}

              {/* Audit trail */}
              <h2 style={{ fontSize: '1.1rem', margin: '2rem 0 .75rem' }}>{c.auditTrail}</h2>
              <div className="card" style={{ overflowX: 'auto' }}>
                <table className="data" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>{c.colDate}</th><th>{c.colDevice}</th><th>{c.colType}</th><th>{c.colAction}</th><th>{c.colIp}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((e) => (
                      <tr key={e.id}>
                        <td style={{ fontSize: '.82rem' }}>{new Date(e.ts).toLocaleString(sk ? 'sk-SK' : 'en-GB')}</td>
                        <td style={{ fontSize: '.82rem' }}>{e.deviceLabel}</td>
                        <td style={{ fontSize: '.82rem' }}>{e.consentType}</td>
                        <td>
                          <span className={e.action === 'granted' ? 'badge badge-green' : 'badge badge-amber'} style={{ fontSize: '.7rem' }}>
                            {e.action === 'granted' ? c.granted : c.withdrawn}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '.74rem', color: 'var(--ink-3)' }}>{e.ipHash.slice(0, 12)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: '.78rem', color: 'var(--ink-3)', marginTop: '.5rem' }}>{c.auditImmutable}</p>

              {/* Withdraw all (bottom) */}
              <div style={{ marginTop: '1.5rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setWithdrawAllOpen(true)} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
                  <Trash2 size={14} aria-hidden="true" /> {c.withdrawAll}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {disconnectTarget && (
        <ConfirmModal
          title={c.confirmDisconnect}
          consequence={c.disconnectConseq}
          confirmLabel={c.disconnect}
          cancelLabel={c.cancel}
          onCancel={() => setDisconnectTarget(null)}
          onConfirm={() => void doDisconnect(disconnectTarget)}
        />
      )}
      {withdrawAllOpen && (
        <ConfirmModal
          title={c.confirmWithdrawAll}
          consequence={c.withdrawAllConseq}
          confirmLabel={c.withdrawAll}
          cancelLabel={c.cancel}
          reasonLabel={c.reasonOptional}
          reasons={REASONS(sk)}
          onCancel={() => setWithdrawAllOpen(false)}
          onConfirm={() => void doWithdrawAll()}
        />
      )}
    </SiteLayout>
  );
}

function statusNote(row: { granted: boolean; grantedAt: string } | undefined, c: ReturnType<typeof COPY>, locale: string): string {
  if (row?.granted) return `${c.granted} · ${new Date(row.grantedAt).toLocaleDateString(locale === 'sk' ? 'sk-SK' : 'en-GB')}`;
  return c.notActive;
}

function ConsentLine({ label, note, accent, children }: { label: string; note: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.55rem 0', borderTop: '1px solid var(--warm-100)' }}>
      <span aria-hidden="true" style={{ width: 4, height: 28, borderRadius: 2, background: accent, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: '.88rem' }}>{label}</span>
        <span style={{ fontSize: '.78rem', color: 'var(--ink-3)' }}>{note}</span>
      </span>
      {children}
    </div>
  );
}

function Toggle({ checked, ariaLabel, onChange, color }: { checked: boolean; ariaLabel: string; onChange: (v: boolean) => void; color: string }) {
  return (
    <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={ariaLabel}
        style={{ position: 'absolute', opacity: 0, width: 44, height: 24, margin: 0, cursor: 'pointer' }} />
      <span aria-hidden="true" style={{ width: 44, height: 24, borderRadius: 12, background: checked ? color : 'var(--warm-200)', transition: 'background .15s', position: 'relative', display: 'inline-block' }}>
        <span style={{ position: 'absolute', top: 2, left: checked ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
      </span>
    </label>
  );
}

function ConfirmModal({
  title, consequence, confirmLabel, cancelLabel, reasonLabel, reasons, onCancel, onConfirm,
}: {
  title: string; consequence: string; confirmLabel: string; cancelLabel: string;
  reasonLabel?: string; reasons?: { v: string; l: string }[]; onCancel: () => void; onConfirm: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div role="presentation" onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,45,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="cm-title" aria-describedby="cm-desc" tabIndex={-1} ref={ref}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', maxWidth: 460, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--warm-100)', display: 'flex', gap: '.6rem', alignItems: 'center' }}>
          <AlertTriangle size={20} color="var(--red)" aria-hidden="true" />
          <h3 id="cm-title" style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <p id="cm-desc" style={{ margin: 0, fontSize: '.88rem' }}>{consequence}</p>
          {reasons && (
            <label style={{ display: 'block', marginTop: '1rem', fontSize: '.84rem' }}>
              {reasonLabel}
              <select style={{ display: 'block', marginTop: '.3rem', width: '100%', padding: '.4rem' }}>
                {reasons.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </label>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', padding: '0 1.25rem 1.25rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff' }} onClick={onConfirm} aria-describedby="cm-desc">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
