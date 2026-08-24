'use client';

import { use, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

type State = 'idle' | 'loading' | 'success' | 'already_cancelled' | 'not_found' | 'error';

export default function CancelBookingPage({
  params,
}: {
  // Next 15 passes route params as a Promise; a client component unwraps it
  // with React.use(). Typing it as a plain object fails `next build`'s
  // PageProps constraint (tsc alone does not catch this).
  params: Promise<{ token: string; lang: string }>;
}) {
  const { token, lang } = use(params);
  const t = useTranslations();
  const [state, setState] = useState<State>('idle');
  const [confirmed, setConfirmed] = useState(false);

  async function doCancel() {
    setState('loading');
    try {
      const res = await fetch(`${API_BASE}/api/booking/cancel/${token}`, {
        method: 'POST',
      });
      if (res.ok) {
        setState('success');
        return;
      }
      const body = await res.json() as { message?: string };
      const msg = String(body.message ?? '').toLowerCase();
      if (res.status === 400 && msg.includes('already cancelled')) {
        setState('already_cancelled');
      } else if (res.status === 404) {
        setState('not_found');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  // Ask once for confirmation, then auto-submit
  useEffect(() => {
    if (confirmed) { void doCancel(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed]);

  return (
    <SiteLayout>
      <main id="main-content" className="container py-16 flex justify-center">
        <div
          className="card card-pad"
          style={{ maxWidth: 520, width: '100%' }}
          role="main"
          aria-live="polite"
          aria-atomic="true"
        >
          {state === 'idle' && (
            <>
              <h1 className="h3 mb-4">
                {t('booking.cancelTitle', { defaultValue: 'Zrušiť objednávku' })}
              </h1>
              <p className="mb-6" style={{ color: 'var(--ink-2)' }}>
                {t('booking.cancelConfirmPrompt', {
                  defaultValue:
                    'Naozaj chcete zrušiť túto objednávku? Táto akcia je nevratná.',
                })}
              </p>
              <div className="flex gap-3">
                <button
                  className="btn btn-primary"
                  onClick={() => setConfirmed(true)}
                  aria-label={t('booking.cancelConfirm', { defaultValue: 'Áno, zrušiť objednávku' })}
                >
                  {t('booking.cancelConfirm', { defaultValue: 'Áno, zrušiť objednávku' })}
                </button>
                <a
                  href={`/${lang}`}
                  className="btn btn-ghost"
                >
                  {t('backHome')}
                </a>
              </div>
            </>
          )}

          {state === 'loading' && (
            <div className="flex items-center gap-3" role="status">
              <Loader size={24} className="animate-spin" aria-hidden="true" />
              <span>{t('booking.cancelling', { defaultValue: 'Ruším objednávku…' })}</span>
            </div>
          )}

          {state === 'success' && (
            <div>
              <CheckCircle
                size={48}
                style={{ color: 'var(--green)', marginBottom: 16 }}
                aria-hidden="true"
              />
              <h1 className="h3 mb-3">
                {t('booking.cancelledTitle', { defaultValue: 'Objednávka bola zrušená' })}
              </h1>
              <p style={{ color: 'var(--ink-2)' }}>
                {t('booking.cancelledBody', {
                  defaultValue:
                    'Vaša objednávka bola úspešne zrušená. Termín je opäť voľný.',
                })}
              </p>
              <a href={`/${lang}`} className="btn btn-primary mt-6 btn-block">
                {t('backHome')}
              </a>
            </div>
          )}

          {(state === 'already_cancelled') && (
            <div>
              <XCircle
                size={48}
                style={{ color: 'var(--amber)', marginBottom: 16 }}
                aria-hidden="true"
              />
              <h1 className="h3 mb-3">
                {t('booking.alreadyCancelledTitle', { defaultValue: 'Objednávka je už zrušená' })}
              </h1>
              <p style={{ color: 'var(--ink-2)' }}>
                {t('booking.alreadyCancelledBody', {
                  defaultValue: 'Táto objednávka bola predtým zrušená.',
                })}
              </p>
              <a href={`/${lang}`} className="btn btn-ghost mt-6">
                {t('backHome')}
              </a>
            </div>
          )}

          {(state === 'not_found' || state === 'error') && (
            <div>
              <XCircle
                size={48}
                style={{ color: 'var(--red)', marginBottom: 16 }}
                aria-hidden="true"
              />
              <h1 className="h3 mb-3">
                {t('booking.cancelErrorTitle', { defaultValue: 'Nastala chyba' })}
              </h1>
              <p style={{ color: 'var(--ink-2)' }}>
                {state === 'not_found'
                  ? t('booking.cancelNotFound', {
                      defaultValue:
                        'Objednávku sa nepodarilo nájsť. Odkaz mohol vypršať.',
                    })
                  : t('booking.cancelError', {
                      defaultValue:
                        'Zrušenie sa nepodarilo. Skúste to znovu alebo nás kontaktujte telefonicky.',
                    })}
              </p>
              <a href={`/${lang}`} className="btn btn-ghost mt-6">
                {t('backHome')}
              </a>
            </div>
          )}
        </div>
      </main>
    </SiteLayout>
  );
}
