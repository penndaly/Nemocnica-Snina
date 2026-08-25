'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { SupportedLocale } from '@/i18n/config';

const CONSENT_KEY = 'ns_cookie_consent';

const STRINGS = {
  sk: {
    body: 'Táto stránka používa iba funkčné súbory cookie nevyhnutné pre správnu prevádzku. Nepoužívame cookies na sledovanie ani reklamu.',
    accept: 'Rozumiem',
    more: 'Ochrana osobných údajov',
  },
  en: {
    body: 'This site uses only essential functional cookies required for correct operation. We do not use tracking or advertising cookies.',
    accept: 'I understand',
    more: 'Privacy policy',
  },
};

export function GdprCookieBanner() {
  const locale = useLocale() as SupportedLocale;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  const s = STRINGS[locale === 'en' ? 'en' : 'sk'];

  return (
    <div
      role="dialog"
      aria-label={locale === 'sk' ? 'Cookies' : 'Cookie notice'}
      aria-modal="false"
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        // left/right insets + margin auto instead of left:50% + width:
        // calc(100% - 2rem) + transform: translateX(-50%) — confirmed live
        // that the calc()/% approach rendered at a full 560px on a 390px
        // viewport (231px overflow) with getComputedStyle reporting the
        // width as literally unresolved, not just wrong. This is the
        // standard, well-supported way to center a fixed-position box with
        // a max-width and no dependency on % containing-block resolution:
        // below 560+32px viewport width the insets alone size the box
        // (viewport - 2rem); above it, max-width caps the box and margin
        // auto centers it between the insets.
        left: '1rem',
        right: '1rem',
        margin: '0 auto',
        zIndex: 200,
        background: 'var(--blue-900)',
        color: '#d6e2f0',
        borderRadius: 12,
        padding: '1rem 1.25rem',
        maxWidth: 'min(560px, 90vw)',
        boxShadow: '0 16px 48px rgba(0,0,0,.35)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <p style={{ margin: 0, fontSize: '.88rem', flex: 1, minWidth: 200 }}>
        {s.body}{' '}
        <Link href={`/${locale}/kontakt#gdpr`} style={{ color: 'var(--blue-200)', fontWeight: 700 }}>
          {s.more}
        </Link>
      </p>
      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
        <button
          onClick={accept}
          style={{
            background: 'var(--blue-600)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '.5em 1.2em',
            fontFamily: 'Mulish, sans-serif',
            fontWeight: 700,
            fontSize: '.88rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {s.accept}
        </button>
        <button
          onClick={accept}
          aria-label="Zavrieť"
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', cursor: 'pointer', padding: '.3rem' }}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
