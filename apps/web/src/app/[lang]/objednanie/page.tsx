'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Check, ChevronRight, AlertTriangle, Clock, Video, Camera, CameraOff, ExternalLink } from 'lucide-react';
import { PageHero } from '@ns/ui';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';
import type { Clinic } from '@ns/types';

type Step = 1 | 2 | 3 | 4 | 5;
type DeviceState = 'idle' | 'checking' | 'ready' | 'denied';

interface BookingState {
  clinicId: string;
  date: string;
  time: string;
  patientName: string;
  patientPhone: string;
  patientRc: string;
  hasReferral: boolean;
  gdprConsent: boolean;
  referralConsent: boolean;
  telehealthConsent: boolean;
  minorGuardianConsent: boolean;
  otpVerified: boolean;
  bookingId: string;
}

const EMPTY_STATE: BookingState = {
  clinicId: '', date: '', time: '',
  patientName: '', patientPhone: '', patientRc: '',
  hasReferral: false, gdprConsent: false, referralConsent: false,
  telehealthConsent: false, minorGuardianConsent: false,
  otpVerified: false, bookingId: '',
};

const WEEKDAY_SK = ['Ne','Po','Ut','St','Št','Pi','So'];
const WEEKDAY_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getNextAllowedDates(clinic: Clinic, count = 8): string[] {
  if (!clinic.bookable || !clinic.bookingDays?.length) return [];
  const dates: string[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);
  while (dates.length < count) {
    if (clinic.bookingDays.includes(cursor.getDay() as 0|1|2|3|4|5|6)) {
      // .toISOString() converts to UTC — for any UTC+ timezone (e.g.
      // Europe/Bratislava), local midnight is still the previous day in
      // UTC, so this permanently offset every date shown here one day
      // earlier than the server's own "next available date" — not a rare
      // midnight edge case, a full-day, every-request offset for the
      // entire timezone. This is the exact class of bug CLAUDE.md already
      // documents as fixed in booking-rules.service.ts's
      // nextAvailableDates() (the reference implementation) and in the
      // E2E test date helpers; this one call site was missed. Build the
      // date string from local components instead.
      dates.push(toLocalDateString(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function generateSlots(clinic: Clinic, telehealth: boolean): string[] {
  const window = telehealth ? (clinic.telehealthWindow ?? clinic.bookingWindow) : clinic.bookingWindow;
  if (window) {
    const [start, end] = window.split('–');
    if (!start || !end) return [];
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const slots: string[] = [];
    let h = sh ?? 13, m = sm ?? 0;
    while (h * 60 + m < (eh ?? 14) * 60 + (em ?? 0)) {
      slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
      m += 20;
      if (m >= 60) { h++; m -= 60; }
    }
    return slots;
  }
  const slots: string[] = [];
  for (let h = 8; h < 15; h++) {
    slots.push(`${String(h).padStart(2,'0')}:00`);
    slots.push(`${String(h).padStart(2,'0')}:20`);
    slots.push(`${String(h).padStart(2,'0')}:40`);
  }
  return slots;
}

// Simple modulo-11 RC check (client-side, mirrored by server)
function validateRc(rc: string): boolean {
  const clean = rc.replace(/[\s/]/g, '');
  if (!/^\d{9,10}$/.test(clean)) return false;
  if (clean.length === 9) return true;
  return parseInt(clean, 10) % 11 === 0;
}

function getAgeFromRc(rc: string): number | null {
  const clean = rc.replace(/[\s/]/g, '');
  if (!/^\d{9,10}$/.test(clean)) return null;
  const yy = parseInt(clean.substring(0, 2), 10);
  let mm = parseInt(clean.substring(2, 4), 10);
  const dd = parseInt(clean.substring(4, 6), 10);
  if (mm > 50) mm -= 50;
  const currentYear = new Date().getFullYear();
  const fullYear = yy + (yy > (currentYear % 100) ? 1900 : 2000);
  const birthDate = new Date(fullYear, mm - 1, dd);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())) age--;
  return age;
}

function isJoinActive(date: string, time: string): boolean {
  if (!date || !time) return false;
  const scheduled = new Date(`${date}T${time}:00`);
  const now = new Date();
  const diff = scheduled.getTime() - now.getTime();
  return diff <= 10 * 60 * 1000 && diff > -60 * 60 * 1000;
}

// ─── DeviceCheckCallout ───────────────────────────────────

function DeviceCheckCallout({ state, onCheck }: { state: DeviceState; onCheck: () => void }) {
  const t = useTranslations();
  const colours = {
    idle:     { bg: 'var(--blue-50)',   border: 'var(--blue-700)', text: 'var(--blue-700)' },
    checking: { bg: 'var(--blue-50)',   border: 'var(--blue-700)', text: 'var(--blue-700)' },
    ready:    { bg: 'var(--green-50)',  border: 'var(--green)',    text: 'var(--green)'    },
    denied:   { bg: 'var(--amber-50)',  border: 'var(--amber)',    text: 'var(--amber)'    },
  }[state];

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="device-check"
      style={{
        background: colours.bg,
        border: `1px solid ${colours.border}`,
        borderRadius: 'var(--radius-sm)',
        padding: '.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '.75rem',
      }}
    >
      {state === 'ready'
        ? <Camera size={18} color={colours.text} aria-hidden />
        : <CameraOff size={18} color={colours.text} aria-hidden />}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '.88rem', color: colours.text }}>
          {t(`booking.deviceCheck${state === 'ready' ? 'Ready' : state === 'denied' ? 'Denied' : 'Checking'}`)}
        </div>
      </div>
      {state === 'idle' && (
        <button
          type="button"
          onClick={onCheck}
          style={{
            fontSize: '.82rem', fontWeight: 700, color: colours.text,
            background: 'none', border: `1px solid ${colours.border}`,
            borderRadius: 'var(--radius-sm)', padding: '.3rem .7rem', cursor: 'pointer',
          }}
        >
          {t('booking.deviceCheckChecking').replace('…', '')} ↗
        </button>
      )}
    </div>
  );
}

