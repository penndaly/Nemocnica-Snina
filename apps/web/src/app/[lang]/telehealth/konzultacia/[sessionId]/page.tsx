'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff,
  CheckCircle, AlertCircle, Clock, User, ShieldCheck,
  ChevronRight, FileText, UserCheck,
} from 'lucide-react';

const IS_MOCK = process.env.NEXT_PUBLIC_TELEHEALTH_PROVIDER === 'mock';

type RoomState = 'device-check' | 'joining' | 'waiting' | 'active' | 'postcall' | 'error';
type ErrorKind = 'cancelled' | 'no_show' | 'ended' | 'device_denied' | 'network' | 'generic';

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Patient Room ─────────────────────────────────────────────────────────────

function PatientRoom({ sessionId }: { sessionId: string }) {
  const locale = useLocale();
  const t      = useTranslations('room');
  const tError = useTranslations('room.error');

  const [roomState, setRoomState]   = useState<RoomState>('device-check');
  const [errorKind, setErrorKind]   = useState<ErrorKind | null>(null);
  const [micOn,     setMicOn]       = useState(true);
  const [camOn,     setCamOn]       = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [summary, setSummary]       = useState<{ clinicalNote?: string } | null>(null);
  const [statusMsg, setStatusMsg]   = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roomRef        = useRef<any>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const primaryActionRef = useRef<HTMLAnchorElement>(null);
  const endConfirmRef  = useRef<HTMLButtonElement>(null);

  const announce = useCallback((msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 4000);
  }, []);

  const startTimer = useCallback(() => {
    if (!sessionStorage.getItem('th_start')) {
      sessionStorage.setItem('th_start', String(Date.now()));
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const start = parseInt(sessionStorage.getItem('th_start') ?? '0', 10);
      if (start) setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const goToActive = useCallback(() => {
    setRoomState('active');
    sessionStorage.setItem('th_room_state', 'active');
    announce(t('statusActive'));
    startTimer();
  }, [announce, startTimer, t]);

  const goToPostcall = useCallback(async () => {
    stopTimer();
    setRoomState('postcall');
    sessionStorage.setItem('th_room_state', 'postcall');
    sessionStorage.removeItem('th_start');
    announce(t('statusPostcall'));
    setTimeout(() => primaryActionRef.current?.focus(), 150);

    if (!IS_MOCK) {
      try {
        const res = await fetch(`/api/telehealth/sessions/${sessionId}/summary`, { credentials: 'include' });
        if (res.ok) setSummary(await res.json() as { clinicalNote?: string });
      } catch { /* summary is optional */ }
    } else {
      setSummary({ clinicalNote: '[Mock summary — clinical note will appear here after the physician saves it]' });
    }
  }, [stopTimer, sessionId, announce, t]);

  const connectLiveKit = useCallback(async (wsUrl: string, token: string) => {
    const { Room, RoomEvent, Track } = await import('livekit-client');
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room.on(RoomEvent.ParticipantConnected, () => { goToActive(); });
    room.on(RoomEvent.TrackSubscribed, (track: unknown) => {
      const tr = track as { kind: string; attach: (el: HTMLVideoElement) => void };
      if (tr.kind === Track.Kind.Video && remoteVideoRef.current) tr.attach(remoteVideoRef.current);
    });
    room.on(RoomEvent.Disconnected, () => { void goToPostcall(); });

    await room.connect(wsUrl, token);
    await room.localParticipant.enableCameraAndMicrophone();
    if (localVideoRef.current) {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      pub?.track?.attach(localVideoRef.current);
    }
  }, [goToActive, goToPostcall]);

  const joinSession = useCallback(async () => {
    setRoomState('joining');
    if (IS_MOCK) {
      setTimeout(() => {
        setRoomState('waiting');
        sessionStorage.setItem('th_room_state', 'waiting');
        announce(t('statusWaiting'));
        setTimeout(() => goToActive(), 4000);
      }, 600);
      return;
    }
    try {
      const res = await fetch(`/api/telehealth/sessions/${sessionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'patient' }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        const msg = (err.message ?? '').toLowerCase();
        setErrorKind(msg.includes('cancelled') ? 'cancelled' : msg.includes('ended') ? 'ended' : msg.includes('no_show') ? 'no_show' : 'generic');
        setRoomState('error');
        return;
      }
      const { token, wsUrl } = (await res.json()) as { token: string; wsUrl: string };
      setRoomState('waiting');
      sessionStorage.setItem('th_room_state', 'waiting');
      announce(t('statusWaiting'));
      await connectLiveKit(wsUrl, token);
    } catch {
      setErrorKind('network');
      setRoomState('error');
    }
  }, [sessionId, announce, t, goToActive, connectLiveKit]);

  const runDeviceCheck = useCallback(async () => {
    if (sessionStorage.getItem('th_device_ok') === '1') { await joinSession(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((tr) => tr.stop());
      sessionStorage.setItem('th_device_ok', '1');
      await joinSession();
    } catch {
      setErrorKind('device_denied');
      setRoomState('error');
    }
  }, [joinSession]);

  useEffect(() => {
    const savedState = sessionStorage.getItem('th_room_state') as RoomState | null;
    const savedStart = sessionStorage.getItem('th_start');
    if (savedState === 'active') {
      setRoomState('active');
      if (savedStart) {
        const start = parseInt(savedStart, 10);
        setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
        startTimer();
      }
      void joinSession();
      return;
    }
    if (savedState === 'postcall') { setRoomState('postcall'); return; }
    void runDeviceCheck();
    return () => { stopTimer(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (roomState !== 'active') return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showEndDialog) setShowEndDialog(true); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [roomState, showEndDialog]);

  useEffect(() => {
    if (showEndDialog) setTimeout(() => endConfirmRef.current?.focus(), 60);
  }, [showEndDialog]);

  const toggleMic = useCallback(async () => {
    const next = !micOn;
    setMicOn(next);
    if (!IS_MOCK && roomRef.current) await roomRef.current.localParticipant.setMicrophoneEnabled(next);
    announce(next ? t('micOn') : t('micOff'));
  }, [micOn, announce, t]);

  const toggleCam = useCallback(async () => {
    const next = !camOn;
    setCamOn(next);
    if (!IS_MOCK && roomRef.current) await roomRef.current.localParticipant.setCameraEnabled(next);
    announce(next ? t('cameraOn') : t('cameraOff'));
  }, [camOn, announce, t]);

  const toggleScreenShare = useCallback(async () => {
    const next = !screenSharing;
    setScreenSharing(next);
    if (!IS_MOCK && roomRef.current) await roomRef.current.localParticipant.setScreenShareEnabled(next);
    announce(next ? t('screenShareOn') : t('screenShareOff'));
  }, [screenSharing, announce, t]);

  const endCall = useCallback(async () => {
    setShowEndDialog(false);
    if (!IS_MOCK && roomRef.current) { try { roomRef.current.disconnect(); } catch { /* ignore */ } }
    if (!IS_MOCK) {
      try { await fetch(`/api/telehealth/sessions/${sessionId}/end`, { method: 'POST', credentials: 'include' }); }
      catch { /* best-effort */ }
    }
    await goToPostcall();
  }, [sessionId, goToPostcall]);

  if (roomState === 'device-check' || roomState === 'joining') {
    return (
      <div className="room" role="main" aria-label={t('loadingLabel')}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1.25rem' }}>
          <div className="waiting-dots" aria-hidden="true"><span /><span /><span /></div>
          <p style={{ color: 'rgba(255,255,255,.55)', margin: 0 }}>
            {roomState === 'device-check' ? t('checkingDevice') : t('joiningRoom')}
          </p>
        </div>
      </div>
    );
  }

  if (roomState === 'error') {
    const kind = errorKind ?? 'generic';
    return (
      <div className="room" role="main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
          <div className="card card-pad" style={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,.08)', color: '#e8ecf1', maxWidth: 480, width: '100%', textAlign: 'center' }}>
            <AlertCircle size={48} aria-hidden="true" style={{ color: 'var(--red)', margin: '0 auto 1rem', display: 'block' }} />
            <h2 style={{ color: '#e8ecf1' }}>{tError(`${kind}Title` as Parameters<typeof tError>[0])}</h2>
            <p style={{ color: 'rgba(255,255,255,.6)', marginBottom: '1.75rem' }}>{tError(`${kind}Body` as Parameters<typeof tError>[0])}</p>
            <a href={`/${locale}/objednanie`} className="btn btn-primary">{tError('bookAgain')}</a>
          </div>
        </div>
      </div>
    );
  }

  const controlsEnabled = roomState === 'active';
  const statusBadgeClass = roomState === 'waiting' ? 'badge-amber' : roomState === 'active' ? 'badge-green' : 'badge-gray';
  const statusLabel = roomState === 'waiting' ? t('statusWaiting') : roomState === 'active' ? t('statusActive') : roomState === 'postcall' ? t('statusPostcall') : '';

  return (
    <div className="room" data-state={roomState} data-view="patient" role="main">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{statusMsg}</div>
      <div className="room-bar">
        <span style={{ fontFamily: 'Newsreader, serif', fontWeight: 600, color: '#fff', fontSize: '1.05rem' }}>Nemocnica Snina</span>
        <div className="room-bar-status">
          <span className={`badge ${statusBadgeClass}`}>
            {roomState === 'waiting' && <span className="dot dot-pulse" aria-hidden="true" />}
            {roomState === 'active'  && <span className="dot" aria-hidden="true" />}
            {statusLabel}
          </span>
          {roomState === 'active' && (
            <span className="room-timer" aria-label={t('elapsed')}>
              <Clock size={14} aria-hidden="true" />{formatElapsed(elapsedSeconds)}
            </span>
          )}
        </div>
      </div>
      <div className="room-stage">
        {roomState === 'waiting' && (
          <div className="waiting-overlay" role="status" aria-label={t('statusWaiting')}>
            <div className="waiting-card">
              <div className="avatar avatar-lg" aria-hidden="true" style={{ background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.4)', margin: '0 auto 1rem' }}>
                <User size={32} />
              </div>
              <div className="waiting-dots" aria-hidden="true"><span /><span /><span /></div>
              <h3>{t('waitingTitle')}</h3>
              <p style={{ color: 'rgba(255,255,255,.55)', margin: 0 }}>{t('waitingBody')}</p>
            </div>
          </div>
        )}
        {roomState === 'postcall' && (
          <div className="postcall-overlay">
            <div className="postcall-card">
              <CheckCircle size={52} aria-hidden="true" style={{ color: 'var(--green)', margin: '0 auto 1.25rem', display: 'block' }} />
              <h3>{t('postcallTitle')}</h3>
              <p style={{ color: 'rgba(255,255,255,.55)', marginBottom: '1.5rem' }}>{t('postcallBody')}</p>
              {summary?.clinicalNote && (
                <div style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                  <p className="eyebrow" style={{ color: 'rgba(255,255,255,.5)', marginBottom: '.5rem' }}>{t('clinicalNoteLabel')}</p>
                  <p style={{ margin: 0, fontSize: '.95rem', color: '#e8ecf1' }}>{summary.clinicalNote}</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <a ref={primaryActionRef} href={`/${locale}/portal`} className="btn btn-primary">{t('viewInPortal')}</a>
                <a href={`/${locale}/objednanie?mode=telehealth`} className="btn btn-ghost" style={{ borderColor: 'rgba(255,255,255,.2)', color: 'rgba(255,255,255,.8)' }}>{t('bookFollowUp')}</a>
              </div>
            </div>
          </div>
        )}
        {roomState === 'active' && (
          <>
            <div className="video-tile video-tile-main" aria-label={t('physicianVideo')}>
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#1a1d24' }} />
            </div>
            <div className="video-tile video-tile-pip" aria-label={t('selfVideo')}>
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#252830' }} />
            </div>
          </>
        )}
      </div>
      <div className="room-controls" role="toolbar" aria-label={t('controlsLabel')}>
        <button className={`ctrl-btn${!micOn ? ' ctrl-off' : ''}`} onClick={() => void toggleMic()} disabled={!controlsEnabled} aria-pressed={micOn} aria-label={micOn ? t('micOn') : t('micOff')}>
          {micOn ? <Mic size={22} aria-hidden="true" /> : <MicOff size={22} aria-hidden="true" />}
        </button>
        <button className={`ctrl-btn${!camOn ? ' ctrl-off' : ''}`} onClick={() => void toggleCam()} disabled={!controlsEnabled} aria-pressed={camOn} aria-label={camOn ? t('cameraOn') : t('cameraOff')}>
          {camOn ? <Video size={22} aria-hidden="true" /> : <VideoOff size={22} aria-hidden="true" />}
        </button>
        <button className={`ctrl-btn${screenSharing ? ' ctrl-active' : ''}`} onClick={() => void toggleScreenShare()} disabled={!controlsEnabled} aria-pressed={screenSharing} aria-label={t('shareScreen')}>
          <Monitor size={22} aria-hidden="true" />
        </button>
        <button className="ctrl-btn ctrl-end" onClick={() => setShowEndDialog(true)} disabled={!controlsEnabled} aria-label={t('endCall')}>
          <PhoneOff size={22} aria-hidden="true" />
        </button>
      </div>
      {showEndDialog && (
        <div role="dialog" aria-modal="true" aria-labelledby="end-dialog-title" className="dialog-overlay">
          <div className="dialog-box">
            <h4 id="end-dialog-title">{t('endCallTitle')}</h4>
            <p style={{ color: 'rgba(255,255,255,.6)', marginBottom: '1.25rem' }}>{t('endCallBody')}</p>
            <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" style={{ borderColor: 'rgba(255,255,255,.2)', color: 'rgba(255,255,255,.8)' }} onClick={() => setShowEndDialog(false)}>
                {t('endCallCancel')}
              </button>
              <button ref={endConfirmRef} className="btn btn-emergency btn-sm" onClick={() => void endCall()}>
                {t('endCallConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Physician Room ───────────────────────────────────────────────────────────

interface IntakeData {
  reason?: string;
  currentMedications?: string;
  symptoms?: string;
  vitalsNote?: string;
}

type PhysicianRoomState = 'mfa' | 'joining' | 'waiting-patient' | 'active' | 'postcall' | 'error';

function PhysicianRoom({ sessionId }: { sessionId: string }) {
  const locale = useLocale();
  const t      = useTranslations('room');
  const tPh    = useTranslations('room.physician');

  const [phase,          setPhase]          = useState<PhysicianRoomState>('mfa');
  const [totpCode,       setTotpCode]       = useState('');
  const [mfaError,       setMfaError]       = useState('');
  const [adminToken,     setAdminToken]     = useState('');
  const [intake,         setIntake]         = useState<IntakeData | null>(null);
  const [admitState,     setAdmitState]     = useState<'idle' | 'busy' | 'done'>('idle');
  const [micOn,          setMicOn]          = useState(true);
  const [camOn,          setCamOn]          = useState(true);
  const [screenSharing,  setScreenSharing]  = useState(false);
  const [showEndDialog,  setShowEndDialog]  = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [clinicalNote,   setClinicalNote]   = useState('');
  const [followUp,       setFollowUp]       = useState('');
  const [prescriptionIssued, setPrescriptionIssued] = useState(false);
  const [saveState,      setSaveState]      = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [statusMsg,      setStatusMsg]      = useState('');
  const [showIntakePanel, setShowIntakePanel] = useState(true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roomRef        = useRef<any>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const totpRef        = useRef<HTMLInputElement>(null);
  const endConfirmRef  = useRef<HTMLButtonElement>(null);

  const announce = useCallback((msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 4000);
  }, []);

  const startTimer = useCallback(() => {
    if (!sessionStorage.getItem('th_dr_start')) sessionStorage.setItem('th_dr_start', String(Date.now()));
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const start = parseInt(sessionStorage.getItem('th_dr_start') ?? '0', 10);
      if (start) setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Read admin JWT from sessionStorage on mount
  useEffect(() => {
    const token = sessionStorage.getItem('ns_admin_token') ?? '';
    setAdminToken(token);
    setTimeout(() => totpRef.current?.focus(), 100);
    return () => { stopTimer(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'active') return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showEndDialog) setShowEndDialog(true); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, showEndDialog]);

  useEffect(() => {
    if (showEndDialog) setTimeout(() => endConfirmRef.current?.focus(), 60);
  }, [showEndDialog]);

  const connectLiveKit = useCallback(async (wsUrl: string, token: string) => {
    const { Room, RoomEvent, Track } = await import('livekit-client');
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room.on(RoomEvent.ParticipantConnected, () => {
      // Patient joined the room — show active state
      setPhase('active');
      sessionStorage.setItem('th_dr_room_state', 'active');
      announce(t('statusActive'));
      startTimer();
    });
    room.on(RoomEvent.TrackSubscribed, (track: unknown) => {
      const tr = track as { kind: string; attach: (el: HTMLVideoElement) => void };
      if (tr.kind === Track.Kind.Video && remoteVideoRef.current) tr.attach(remoteVideoRef.current);
    });
    room.on(RoomEvent.Disconnected, () => {
      stopTimer();
      setPhase('postcall');
    });

    await room.connect(wsUrl, token);
    await room.localParticipant.enableCameraAndMicrophone();
    if (localVideoRef.current) {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      pub?.track?.attach(localVideoRef.current);
    }
  }, [announce, startTimer, stopTimer, t]);

  // MFA verify + join
  const verifyAndJoin = useCallback(async () => {
    if (totpCode.length < 6) return;
    setPhase('joining');
    setMfaError('');

    if (IS_MOCK) {
      // Skip MFA in mock mode
      setPhase('waiting-patient');
      setIntake({ reason: 'Mock: Elevated blood pressure', currentMedications: 'Nebivolol 5mg', symptoms: 'Headache, fatigue', vitalsNote: 'BP 140/90 self-measured' });
      return;
    }

    try {
      const res = await fetch(`/api/telehealth/sessions/${sessionId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ role: 'physician', totpCode }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        const msg = (err.message ?? '').toLowerCase();
        if (msg.includes('totp') || msg.includes('mfa') || msg.includes('invalid')) {
          setMfaError(tPh('mfaInvalid'));
          setPhase('mfa');
        } else {
          setPhase('error');
        }
        return;
      }

      const { token, wsUrl } = (await res.json()) as { token: string; wsUrl: string };
      setPhase('waiting-patient');
      sessionStorage.setItem('th_dr_room_state', 'waiting-patient');

      // Fetch intake in background (non-blocking)
      fetch(`/api/telehealth/sessions/${sessionId}/intake`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((r) => r.ok ? r.json() as Promise<IntakeData> : null)
        .then((d) => { if (d) setIntake(d); })
        .catch(() => {});

      await connectLiveKit(wsUrl, token);
    } catch {
      setPhase('error');
    }
  }, [sessionId, adminToken, totpCode, connectLiveKit, tPh]);

  const admitPatient = useCallback(async () => {
    setAdmitState('busy');
    if (IS_MOCK) {
      setTimeout(() => { setAdmitState('done'); setPhase('active'); startTimer(); }, 800);
      return;
    }
    try {
      const res = await fetch(`/api/telehealth/sessions/${sessionId}/admit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        setAdmitState('done');
        setPhase('active');
        startTimer();
      } else {
        setAdmitState('idle');
      }
    } catch {
      setAdmitState('idle');
    }
  }, [sessionId, adminToken, startTimer]);

  const toggleMic = useCallback(async () => {
    const next = !micOn;
    setMicOn(next);
    if (!IS_MOCK && roomRef.current) await roomRef.current.localParticipant.setMicrophoneEnabled(next);
    announce(next ? t('micOn') : t('micOff'));
  }, [micOn, announce, t]);

  const toggleCam = useCallback(async () => {
    const next = !camOn;
    setCamOn(next);
    if (!IS_MOCK && roomRef.current) await roomRef.current.localParticipant.setCameraEnabled(next);
    announce(next ? t('cameraOn') : t('cameraOff'));
  }, [camOn, announce, t]);

  const toggleScreenShare = useCallback(async () => {
    const next = !screenSharing;
    setScreenSharing(next);
    if (!IS_MOCK && roomRef.current) await roomRef.current.localParticipant.setScreenShareEnabled(next);
    announce(next ? t('screenShareOn') : t('screenShareOff'));
  }, [screenSharing, announce, t]);

  const endCall = useCallback(async () => {
    setShowEndDialog(false);
    if (!IS_MOCK && roomRef.current) { try { roomRef.current.disconnect(); } catch { /* ignore */ } }
    stopTimer();
    setPhase('postcall');
    sessionStorage.setItem('th_dr_room_state', 'postcall');
    sessionStorage.removeItem('th_dr_start');
  }, [stopTimer]);

  const saveToHis = useCallback(async () => {
    setSaveState('busy');
    if (IS_MOCK) { setTimeout(() => setSaveState('done'), 1000); return; }
    try {
      const res = await fetch(`/api/telehealth/sessions/${sessionId}/save-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ clinicalNote, followUpRecommendationSk: followUp, prescriptionIssued }),
      });
      setSaveState(res.ok ? 'done' : 'error');
    } catch {
      setSaveState('error');
    }
  }, [sessionId, adminToken, clinicalNote, followUp, prescriptionIssued]);

  // ── MFA screen ─────────────────────────────────────────────────────────────

  if (phase === 'mfa' || phase === 'joining') {
    return (
      <div className="room" role="main" aria-labelledby="mfa-title">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
          <div className="card card-pad" style={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,.1)', color: '#e8ecf1', maxWidth: 400, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1.25rem' }}>
              <ShieldCheck size={28} color="var(--blue-400)" aria-hidden="true" />
              <h2 id="mfa-title" style={{ color: '#fff', margin: 0, fontSize: '1.2rem' }}>{tPh('mfaTitle')}</h2>
            </div>
            <p style={{ color: 'rgba(255,255,255,.55)', marginBottom: '1.25rem', fontSize: '.9rem' }}>{tPh('mfaBody')}</p>
            {mfaError && (
              <p role="alert" style={{ color: 'var(--red)', background: 'rgba(200,50,50,.1)', borderRadius: 6, padding: '.5rem .75rem', marginBottom: '1rem', fontSize: '.88rem' }}>
                {mfaError}
              </p>
            )}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.5)', fontFamily: 'Mulish, sans-serif', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {tPh('mfaLabel')}
              </span>
              <input
                ref={totpRef}
                type="text"
                inputMode="numeric"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                aria-label={tPh('mfaLabel')}
                disabled={phase === 'joining'}
                onKeyDown={(e) => { if (e.key === 'Enter') void verifyAndJoin(); }}
                style={{ width: '100%', padding: '.6rem .75rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, color: '#e8ecf1', fontSize: '1.2rem', fontFamily: 'monospace', letterSpacing: '.2em', textAlign: 'center' }}
              />
            </label>
            <button
              className="btn btn-primary btn-block"
              onClick={() => void verifyAndJoin()}
              disabled={totpCode.length < 6 || phase === 'joining'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}
            >
              {phase === 'joining' ? (
                <><span className="waiting-dots" aria-hidden="true" style={{ display: 'inline-flex', gap: 3 }}><span /><span /><span /></span> {locale === 'sk' ? 'Overujem…' : 'Verifying…'}</>
              ) : (
                <><ChevronRight size={16} aria-hidden="true" /> {tPh('mfaVerify')}</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Error screen ────────────────────────────────────────────────────────────

  if (phase === 'error') {
    return (
      <div className="room" role="main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
          <div className="card card-pad" style={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,.08)', color: '#e8ecf1', maxWidth: 480, width: '100%', textAlign: 'center' }}>
            <AlertCircle size={48} aria-hidden="true" style={{ color: 'var(--red)', margin: '0 auto 1rem', display: 'block' }} />
            <h2 style={{ color: '#e8ecf1' }}>{locale === 'sk' ? 'Chyba pripojenia' : 'Connection error'}</h2>
            <p style={{ color: 'rgba(255,255,255,.6)', marginBottom: '1.75rem' }}>
              {locale === 'sk' ? 'Nepodarilo sa pripojiť k videokonzultácii.' : 'Could not connect to the video consultation.'}
            </p>
            <a href="/admin/telehealth" className="btn btn-primary">{locale === 'sk' ? 'Späť do plánu' : 'Back to schedule'}</a>
          </div>
        </div>
      </div>
    );
  }

  // ── Post-call screen (physician) ─────────────────────────────────────────────

  if (phase === 'postcall') {
    return (
      <div className="room" data-state="postcall" data-view="physician" role="main">
        <div className="room-bar">
          <span style={{ fontFamily: 'Newsreader, serif', fontWeight: 600, color: '#fff', fontSize: '1.05rem' }}>Nemocnica Snina</span>
          <span className="badge badge-gray">{locale === 'sk' ? 'Konzultácia ukončená' : 'Consultation ended'}</span>
        </div>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
          <div className="card card-pad" style={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,.08)' }}>
            <CheckCircle size={40} aria-hidden="true" style={{ color: 'var(--green)', marginBottom: '1rem', display: 'block' }} />
            <h2 style={{ color: '#fff', marginBottom: '1.5rem' }}>{tPh('postcallTitle')}</h2>

            {/* Clinical note */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '.8rem', color: 'rgba(255,255,255,.5)', fontFamily: 'Mulish, sans-serif', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '.4rem' }}>
                {t('clinicalNoteLabel')}
              </label>
              <textarea
                value={clinicalNote}
                onChange={(e) => setClinicalNote(e.target.value)}
                placeholder={tPh('clinicalNotePlaceholder')}
                rows={5}
                aria-label={t('clinicalNoteLabel')}
                style={{ width: '100%', padding: '.65rem .75rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, color: '#e8ecf1', fontSize: '.92rem', fontFamily: 'Mulish, sans-serif', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {/* Follow-up */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '.8rem', color: 'rgba(255,255,255,.5)', fontFamily: 'Mulish, sans-serif', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '.4rem' }}>
                {tPh('followUpLabel')}
              </label>
              <input
                type="text"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                aria-label={tPh('followUpLabel')}
                placeholder={locale === 'sk' ? 'Napr. Kontrola za 2 týždne' : 'E.g. Follow-up in 2 weeks'}
                style={{ width: '100%', padding: '.55rem .75rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, color: '#e8ecf1', fontSize: '.92rem', boxSizing: 'border-box' }}
              />
            </div>

            {/* Prescription toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '1.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={prescriptionIssued}
                onChange={(e) => setPrescriptionIssued(e.target.checked)}
                aria-label={tPh('prescriptionIssuedLabel')}
              />
              <span style={{ color: '#e8ecf1', fontSize: '.9rem' }}>{tPh('prescriptionIssuedLabel')}</span>
            </label>

            {/* Save button */}
            <button
              className="btn btn-primary btn-block"
              onClick={() => void saveToHis()}
              disabled={saveState === 'busy' || saveState === 'done'}
              aria-live="polite"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}
            >
              {saveState === 'idle'  && <><FileText size={16} aria-hidden="true" /> {tPh('saveHisBtn')}</>}
              {saveState === 'busy'  && tPh('hisSaving')}
              {saveState === 'done'  && <><CheckCircle size={16} aria-hidden="true" /> {tPh('hisSaved')}</>}
              {saveState === 'error' && tPh('hisFailed')}
            </button>
            {saveState === 'done' && (
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <a href="/admin/telehealth" style={{ color: 'rgba(255,255,255,.5)', fontSize: '.85rem' }}>
                  {locale === 'sk' ? 'Späť do plánu konzultácií' : 'Back to schedule'}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting for patient + Active call ────────────────────────────────────────

  const controlsEnabled = phase === 'active';
  const statusLabel = phase === 'waiting-patient'
    ? tPh('statusWaitingPatient')
    : phase === 'active' ? t('statusActive') : '';
  const statusBadgeClass = phase === 'waiting-patient' ? 'badge-amber' : phase === 'active' ? 'badge-green' : 'badge-gray';

  return (
    <div className="room" data-state={phase} data-view="physician" role="main">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{statusMsg}</div>

      {/* Top bar */}
      <div className="room-bar">
        <span style={{ fontFamily: 'Newsreader, serif', fontWeight: 600, color: '#fff', fontSize: '1.05rem' }}>Nemocnica Snina</span>
        <div className="room-bar-status">
          <span className={`badge ${statusBadgeClass}`}>
            {phase === 'waiting-patient' && <span className="dot dot-pulse" aria-hidden="true" />}
            {phase === 'active' && <span className="dot" aria-hidden="true" />}
            {statusLabel}
          </span>
          {phase === 'active' && (
            <span className="room-timer" aria-label={t('elapsed')}>
              <Clock size={14} aria-hidden="true" />{formatElapsed(elapsedSeconds)}
            </span>
          )}
          {/* Intake panel toggle */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowIntakePanel((p) => !p)}
            aria-pressed={showIntakePanel}
            aria-label={showIntakePanel ? (locale === 'sk' ? 'Skryť dotazník' : 'Hide intake') : (locale === 'sk' ? 'Zobraziť dotazník' : 'Show intake')}
            style={{ borderColor: 'rgba(255,255,255,.2)', color: 'rgba(255,255,255,.8)', marginLeft: '.5rem' }}
          >
            <FileText size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main content: stage + side panel */}
      <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 56px - 72px)', overflow: 'hidden' }}>

        {/* Stage */}
        <div className="room-stage" style={{ flex: 1, position: 'relative' }}>

          {/* Waiting for patient overlay */}
          {phase === 'waiting-patient' && (
            <div className="waiting-overlay" role="status" aria-label={tPh('admitWaiting')}>
              <div className="waiting-card">
                <div className="avatar avatar-lg" aria-hidden="true" style={{ background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.4)', margin: '0 auto 1rem' }}>
                  <UserCheck size={32} />
                </div>
                <div className="waiting-dots" aria-hidden="true"><span /><span /><span /></div>
                <h3>{tPh('admitWaiting')}</h3>
                <p style={{ color: 'rgba(255,255,255,.55)', marginBottom: '1.5rem' }}>
                  {locale === 'sk' ? 'Akonáhle sa pacient pripojí, vpustite ho do miestnosti.' : 'Once the patient connects, admit them to the room.'}
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => void admitPatient()}
                  disabled={admitState === 'busy'}
                  aria-live="polite"
                  style={{ display: 'flex', alignItems: 'center', gap: '.5rem', margin: '0 auto' }}
                >
                  <UserCheck size={16} aria-hidden="true" />
                  {admitState === 'busy' ? (locale === 'sk' ? 'Vpúšťam…' : 'Admitting…') : tPh('admitBtn')}
                </button>
              </div>
            </div>
          )}

          {/* Active: patient main tile + self PiP */}
          {phase === 'active' && (
            <>
              <div className="video-tile video-tile-main" aria-label={tPh('patientVideo')}>
                <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#1a1d24' }} />
              </div>
              <div className="video-tile video-tile-pip" aria-label={t('selfVideo')}>
                <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#252830' }} />
              </div>
            </>
          )}
        </div>

        {/* Intake side panel */}
        {showIntakePanel && (
          <aside
            aria-label={tPh('intakePanelTitle')}
            style={{
              width: 280, background: '#141d27', borderLeft: '1px solid rgba(255,255,255,.08)',
              overflowY: 'auto', padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem',
            }}
          >
            <h3 style={{ color: '#e8ecf1', margin: 0, fontSize: '1rem', fontFamily: 'Mulish, sans-serif' }}>
              {tPh('intakePanelTitle')}
            </h3>
            {!intake ? (
              <p style={{ color: 'rgba(255,255,255,.4)', fontSize: '.85rem' }}>{tPh('noIntake')}</p>
            ) : (
              <>
                {intake.reason && (
                  <div>
                    <p style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.35)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 0 .3rem' }}>{tPh('reasonLabel')}</p>
                    <p style={{ color: '#c8d5e8', fontSize: '.88rem', margin: 0 }}>{intake.reason}</p>
                  </div>
                )}
                {intake.symptoms && (
                  <div>
                    <p style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.35)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 0 .3rem' }}>{tPh('symptomsLabel')}</p>
                    <p style={{ color: '#c8d5e8', fontSize: '.88rem', margin: 0 }}>{intake.symptoms}</p>
                  </div>
                )}
                {intake.currentMedications && (
                  <div>
                    <p style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.35)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 0 .3rem' }}>{tPh('medicationsLabel')}</p>
                    <p style={{ color: '#c8d5e8', fontSize: '.88rem', margin: 0 }}>{intake.currentMedications}</p>
                  </div>
                )}
                {intake.vitalsNote && (
                  <div>
                    <p style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.35)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 0 .3rem' }}>{tPh('vitalsLabel')}</p>
                    <p style={{ color: '#c8d5e8', fontSize: '.88rem', margin: 0 }}>{intake.vitalsNote}</p>
                  </div>
                )}
              </>
            )}
          </aside>
        )}
      </div>

      {/* Controls */}
      <div className="room-controls" role="toolbar" aria-label={t('controlsLabel')}>
        <button className={`ctrl-btn${!micOn ? ' ctrl-off' : ''}`} onClick={() => void toggleMic()} disabled={!controlsEnabled} aria-pressed={micOn} aria-label={micOn ? t('micOn') : t('micOff')}>
          {micOn ? <Mic size={22} aria-hidden="true" /> : <MicOff size={22} aria-hidden="true" />}
        </button>
        <button className={`ctrl-btn${!camOn ? ' ctrl-off' : ''}`} onClick={() => void toggleCam()} disabled={!controlsEnabled} aria-pressed={camOn} aria-label={camOn ? t('cameraOn') : t('cameraOff')}>
          {camOn ? <Video size={22} aria-hidden="true" /> : <VideoOff size={22} aria-hidden="true" />}
        </button>
        <button className={`ctrl-btn${screenSharing ? ' ctrl-active' : ''}`} onClick={() => void toggleScreenShare()} disabled={!controlsEnabled} aria-pressed={screenSharing} aria-label={t('shareScreen')}>
          <Monitor size={22} aria-hidden="true" />
        </button>
        <button className="ctrl-btn ctrl-end" onClick={() => setShowEndDialog(true)} disabled={!controlsEnabled} aria-label={t('endCall')}>
          <PhoneOff size={22} aria-hidden="true" />
        </button>
      </div>

      {/* End-call dialog */}
      {showEndDialog && (
        <div role="dialog" aria-modal="true" aria-labelledby="dr-end-dialog-title" className="dialog-overlay">
          <div className="dialog-box">
            <h4 id="dr-end-dialog-title">{t('endCallTitle')}</h4>
            <p style={{ color: 'rgba(255,255,255,.6)', marginBottom: '1.25rem' }}>
              {locale === 'sk' ? 'Toto ukončí videohovor. Zhrnutie konzultácie budete môcť uložiť.' : 'This will end the video call. You will be able to save the consultation summary.'}
            </p>
            <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" style={{ borderColor: 'rgba(255,255,255,.2)', color: 'rgba(255,255,255,.8)' }} onClick={() => setShowEndDialog(false)}>
                {t('endCallCancel')}
              </button>
              <button ref={endConfirmRef} className="btn btn-emergency btn-sm" onClick={() => void endCall()}>
                {t('endCallConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root: dispatch to patient or physician room ───────────────────────────────

export default function ConsultationRoom() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const sessionId    = String(params['sessionId'] ?? '');
  const role         = searchParams.get('role') ?? 'patient';

  if (role === 'physician') return <PhysicianRoom sessionId={sessionId} />;
  return <PatientRoom sessionId={sessionId} />;
}
