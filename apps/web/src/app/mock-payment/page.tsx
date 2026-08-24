'use client';

/**
 * Mock payment page — dev/CI only.
 * Shown when PAYMENT_PROVIDER=mock. Simulates a hosted-fields payment gateway.
 * In production this URL is replaced by the real gateway's hosted page.
 *
 * URL: /mock-payment?session=<sessionId>&amount=199&currency=EUR
 * On "Pay" → fires the webhook via the API then redirects to successUrl.
 * On "Cancel" → redirects to cancelUrl.
 *
 * This page is NOT locale-prefixed since it mimics an external gateway.
 * It must NOT be included in production builds — guarded by NODE_ENV check.
 */

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CreditCard, Lock, CheckCircle, XCircle } from 'lucide-react';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

type State = 'idle' | 'processing' | 'paid' | 'error';

function MockPaymentInner() {
  const params     = useSearchParams();
  const router     = useRouter();
  const sessionId  = params.get('session')   ?? 'unknown';
  const amount     = Number(params.get('amount')   ?? 199);
  const currency   = params.get('currency')  ?? 'EUR';
  const successUrl = params.get('success')   ?? '/';
  const cancelUrl  = params.get('cancel')    ?? '/';

  const [state, setState] = useState<State>('idle');
  const [cardNum, setCardNum] = useState('4111 1111 1111 1111');
  const [expiry,  setExpiry]  = useState('12/28');
  const [cvv,     setCvv]     = useState('123');

  if (process.env['NODE_ENV'] === 'production') {
    return <p style={{ padding: '2rem', color: 'red' }}>Mock payment is disabled in production.</p>;
  }

  async function pay() {
    setState('processing');
    try {
      // Simulate the gateway sending us a webhook
      await fetch(`${API_BASE}/api/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payment-signature': 'mock-sig',
        },
        body: JSON.stringify({
          event:          'payment.completed',
          sessionId,
          amount,
          currency,
          idempotencyKey: `mock-${sessionId}`,
          metadata:       { bookingId: params.get('booking') ?? '' },
        }),
      });
      setState('paid');
      setTimeout(() => router.push(successUrl), 1500);
    } catch {
      setState('error');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,.12)', maxWidth: 440, width: '100%', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#14375f', color: '#fff', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <Lock size={20} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Secure Payment</div>
            <div style={{ fontSize: '.8rem', opacity: .7 }}>Mock gateway — development only</div>
          </div>
          <div style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '1.1rem' }}>
            {currency} {(amount / 100).toFixed(2)}
          </div>
        </div>

        {state === 'paid' ? (
          <div style={{ padding: '2.5rem', textAlign: 'center' }}>
            <CheckCircle size={52} style={{ color: '#2f8a64', marginBottom: 12 }} />
            <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: '0 0 4px' }}>Payment successful</p>
            <p style={{ color: '#888', fontSize: '.88rem' }}>Redirecting…</p>
          </div>
        ) : state === 'error' ? (
          <div style={{ padding: '2.5rem', textAlign: 'center' }}>
            <XCircle size={52} style={{ color: '#c0392b', marginBottom: 12 }} />
            <p style={{ fontWeight: 700 }}>Payment error</p>
            <button onClick={() => setState('idle')} style={{ marginTop: 8, padding: '.4rem 1rem', cursor: 'pointer' }}>Try again</button>
          </div>
        ) : (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.9rem' }}>
              <span style={{ fontWeight: 600 }}>Card number</span>
              <input
                value={cardNum}
                onChange={(e) => setCardNum(e.target.value)}
                style={{ padding: '.55rem .7rem', border: '1.5px solid #ddd', borderRadius: 6, fontSize: '.95rem', fontFamily: 'monospace' }}
                maxLength={19}
                aria-label="Card number"
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.9rem' }}>
                <span style={{ fontWeight: 600 }}>Expiry</span>
                <input
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  style={{ padding: '.55rem .7rem', border: '1.5px solid #ddd', borderRadius: 6, fontSize: '.95rem', fontFamily: 'monospace' }}
                  maxLength={5}
                  aria-label="Expiry date"
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.9rem' }}>
                <span style={{ fontWeight: 600 }}>CVV</span>
                <input
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  style={{ padding: '.55rem .7rem', border: '1.5px solid #ddd', borderRadius: 6, fontSize: '.95rem', fontFamily: 'monospace' }}
                  maxLength={4}
                  type="password"
                  aria-label="CVV"
                />
              </label>
            </div>
            <button
              onClick={() => void pay()}
              disabled={state === 'processing'}
              style={{
                background: state === 'processing' ? '#999' : '#1e5290',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '.75rem',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: state === 'processing' ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '.5rem',
              }}
              aria-busy={state === 'processing'}
            >
              <CreditCard size={18} />
              {state === 'processing' ? 'Processing…' : `Pay ${currency} ${(amount / 100).toFixed(2)}`}
            </button>
            <button
              onClick={() => router.push(cancelUrl)}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '.88rem', textDecoration: 'underline' }}
            >
              Cancel payment
            </button>
            <p style={{ fontSize: '.75rem', color: '#aaa', textAlign: 'center', margin: 0 }}>
              Session: {sessionId}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * useSearchParams() forces client-side bailout, which fails `next build`
 * prerendering unless it sits inside a Suspense boundary.
 */
export default function MockPaymentPage() {
  return (
    <Suspense fallback={null}>
      <MockPaymentInner />
    </Suspense>
  );
}
