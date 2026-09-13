'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Phone, PhoneCall } from 'lucide-react';
import { locales, localeNames, type SupportedLocale } from '@/i18n/config';
import { publicLocales } from '@/i18n/public-locales';
import { AccessibilityControls } from '@/components/AccessibilityControls';

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
        // flexWrap: the prototype's .utility-bar .container wraps; the port
        // didn't, which is the UI-2 lead (docs/03-AUDIT.md) — at 320px the
        // phone + emergency group alone is 167–187px wide.
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.4rem 1rem', flexWrap: 'wrap' }}
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

        {/* Right: a11y controls + language switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
        <AccessibilityControls />
        {/* I18N-RUE T4 (C5): one <select> of native names for every advertised
            locale (i18n/public-locales.ts — rue appears automatically once its
            chrome is translated). A native control is keyboard-operable, fits
            at 320px where seven buttons did not, and each option carries its
            own lang attribute. */}
        <label className="lang-switch">
          <span className="sr-only">{t('a11y.langSwitch')}</span>
          <select
            value={locale}
            onChange={(e) => switchLocale(e.target.value as SupportedLocale)}
            aria-label={t('a11y.langSwitch')}
            data-testid="lang-switch"
          >
            {publicLocales.map((l) => (
              <option key={l} value={l} lang={l}>
                {localeNames[l]}
              </option>
            ))}
          </select>
        </label>
        </div>
      </div>
    </div>
  );
}
