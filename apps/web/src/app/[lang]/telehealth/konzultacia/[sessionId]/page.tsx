'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff,
  CheckCircle, AlertCircle, Clock, User,
} from 'lucide-react';

const IS_MOCK = process.env.NEXT_PUBLIC_TELEHEALTH_PROVIDER === 'mock';

type RoomState = 'device-check' | 'joining' | 'waiting' | 'active' | 'postcall' | 'error';
type ErrorKind = 'cancelled' | 'no_show' | 'ended' | 'device_denied' | 'network' | 'generic';

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ConsultationRoom() {
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations('room');
  const tError = useTranslations('room.error');
  const sessionId = String(params['sessionId'] ?? '');

  const [roomState, setRoomState] = useState<RoomState>('device-check');
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [summary, setSummary] = useState<{ clinicalNote?: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  // We store the LiveKit Room in a plain ref to avoid including it in state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roomRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const primaryActionRef = useRef<HTMLAnchorElement>(null);
  const endConfirmRef = useRef<HTMLButtonElement>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  // ── State transitions ──────────────────────────────────────────────────────

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

    // Focus management: active→postcall — WCAG 2.4.3
    setTimeout(() => primaryActionRef.current?.focus(), 150);

    // Fetch summary (non-blocking)
    if (!IS_MOCK) {
      try {
        const res = await fetch(`/api/telehealth/sessions/${sessionId}/summary`, { credentials: 'include' });
        if (res.ok) setSummary(await res.json() as { clinicalNote?: string });
      } catch { /* summary is optional in post-call view */ }
    } else {
      setSummary({ clinicalNote: '[Mock summary — clinical note will appear here after the physician saves it]' });
    }
  }, [stopTimer, sessionId, announce, t]);

  // ── LiveKit connection ──────────────────────────────────────────────────────

  const connectLiveKit = useCallback(async (wsUrl: string, token: string) => {
    const { Room, RoomEvent, Track } = await import('livekit-client');
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room.on(RoomEvent.ParticipantConnected, () => {
      // Physician joined — transition to active
      goToActive();
    });

    room.on(RoomEvent.TrackSubscribed, (track: unknown) => {
      const tr = track as { kind: string; attach: (el: HTMLVideoElement) => void };
      if (tr.kind === Track.Kind.Video && remoteVideoRef.current) {
        tr.attach(remoteVideoRef.current);
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      void goToPostcall();
    });

    await room.connect(wsUrl, token);

    // Enable local media and attach self-view
    await room.localParticipant.enableCameraAndMicrophone();
    if (localVideoRef.current) {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      pub?.track?.attach(localVideoRef.current);
    }
  }, [goToActive, goToPostcall]);

  // ── Join session ───────────────────────────────────────────────────────────

  const joinSession = useCallback(async () => {
    setRoomState('joining');

    if (IS_MOCK) {
      setTimeout(() => {
        setRoomState('waiting');
        sessionStorage.setItem('th_room_state', 'waiting');
        announce(t('statusWaiting'));
        // Simulate physician joining after ~4 s in mock mode
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
        if (msg.includes('cancelled')) setErrorKind('cancelled');
        else if (msg.includes('ended')) setErrorKind('ended');
        else if (msg.includes('no_show') || msg.includes('no-show')) setErrorKind('no_show');
        else setErrorKind('generic');
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

  // ── Device check ────────────────────────────────────────────────────────────

  const runDeviceCheck = useCallback(async () => {
    if (sessionStorage.getItem('th_device_ok') === '1') {
      await joinSession();
      return;
    }
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

  // ── Mount: restore or start ─────────────────────────────────────────────────

  useEffect(() => {
    const savedState = sessionStorage.getItem('th_room_state') as RoomState | null;
    const savedStart = sessionStorage.getItem('th_start');

    if (savedState === 'active') {
      // Rejoin after a refresh during an active call
      setRoomState('active');
      if (savedStart) {
        const start = parseInt(savedStart, 10);
        setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
        startTimer();
      }
      void joinSession();
      return;
    }
    if (savedState === 'postcall') {
      setRoomState('postcall');
      return;
    }
    void runDeviceCheck();

    return () => { stopTimer(); };
    // Intentionally run once on mount — sessionId is stable within a page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Escape → end-call confirmation dialog (WCAG 2.1) ───────────────────────

  useEffect(() => {
    if (roomState !== 'active') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showEndDialog) setShowEndDialog(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [roomState, showEndDialog]);

  // Focus trap for end dialog
  useEffect(() => {
    if (showEndDialog) setTimeout(() => endConfirmRef.current?.focus(), 60);
  }, [showEndDialog]);

  // ── Control actions ─────────────────────────────────────────────────────────

  const toggleMic = useCallback(async () => {
    const next = !micOn;
    setMicOn(next);
    if (!IS_MOCK && roomRef.current) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(next);
    }
    announce(next ? t('micOn') : t('micOff'));
  }, [micOn, announce, t]);

  const toggleCam = useCallback(async () => {
    const next = !camOn;
    setCamOn(next);
    if (!IS_MOCK && roomRef.current) {
      await roomRef.current.localParticipant.setCameraEnabled(next);
    }
    announce(next ? t('cameraOn') : t('cameraOff'));
  }, [camOn, announce, t]);

  const toggleScreenShare = useCallback(async () => {
    const next = !screenSharing;
    setScreenSharing(next);
    if (!IS_MOCK && roomRef.current) {
      await roomRef.current.localParticipant.setScreenShareEnabled(next);
    }
    announce(next ? t('screenShareOn') : t('screenShareOff'));
  }, [screenSharing, announce, t]);

  const endCall = useCallback(async () => {
    setShowEndDialog(false);
    if (!IS_MOCK && roomRef.current) {
      try { roomRef.current.disconnect(); } catch { /* ignore */ }
    }
    if (!IS_MOCK) {
      try {
        await fetch(`/api/telehealth/sessions/${sessionId}/end`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch { /* best-effort — session TTL will expire server-side */ }
    }
    await goToPostcall();
  }, [sessionId, goToPostcall]);

  // ── Loading / device check screen ──────────────────────────────────────────

  if (roomState === 'device-check' || roomState === 'joining') {
    return (
      <div className="room" role="main" aria-label={t('loadingLabel')}>
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: '100vh', gap: '1.25rem',
          }}
        >
          <div className="waiting-dots" aria-hidden="true">
            <span /><span /><span />
          </div>
          <p style={{ color: 'rgba(255,255,255,.55)', margin: 0 }}>
            {roomState === 'device-check' ? t('checkingDevice') : t('joiningRoom')}
          </p>
        </div>
      </div>
    );
  }

  // ── Error screen ────────────────────────────────────────────────────────────

  if (roomState === 'error') {
    const kind = errorKind ?? 'generic';
    return (
      <div className="room" role="main">
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '100vh', padding: '2rem',
          }}
        >
          <div
            className="card card-pad"
            style={{
              background: '#1a1d24', border: '1px solid rgba(255,255,255,.08)',
              color: '#e8ecf1', maxWidth: 480, width: '100%', textAlign: 'center',
            }}
          >
            <AlertCircle
              size={48}
              aria-hidden="true"
              style={{ color: 'var(--red)', margin: '0 auto 1rem', display: 'block' }}
            />
            <h2 style={{ color: '#e8ecf1' }}>{tError(`${kind}Title` as Parameters<typeof tError>[0])}</h2>
            <p style={{ color: 'rgba(255,255,255,.6)', marginBottom: '1.75rem' }}>
              {tError(`${kind}Body` as Parameters<typeof tError>[0])}
            </p>
            <a href={`/${locale}/objednanie`} className="btn btn-primary">
              {tError('bookAgain')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Main room ────────────────────────────────────────────────────────────────

  const controlsEnabled = roomState === 'active';

  const statusBadgeClass =
    roomState === 'waiting' ? 'badge-amber' :
    roomState === 'active'  ? 'badge-green' :
    'badge-gray';

  const statusLabel =
    roomState === 'waiting'  ? t('statusWaiting') :
    roomState === 'active'   ? t('statusActive') :
    roomState === 'postcall' ? t('statusPostcall') :
    '';

  return (
    <div className="room" data-state={roomState} data-view="patient" role="main">

      {/* Screen-reader-only aria-live status region (WCAG 4.1.3) */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {statusMsg}
      </div>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="room-bar">
        <span style={{ fontFamily: 'Newsreader, serif', fontWeight: 600, color: '#fff', fontSize: '1.05rem' }}>
          Nemocnica Snina
        </span>
        <div className="room-bar-status">
          <span className={`badge ${statusBadgeClass}`}>
            {roomState === 'waiting' && <span className="dot dot-pulse" aria-hidden="true" />}
            {roomState === 'active'  && <span className="dot" aria-hidden="true" />}
            {statusLabel}
          </span>
          {roomState === 'active' && (
            <span className="room-timer" aria-label={t('elapsed')}>
              <Clock size={14} aria-hidden="true" />
              {formatElapsed(elapsedSeconds)}
            </span>
          )}
        </div>
      </div>

      {/* ── Stage ──────────────────────────────────────────────────────── */}
      <div className="room-stage">

        {/* Waiting overlay */}
        {roomState === 'waiting' && (
          <div className="waiting-overlay" role="status" aria-label={t('statusWaiting')}>
            <div className="waiting-card">
              <div
                className="avatar avatar-lg"
                aria-hidden="true"
                style={{ background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.4)', margin: '0 auto 1rem' }}
              >
                <User size={32} />
              </div>
              <div className="waiting-dots" aria-hidden="true">
                <span /><span /><span />
              </div>
              <h3>{t('waitingTitle')}</h3>
              <p style={{ color: 'rgba(255,255,255,.55)', margin: 0 }}>{t('waitingBody')}</p>
            </div>
          </div>
        )}

        {/* Post-call overlay */}
        {roomState === 'postcall' && (
          <div className="postcall-overlay">
            <div className="postcall-card">
              <CheckCircle
                size={52}
                aria-hidden="true"
                style={{ color: 'var(--green)', margin: '0 auto 1.25rem', display: 'block' }}
              />
              <h3>{t('postcallTitle')}</h3>
              <p style={{ color: 'rgba(255,255,255,.55)', marginBottom: '1.5rem' }}>{t('postcallBody')}</p>

              {summary?.clinicalNote && (
                <div
                  style={{
                    background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                    borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left',
                  }}
                >
                  <p
                    className="eyebrow"
                    style={{ color: 'rgba(255,255,255,.5)', marginBottom: '.5rem' }}
                  >
                    {t('clinicalNoteLabel')}
                  </p>
                  <p style={{ margin: 0, fontSize: '.95rem', color: '#e8ecf1' }}>{summary.clinicalNote}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <a
                  ref={primaryActionRef}
                  href={`/${locale}/portal`}
                  className="btn btn-primary"
                >
                  {t('viewInPortal')}
                </a>
                <a
                  href={`/${locale}/objednanie?mode=telehealth`}
                  className="btn btn-ghost"
                  style={{ borderColor: 'rgba(255,255,255,.2)', color: 'rgba(255,255,255,.8)' }}
                >
                  {t('bookFollowUp')}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Active: physician main tile + self PiP */}
        {roomState === 'active' && (
          <>
            <div className="video-tile video-tile-main" aria-label={t('physicianVideo')}>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#1a1d24' }}
              />
            </div>
            <div className="video-tile video-tile-pip" aria-label={t('selfVideo')}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#252830' }}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div className="room-controls" role="toolbar" aria-label={t('controlsLabel')}>
        <button
          className={`ctrl-btn${!micOn ? ' ctrl-off' : ''}`}
          onClick={() => void toggleMic()}
          disabled={!controlsEnabled}
          aria-pressed={micOn}
          aria-label={micOn ? t('micOn') : t('micOff')}
        >
          {micOn ? <Mic size={22} aria-hidden="true" /> : <MicOff size={22} aria-hidden="true" />}
        </button>

        <button
          className={`ctrl-btn${!camOn ? ' ctrl-off' : ''}`}
          onClick={() => void toggleCam()}
          disabled={!controlsEnabled}
          aria-pressed={camOn}
          aria-label={camOn ? t('cameraOn') : t('cameraOff')}
        >
          {camOn ? <Video size={22} aria-hidden="true" /> : <VideoOff size={22} aria-hidden="true" />}
        </button>

        <button
          className={`ctrl-btn${screenSharing ? ' ctrl-active' : ''}`}
          onClick={() => void toggleScreenShare()}
          disabled={!controlsEnabled}
          aria-pressed={screenSharing}
          aria-label={t('shareScreen')}
        >
          <Monitor size={22} aria-hidden="true" />
        </button>

        <button
          className="ctrl-btn ctrl-end"
          onClick={() => setShowEndDialog(true)}
          disabled={!controlsEnabled}
          aria-label={t('endCall')}
        >
          <PhoneOff size={22} aria-hidden="true" />
        </button>
      </div>

      {/* ── End-call confirmation dialog ─────────────────────────────────── */}
      {showEndDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-dialog-title"
          className="dialog-overlay"
        >
          <div className="dialog-box">
            <h4 id="end-dialog-title">{t('endCallTitle')}</h4>
            <p style={{ color: 'rgba(255,255,255,.6)', marginBottom: '1.25rem' }}>{t('endCallBody')}</p>
            <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ borderColor: 'rgba(255,255,255,.2)', color: 'rgba(255,255,255,.8)' }}
                onClick={() => setShowEndDialog(false)}
              >
                {t('endCallCancel')}
              </button>
              <button
                ref={endConfirmRef}
                className="btn btn-emergency btn-sm"
                onClick={() => void endCall()}
              >
                {t('endCallConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
