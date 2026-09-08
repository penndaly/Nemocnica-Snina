'use client';

import { useLocale } from 'next-intl';
import type { SupportedLocale } from '@/i18n/config';

/**
 * IMG_1_PLACEHOLDER_PHOTOGRAPHY.md §1 / §7b: an unobtrusive marker on
 * placeholder (stock) images so nobody mistakes one for a real photo of
 * Nemocnica Snina — staging only, never production (a placeholder image
 * can't even reach a production build in the first place; see
 * check-no-placeholder-media.mjs — this is the staging-side half of the
 * guardrail, for the environment where placeholders are expected).
 *
 * Not focusable (no interactive semantics — it's a caption, not a control)
 * and explicitly aria-hidden="false" so a screen reader announces it even
 * if a parent figure/wrapper sets aria-hidden="true" on its decorative
 * image content.
 *
 * Usage (once IMG-1 wires assets/img/index.json into next/image call
 * sites): render only when the resolved manifest entry has
 * `placeholder: true` — this component does not read the manifest itself,
 * the caller decides whether to mount it.
 */
export function IllustrativePhotoMarker() {
  const locale = useLocale() as SupportedLocale;

  if (process.env.NEXT_PUBLIC_APP_ENV !== 'staging') return null;

  const label = locale === 'sk' ? 'Ilustračná fotografia' : 'Illustrative photo';

  return (
    <span
      aria-hidden="false"
      style={{
        position: 'absolute',
        insetInlineEnd: '.5rem',
        insetBlockEnd: '.5rem',
        zIndex: 5,
        background: 'rgba(20, 55, 95, .78)',
        color: '#fff',
        fontSize: '.68rem',
        fontWeight: 600,
        letterSpacing: '.02em',
        padding: '.2rem .55rem',
        borderRadius: 999,
        pointerEvents: 'none',
      }}
    >
      {label}
    </span>
  );
}
