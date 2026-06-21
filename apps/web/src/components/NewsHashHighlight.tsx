'use client';

import { useEffect } from 'react';

/**
 * Applies a brief blue outline to the news article whose id matches the URL hash.
 * Runs once on mount; the outline fades after 2 s so the user can see where they landed.
 */
export function NewsHashHighlight() {
  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (!el) return;
    el.style.outline = '2px solid var(--blue-500)';
    el.style.outlineOffset = '4px';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => {
      el.style.outline = '';
      el.style.outlineOffset = '';
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
