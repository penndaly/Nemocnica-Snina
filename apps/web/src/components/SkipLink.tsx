'use client';

import { useTranslations } from 'next-intl';

export function SkipLink() {
  const t = useTranslations();
  return (
    <a
      href="#main-content"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: 1,
        height: 1,
        overflow: 'hidden',
      }}
      onFocus={(e) => {
        const el = e.currentTarget;
        el.style.left = '1rem';
        el.style.top = '1rem';
        el.style.width = 'auto';
        el.style.height = 'auto';
        el.style.zIndex = '9999';
      }}
      onBlur={(e) => {
        const el = e.currentTarget;
        el.style.left = '-9999px';
        el.style.top = 'auto';
        el.style.width = '1px';
        el.style.height = '1px';
      }}
      className="btn btn-primary btn-sm"
    >
      {t('a11y.skipToContent')}
    </a>
  );
}
