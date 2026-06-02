'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Phone, PhoneCall } from 'lucide-react';
import { locales, type SupportedLocale } from '@/i18n/config';

const HOSPITAL_PHONE = '+421 57 766 01 11';

export function UtilityBar() {
  const t = useTranslations();
  const locale = useLocale() as SupportedLocale;
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(next: SupportedLocale) {
    // Replace locale segment — /sk/ambulancie → /en/ambulancie
    const segments = pathname.split('/');
    if (locales.includes(segments[1] as SupportedLocale)) {
      segments[1] = next;
    } else {
      segments.unshift('', next);
    }
    router.push(segments.join('/') || `/${next}`);
  }

  return (
    <div
      className="utility-bar"
      style={{
        background: 'var(--blue-900)',
        color: '#d6e2f0',
        minHeight: 38,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        className="container"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
      >
        {/* Left: switchboard + emergency */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', fontSize: '.85rem' }}>
          <a
            href={`tel:${HOSPITAL_PHONE.replace(/\s/g, '')}`}
            style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: '.4em' }}
            aria-label={`${t('central')}: ${HOSPITAL_PHONE}`}
          >
            <Phone size={14} aria-hidden />
            {HOSPITAL_PHONE}
          </a>
          <a
            href="tel:112"
            style={{
              color: '#ffb3aa',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '.4em',
            }}
            aria-label={t('callEmergency')}
          >
            <PhoneCall size={14} aria-hidden />
            {t('emergency')} 112
          </a>
        </div>

        {/* Right: language switch */}
        <nav aria-label={t('a11y.langSwitch')} style={{ display: 'flex', gap: '.3rem' }}>
          {(['sk', 'en'] as SupportedLocale[]).map((l) => (
            <button
              key={l}
              onClick={() => switchLocale(l)}
              aria-current={locale === l ? 'true' : undefined}
              style={{
                background: locale === l ? 'var(--blue-600)' : 'transparent',
                color: locale === l ? '#fff' : '#d6e2f0',
                border: 'none',
                borderRadius: 999,
                padding: '.2em .65em',
                fontFamily: 'Mulish, sans-serif',
                fontWeight: 700,
                fontSize: '.78rem',
                cursor: 'pointer',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
              }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