export default function BookingPage() {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode'); // 'telehealth' or null
  const isTelehealth = mode === 'telehealth';

  const [step, setStep] = useState<Step>(1);
  const [booking, setBooking] = useState<BookingState>({ ...EMPTY_STATE });
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [rcError, setRcError] = useState('');
  const [minorBlock, setMinorBlock] = useState<'under16' | '16to17' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deviceState, setDeviceState] = useState<DeviceState>('idle');

  useEffect(() => {
    fetch(`/api/content?type=clinics&locale=${locale}`)
      .then((r) => r.json() as Promise<Clinic[]>)
      .then(setClinics)
      .catch(() => {});
  }, [locale]);

  // Deep-link: ?clinic=<id> jumps to step 2
  useEffect(() => {
    const cid = searchParams.get('clinic');
    if (cid && clinics.find((c) => c.id === cid)?.bookable) {
      setBooking((prev) => ({ ...prev, clinicId: cid }));
      setStep(2);
    }
  }, [searchParams, clinics]);

  const handleDeviceCheck = useCallback(() => {
    setDeviceState('checking');
    navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        setDeviceState('ready');
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('th_device_ok', '1');
      })
      .catch(() => setDeviceState('denied'));
  }, []);

  // Kick off device check automatically on step 4 when in telehealth mode
  useEffect(() => {
    if (isTelehealth && step === 4 && deviceState === 'idle') {
      handleDeviceCheck();
    }
  }, [isTelehealth, step, deviceState, handleDeviceCheck]);

  const visibleClinics = isTelehealth
    ? clinics.filter((c) => c.telehealth && c.bookable && c.status !== 'closed')
    : clinics.filter((c) => c.bookable);

  const selectedClinic = clinics.find((c) => c.id === booking.clinicId);
  const availableDates = selectedClinic ? getNextAllowedDates(selectedClinic) : [];
  const slots = selectedClinic ? generateSlots(selectedClinic, isTelehealth) : [];

  const STEPS: { label: string }[] = [
    { label: t('booking.step1') },
    { label: t('booking.step2') },
    { label: t('booking.step3') },
    { label: t('booking.step4') },
    { label: t('booking.step5') },
  ];

  const Stepper = () => (
    <div className="stepper" role="list" aria-label="Kroky objednávky">
      {STEPS.map((s, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const active = n === step;
        return (
          <div
            key={n}
            className={`stepper-step${done ? ' done' : active ? ' active' : ''}`}
            role="listitem"
            aria-current={active ? 'step' : undefined}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.3em' }}>
              {done ? <Check size={13} aria-hidden /> : <span>{n}.</span>}
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );

  // ─── Step 1: Choose clinic ────────────────────────────────
  if (step === 1) {
    return (
      <SiteLayout activePath={`/${locale}/objednanie`}>
        <div data-step="1">
          <PageHero
            slot="booking-hero"
            alt=""
            breadcrumb={{ homeLabel: t('backHome'), homeHref: `/${locale}`, here: t('book') }}
          >
            {isTelehealth && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
                <Video size={18} aria-hidden />
                <span className="eyebrow">{t('booking.telehealthModeTitle')}</span>
              </div>
            )}
            <p className="eyebrow">{t('booking.title')}</p>
            <h1 style={{ marginBottom: '1.5rem' }}>{t('booking.step1')}</h1>
            <Stepper />
          </PageHero>
          <div className="container-narrow" style={{ padding: '2rem 0 4rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {visibleClinics.map((clinic) => (
                <button
                  key={clinic.id}
                  data-clinic-id={clinic.id}
                  onClick={() => { setBooking((p) => ({ ...p, clinicId: clinic.id })); setStep(2); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    background: 'var(--surface)', border: '1.5px solid var(--line)',
                    borderRadius: 'var(--radius)', padding: '1rem 1.2rem',
                    textAlign: 'left', cursor: 'pointer', width: '100%',
                    transition: 'border .14s, box-shadow .14s',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: '.2rem' }}>
                      {localizeField(clinic.name, locale)}
                    </div>
                    <div style={{ fontSize: '.85rem', color: 'var(--ink-2)', marginBottom: '.4rem' }}>
                      {clinic.doctor}
                    </div>
                    <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                      {(isTelehealth || clinic.telehealth) && (
                        <span
                          className="chip"
                          style={{ color: 'var(--blue-700)', background: 'var(--blue-50)', display: 'inline-flex', alignItems: 'center', gap: '.3em' }}
                        >
                          <Video size={11} aria-hidden /> {t('booking.telehealthChip')}
                        </span>
                      )}
                      {clinic.referral && (
                        <span className="chip" style={{ color: 'var(--amber)', background: 'var(--amber-50)' }}>
                          {t('referralReq')}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--blue-600)" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (!selectedClinic) { setStep(1); return null; }

  // ─── Step 2: Choose date ──────────────────────────────────
  if (step === 2) {
    const windowNote = isTelehealth
      ? (selectedClinic.telehealthWindow ?? selectedClinic.bookingWindow)
      : selectedClinic.bookingWindow;

    return (
      <SiteLayout activePath={`/${locale}/objednanie`}>
        <div data-step="2">
          <PageHero
            slot="booking-hero"
            alt=""
            breadcrumb={{ homeLabel: t('backHome'), homeHref: `/${locale}`, here: t('book') }}
          >
            <p className="eyebrow">{localizeField(selectedClinic.name, locale)}</p>
            <h1 style={{ marginBottom: '1.5rem' }}>{t('booking.step2')}</h1>
            <Stepper />
          </PageHero>
          <div className="container-narrow" style={{ padding: '2rem 0 4rem' }}>
            <div
              style={{
                background: 'var(--blue-50)',
                borderRadius: 'var(--radius-sm)',
                padding: '.7rem 1rem',
                fontSize: '.88rem',
                color: 'var(--blue-700)',
                margin: '1.25rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '.5rem',
              }}
              role="note"
            >
              {isTelehealth && <Video size={15} aria-hidden />}
              {isTelehealth
                ? localizeField(selectedClinic.telehealthRule ?? selectedClinic.bookingRule, locale)
                : localizeField(selectedClinic.bookingRule, locale)}
              {windowNote && isTelehealth && (
                <span
                  className="chip"
                  style={{ color: 'var(--blue-700)', background: 'rgba(255,255,255,.6)', marginLeft: 'auto', flexShrink: 0 }}
                >
                  Video · {windowNote}
                </span>
              )}
            </div>
            {availableDates.length === 0 ? (
              <p style={{ color: 'var(--ink-3)' }}>{t('booking.noSlots')}</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.6rem', marginTop: '1rem' }}>
                {availableDates.map((d) => {
                  const date = new Date(d + 'T00:00:00');
                  const dayName = locale === 'sk' ? WEEKDAY_SK[date.getDay()] : WEEKDAY_EN[date.getDay()];
                  const active = booking.date === d;
                  return (
                    <button
                      key={d}
                      data-date={d}
                      onClick={() => { setBooking((p) => ({ ...p, date: d, time: '' })); setStep(3); }}
                      style={{
                        background: active ? 'var(--blue-700)' : 'var(--surface)',
                        color: active ? '#fff' : 'var(--ink)',
                        border: `1.5px solid ${active ? 'var(--blue-700)' : 'var(--line)'}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '.9rem .5rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        fontFamily: 'Mulish, sans-serif',
                        fontWeight: 700,
                        transition: 'all .14s',
                      }}
                    >
                      <div style={{ fontSize: '.78rem', opacity: .7 }}>{dayName}</div>
                      <div style={{ fontSize: '1.05rem' }}>
                        {date.getDate()}.{date.getMonth() + 1}.
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← {t('booking.back')}</button>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // ─── Step 3: Choose time ──────────────────────────────────
  if (step === 3) {
    return (
      <SiteLayout activePath={`/${locale}/objednanie`}>
        <div data-step="3">
          <PageHero
            slot="booking-hero"
            alt=""
            breadcrumb={{ homeLabel: t('backHome'), homeHref: `/${locale}`, here: t('book') }}
          >
            <p className="eyebrow">{booking.date}</p>
            <h1 style={{ marginBottom: '1.5rem' }}>{t('booking.step3')}</h1>
            <Stepper />
          </PageHero>
          <div className="container-narrow" style={{ padding: '2rem 0 4rem' }}>
            {slots.length === 0 ? (
              <p style={{ color: 'var(--ink-3)', marginTop: '1.5rem' }}>{t('booking.noSlots')}</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '.5rem', marginTop: '1.5rem' }}>
                {slots.map((slot) => {
                  const active = booking.time === slot;
                  return (
                    <button
                      key={slot}
                      data-time={slot}
                      onClick={() => { setBooking((p) => ({ ...p, time: slot })); setStep(4); }}
                      style={{
                        background: active ? 'var(--blue-700)' : 'var(--surface)',
                        color: active ? '#fff' : 'var(--ink)',
                        border: `1.5px solid ${active ? 'var(--blue-700)' : 'var(--line)'}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '.7rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        fontFamily: 'Mulish, sans-serif',
                        fontWeight: 700,
                        fontSize: '.95rem',
                        transition: 'all .14s',
                      }}
                    >
                      {isTelehealth ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.2rem' }}>
                          <Video size={13} aria-hidden />
                          <span>{slot}</span>
                          <span style={{ fontSize: '.72rem', opacity: .8 }}>{t('booking.telehealthVideoSlot')}</span>
                        </div>
                      ) : (
                        <>
                          <Clock size={13} aria-hidden style={{ display: 'block', margin: '0 auto .2rem' }} />
                          {slot}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>← {t('booking.back')}</button>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // ─── Step 4: Patient details + consents ───────────────────
  if (step === 4) {
    function handleSubmitDetails(e: React.FormEvent) {
      e.preventDefault();
      if (!validateRc(booking.patientRc)) {
        setRcError(locale === 'sk' ? 'Neplatné rodné číslo.' : 'Invalid birth number.');
        return;
      }
      setRcError('');

      if (isTelehealth) {
        const age = getAgeFromRc(booking.patientRc);
        if (age !== null && age < 16) {
          setMinorBlock('under16');
          return;
        }
        if (age !== null && age < 18) {
          setMinorBlock('16to17');
          // Still proceed — but guardian checkbox is required (enforced by HTML required)
        } else {
          setMinorBlock(null);
        }
      }

      setStep(5);
    }

    const age = booking.patientRc.replace(/[\s/]/g, '').length >= 9 ? getAgeFromRc(booking.patientRc) : null;
    const isMinor = age !== null && age < 18;
    const isBlockedMinor = age !== null && age < 16;

    return (
      <SiteLayout activePath={`/${locale}/objednanie`}>
        <div data-step="4">
          <PageHero
            slot="booking-hero"
            alt=""
            breadcrumb={{ homeLabel: t('backHome'), homeHref: `/${locale}`, here: t('book') }}
          >
            <h1 style={{ marginBottom: '1.5rem' }}>{t('booking.step4')}</h1>
            <Stepper />
          </PageHero>
          <div className="container-narrow" style={{ padding: '2rem 0 4rem' }}>
            <form onSubmit={handleSubmitDetails} noValidate>
              <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Name */}
                <label className="field">
                  <span>{t('booking.nameLabel')}</span>
                  <input
                    type="text"
                    name="patientName"
                    value={booking.patientName}
                    onChange={(e) => setBooking((p) => ({ ...p, patientName: e.target.value }))}
                    required
                    autoComplete="name"
                  />
                </label>
                {/* Phone */}
                <label className="field">
                  <span>{t('booking.phoneLabel')}</span>
                  <input
                    type="tel"
                    name="patientPhone"
                    value={booking.patientPhone}
                    onChange={(e) => setBooking((p) => ({ ...p, patientPhone: e.target.value }))}
                    required
                    autoComplete="tel"
                    placeholder="+421 9XX XXX XXX"
                  />
                </label>
                {/* RC */}
                <div>
                  <label className="field">
                    <span>{t('booking.rcLabel')}</span>
                    <input
                      type="text"
                      name="patientRc"
                      value={booking.patientRc}
                      onChange={(e) => {
                        setBooking((p) => ({ ...p, patientRc: e.target.value }));
                        setRcError('');
                        setMinorBlock(null);
                      }}
                      required
                      inputMode="numeric"
                      placeholder="YYMMDD/CCCC"
                      aria-describedby={rcError ? 'rc-error' : undefined}
                      aria-invalid={!!rcError}
                    />
                  </label>
                  {rcError && (
                    <p id="rc-error" role="alert" style={{ color: 'var(--red)', fontSize: '.85rem', marginTop: '.3rem' }}>
                      {rcError}
                    </p>
                  )}
                </div>

                {/* Minor block for telehealth */}
                {isTelehealth && minorBlock === 'under16' && (
                  <div
                    role="alert"
                    style={{
                      background: 'var(--amber-50)', border: '1px solid var(--amber)',
                      borderRadius: 'var(--radius-sm)', padding: '.75rem 1rem',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--amber)', marginBottom: '.25rem' }}>
                      <AlertTriangle size={14} style={{ display: 'inline', marginRight: '.4em' }} aria-hidden />
                      {t('booking.minorBlockTitle')}
                    </div>
                    <p style={{ fontSize: '.88rem', color: 'var(--ink-2)', margin: 0 }}>
                      {t('booking.minorBlockBody')}
                    </p>
                  </div>
                )}

                {/* Referral consent — conditional */}
                {selectedClinic.referral && (
                  <label style={{ display: 'flex', gap: '.7rem', cursor: 'pointer', alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      name="referralConsent"
                      checked={booking.referralConsent}
                      onChange={(e) => setBooking((p) => ({ ...p, referralConsent: e.target.checked }))}
                      required
                      style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--blue-700)' }}
                    />
                    <span style={{ fontSize: '.9rem' }}>{t('booking.referralConsent')}</span>
                  </label>
                )}

                {/* GDPR consent — mandatory */}
                <label style={{ display: 'flex', gap: '.7rem', cursor: 'pointer', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    name="gdprConsent"
                    checked={booking.gdprConsent}
                    onChange={(e) => setBooking((p) => ({ ...p, gdprConsent: e.target.checked }))}
                    required
                    style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--blue-700)' }}
                  />
                  <span style={{ fontSize: '.9rem' }}>{t('booking.gdprConsent')}</span>
                </label>

                {/* Telehealth-specific additions */}
                {isTelehealth && (
                  <>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '.25rem 0' }} />

                    {/* Device check callout */}
                    <DeviceCheckCallout state={deviceState} onCheck={handleDeviceCheck} />

                    {/* Telehealth GDPR consent — mandatory */}
                    <label style={{ display: 'flex', gap: '.7rem', cursor: 'pointer', alignItems: 'flex-start' }}>
                      <input
                        type="checkbox"
                        name="telehealthConsent"
                        checked={booking.telehealthConsent}
                        onChange={(e) => setBooking((p) => ({ ...p, telehealthConsent: e.target.checked }))}
                        required
                        style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--blue-700)' }}
                        aria-describedby="telehealth-consent-desc"
                      />
                      <span id="telehealth-consent-desc" style={{ fontSize: '.9rem' }}>
                        {t('booking.telehealthConsentLabel')}{' '}
                        <a
                          href={`/${locale}/telehealth/sukromie`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--blue-700)', fontSize: '.85rem', display: 'inline-flex', alignItems: 'center', gap: '.2em' }}
                        >
                          {t('booking.telehealthConsentLink')}
                          <ExternalLink size={11} aria-hidden />
                        </a>
                      </span>
                    </label>

                    {/* Guardian consent for 16–17 */}
                    {isMinor && !isBlockedMinor && (
                      <label style={{ display: 'flex', gap: '.7rem', cursor: 'pointer', alignItems: 'flex-start' }}>
                        <input
                          type="checkbox"
                          name="minorGuardianConsent"
                          checked={booking.minorGuardianConsent}
                          onChange={(e) => setBooking((p) => ({ ...p, minorGuardianConsent: e.target.checked }))}
                          required
                          style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--blue-700)' }}
                        />
                        <span style={{ fontSize: '.9rem', color: 'var(--amber)' }}>
                          {t('booking.minorGuardianLabel')}
                        </span>
                      </label>
                    )}
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={isTelehealth && minorBlock === 'under16'}
                >
                  {t('booking.next')} →
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setStep(3)}>
                  ← {t('booking.back')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // ─── Step 5: Confirm ──────────────────────────────────────
  async function handleConfirm() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId:              booking.clinicId,
          date:                  booking.date,
          time:                  booking.time,
          patientName:           booking.patientName,
          patientPhone:          booking.patientPhone,
          patientRc:             booking.patientRc,
          hasReferral:           booking.referralConsent,
          gdprConsent:           booking.gdprConsent,
          referralConsent:       booking.referralConsent,
          ...(isTelehealth && {
            mode:                'telehealth',
            telehealthConsent:   booking.telehealthConsent,
            minorGuardianConsent:booking.minorGuardianConsent,
          }),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? 'Booking failed');
      }

      const data = await res.json() as { id: string };
      setBooking((p) => ({ ...p, bookingId: data.id }));
    } catch (err) {
      // In dev without API, generate a mock ID so the UI still shows success
      if (process.env['NODE_ENV'] === 'development') {
        setBooking((p) => ({ ...p, bookingId: `NS-${Date.now().toString(36).toUpperCase()}` }));
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Chyba pri odosielaní.');
        setSubmitting(false);
        return;
      }
    }
    setSubmitting(false);
  }

  if (step === 5) {
    // Confirmed state
    if (booking.bookingId) {
      const joinActive = isJoinActive(booking.date, booking.time);
      return (
        <SiteLayout activePath={`/${locale}/objednanie`}>
          <div data-step="5" style={{ padding: '3rem 0 5rem' }}>
            <div className="container-narrow" style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'var(--green-50)', color: 'var(--green)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                }}
                aria-hidden
              >
                <Check size={36} strokeWidth={2.5} />
              </div>
              <h1 style={{ marginBottom: '.5rem' }}>{t('booking.successTitle')}</h1>
              <p className="lede" style={{ marginBottom: '1.5rem' }}>{t('booking.successBody')}</p>
              <div
                className="card card-pad"
                style={{ display: 'inline-block', textAlign: 'left', minWidth: 320, marginBottom: '1.5rem' }}
              >
                <div data-booking-id style={{ fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 700, color: 'var(--blue-700)', textAlign: 'center', marginBottom: '1rem' }}>
                  {booking.bookingId}
                </div>
                {[
                  { l: locale === 'sk' ? 'Ambulancia' : 'Clinic', v: localizeField(selectedClinic.name, locale) },
                  { l: locale === 'sk' ? 'Typ' : 'Type', v: isTelehealth ? t('booking.telehealthChip') : (locale === 'sk' ? 'Osobná návšteva' : 'In-person visit') },
                  { l: locale === 'sk' ? 'Dátum' : 'Date', v: booking.date },
                  { l: locale === 'sk' ? 'Čas' : 'Time', v: booking.time },
                  { l: locale === 'sk' ? 'Pacient' : 'Patient', v: booking.patientName },
                ].map(({ l, v }) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '.4rem 0', fontSize: '.9rem' }}>
                    <span style={{ color: 'var(--ink-3)' }}>{l}</span>
                    <span style={{ fontWeight: 700 }}>{v}</span>
                  </div>
                ))}

                {/* Telehealth join button */}
                {isTelehealth && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--line)' }}>
                    {joinActive ? (
                      <a
                        href={`/${locale}/telehealth/konzultacia/${booking.bookingId}`}
                        className="btn btn-primary"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}
                      >
                        <Video size={16} aria-hidden />
                        {t('booking.joinConsultation')}
                      </a>
                    ) : (
                      <div>
                        <button
                          disabled
                          className="btn btn-primary"
                          style={{ width: '100%', opacity: .45, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}
                          aria-disabled="true"
                        >
                          <Video size={16} aria-hidden />
                          {t('booking.joinConsultation')}
                        </button>
                        <p style={{ fontSize: '.82rem', color: 'var(--ink-3)', marginTop: '.4rem', textAlign: 'center' }}>
                          {t('booking.joinActiveIn')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p style={{ fontSize: '.88rem', color: 'var(--ink-3)', maxWidth: 400, margin: '0 auto' }}>
                {t('booking.cancelInfo')}
              </p>
            </div>
          </div>
        </SiteLayout>
      );
    }

    // Pre-confirm summary
    return (
      <SiteLayout activePath={`/${locale}/objednanie`}>
        <div data-step="5">
          <PageHero
            slot="booking-hero"
            alt=""
            breadcrumb={{ homeLabel: t('backHome'), homeHref: `/${locale}`, here: t('book') }}
          >
            <h1 style={{ marginBottom: '1.5rem' }}>{t('booking.step5')}</h1>
            <Stepper />
          </PageHero>
          <div className="container-narrow" style={{ padding: '2rem 0 4rem' }}>
            <div className="card card-pad">
              <h3 style={{ marginBottom: '1rem' }}>{locale === 'sk' ? 'Zhrnutie objednávky' : 'Booking summary'}</h3>
              {[
                { l: locale === 'sk' ? 'Ambulancia' : 'Clinic', v: localizeField(selectedClinic.name, locale) },
                { l: locale === 'sk' ? 'Typ' : 'Type', v: isTelehealth ? t('booking.telehealthChip') : (locale === 'sk' ? 'Osobná návšteva' : 'In-person visit') },
                { l: locale === 'sk' ? 'Dátum' : 'Date', v: booking.date },
                { l: locale === 'sk' ? 'Čas' : 'Time', v: booking.time },
                { l: locale === 'sk' ? 'Pacient' : 'Patient', v: booking.patientName },
                { l: 'Tel.', v: booking.patientPhone },
              ].map(({ l, v }) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '.5rem 0', fontSize: '.92rem' }}>
                  <span style={{ color: 'var(--ink-2)' }}>{l}</span>
                  <span style={{ fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
            {submitError && (
              <div style={{ marginTop: '1rem', background: 'var(--red-50)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', padding: '.65rem 1rem', color: 'var(--red)', fontSize: '.9rem' }} role="alert">
                <AlertTriangle size={14} style={{ display: 'inline', marginRight: '0.4em' }} />
                {submitError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.5rem' }}>
              <button
                type="submit"
                data-action="confirm"
                className="btn btn-primary btn-lg"
                onClick={handleConfirm}
                disabled={submitting}
              >
                {submitting ? '…' : t('booking.confirm')}
              </button>
              <button className="btn btn-ghost" onClick={() => setStep(4)} disabled={submitting}>
                ← {t('booking.back')}
              </button>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return null;
}
