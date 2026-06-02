'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Plus, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '@/components/admin/AdminAuthContext';

function LoginForm() {
  const { login, isAuthenticated } = useAdminAuth();
  const router = useRouter();

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp]       = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    router.replace('/admin/departments');
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, totp);
      router.replace('/admin/departments');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prihlásenie zlyhalo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a1220',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#131e2b',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '2rem',
            background: 'linear-gradient(135deg, #1e5290 0%, #14375f 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '.75rem',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'rgba(255,255,255,.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Lock size={24} color="white" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h1
              style={{
                fontFamily: 'Newsreader, serif',
                color: '#fff',
                fontSize: '1.4rem',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Správa obsahu
            </h1>
            <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '.83rem', margin: '.3rem 0 0' }}>
              Nemocnica Snina — redakčný systém
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.75rem' }}>
          {/* Email */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="admin-email"
              style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.45)', marginBottom: '.4rem' }}
            >
              E-mail
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%',
                background: 'rgba(255,255,255,.06)',
                border: '1.5px solid rgba(255,255,255,.12)',
                borderRadius: 9,
                padding: '.65em .9em',
                color: '#e8f0fb',
                fontSize: '1rem',
                fontFamily: 'Mulish, sans-serif',
                outline: 'none',
              }}
              placeholder="vas@email.sk"
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="admin-pw"
              style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.45)', marginBottom: '.4rem' }}
            >
              Heslo
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-pw"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,.06)',
                  border: '1.5px solid rgba(255,255,255,.12)',
                  borderRadius: 9,
                  padding: '.65em 2.6em .65em .9em',
                  color: '#e8f0fb',
                  fontSize: '1rem',
                  fontFamily: 'Mulish, sans-serif',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Skryť heslo' : 'Zobraziť heslo'}
                style={{
                  position: 'absolute', right: '.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)',
                  padding: 0,
                }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* TOTP MFA */}
          <div style={{ marginBottom: '1.4rem' }}>
            <label
              htmlFor="admin-totp"
              style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.45)', marginBottom: '.4rem' }}
            >
              MFA kód (TOTP)
              <span
                style={{
                  marginLeft: '.5rem',
                  background: 'rgba(37,99,168,.4)',
                  color: '#93c5fd',
                  borderRadius: 4,
                  padding: '0 .45em',
                  fontSize: '.68rem',
                  fontWeight: 800,
                  letterSpacing: '.1em',
                  verticalAlign: 'middle',
                }}
              >
                Povinné
              </span>
            </label>
            <input
              id="admin-totp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              placeholder="000000"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,.06)',
                border: '1.5px solid rgba(255,255,255,.12)',
                borderRadius: 9,
                padding: '.65em .9em',
                color: '#e8f0fb',
                fontSize: '1.2rem',
                fontFamily: 'monospace',
                letterSpacing: '.2em',
                outline: 'none',
                textAlign: 'center',
              }}
              autoComplete="one-time-code"
            />
            <p style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.3)', marginTop: '.4rem' }}>
              MFA je povinné pre všetkých správcov (Výnos 179/2020).
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: 'rgba(192,57,43,.2)',
                border: '1px solid rgba(192,57,43,.5)',
                borderRadius: 8,
                padding: '.6rem .9rem',
                color: '#fca5a5',
                fontSize: '.88rem',
                marginBottom: '1rem',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? 'rgba(30,82,144,.5)' : 'var(--blue-700, #1e5290)',
              color: '#fff',
              border: 'none',
              borderRadius: 9,
              padding: '.85em',
              fontSize: '1rem',
              fontFamily: 'Mulish, sans-serif',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '.5rem',
              transition: 'background .15s',
            }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Lock size={16} />}
            {loading ? 'Prihlasovanie…' : 'Prihlásiť sa do administrácie'}
          </button>

          <a
            href="/"
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: '1rem',
              color: 'rgba(255,255,255,.35)',
              fontSize: '.85rem',
              textDecoration: 'none',
            }}
          >
            ← Späť na web
          </a>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <AdminAuthProvider>
      <LoginForm />
    </AdminAuthProvider>
  );
}
