'use client';

import React from 'react';

/**
 * Horizontally scrollable wrapper for wide tables.
 *
 * `overflow-x: auto` alone fails WCAG 2.1 AA (axe `scrollable-region-focusable`):
 * a keyboard-only user cannot scroll the region. tabIndex makes it focusable and
 * the labelled role gives screen readers something to announce. Caught on the
 * mobile viewport, where the tables actually overflow.
 */
export function ScrollArea({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} style={{ overflowX: 'auto' }}>
      {children}
    </div>
  );
}
