'use client';

/**
 * Shared presentational primitives for admin sections (Sprint: Production
 * Admin Portal). Matches the existing pages' inline-style vocabulary and the
 * admin.html prototype (dark shell, blue accents, pill status chips) rather
 * than introducing a second design language.
 */
import React from 'react';
export { ScrollArea } from '@/components/ScrollArea';

export const INK = '#e8f0fb';
export const MUTED = '#94a3b8';
export const LINE = 'rgba(255,255,255,.07)';
export const FIELD_BG = '#0f1923';

export type Tone = 'ok' | 'warn' | 'crit' | 'info' | 'neutral';

const TONE_COLORS: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: 'rgba(22,163,74,.18)', fg: '#86efac' },
  warn: { bg: 'rgba(217,119,6,.2)', fg: '#fcd34d' },
  crit: { bg: 'rgba(220,38,38,.2)', fg: '#fca5a5' },
  info: { bg: 'rgba(37,99,168,.22)', fg: '#93c5fd' },
  neutral: { bg: 'rgba(255,255,255,.1)', fg: '#cbd5e1' },
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  const c = TONE_COLORS[tone];
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        borderRadius: 999,
        padding: '.12rem .55rem',
        fontSize: '.75rem',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  );
}

export const btn = (variant: 'primary' | 'ghost' | 'danger' = 'ghost'): React.CSSProperties => ({
  background: variant === 'primary' ? '#2563a8' : variant === 'danger' ? 'rgba(220,38,38,.15)' : 'transparent',
  border: `1px solid ${variant === 'danger' ? 'rgba(248,113,113,.4)' : 'rgba(255,255,255,.15)'}`,
  color: variant === 'primary' ? '#fff' : variant === 'danger' ? '#fca5a5' : '#cbd5e1',
  borderRadius: 8,
  padding: '.42rem .75rem',
  fontSize: '.83rem',
  fontWeight: 600,
  cursor: 'pointer',
});

export const field: React.CSSProperties = {
  padding: '.45rem .6rem',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,.15)',
  background: FIELD_BG,
  color: INK,
  fontSize: '.85rem',
};

export const cell: React.CSSProperties = {
  padding: '.6rem .8rem',
  borderBottom: `1px solid ${LINE}`,
  fontSize: '.85rem',
  verticalAlign: 'top',
};

export const th: React.CSSProperties = {
  ...cell,
  color: MUTED,
  fontWeight: 700,
  fontSize: '.75rem',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  textAlign: 'left',
};

export function Card({ title, children, actions }: { title?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'rgba(255,255,255,.03)',
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        padding: '1rem 1.1rem',
        marginBottom: '1rem',
      }}
    >
      {(title || actions) && (
        <header style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.75rem' }}>
          {title && <h2 style={{ fontSize: '.95rem', fontWeight: 700, margin: 0, flex: 1 }}>{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: Tone }) {
  const fg = tone ? TONE_COLORS[tone].fg : INK;
  return (
    <div
      style={{
        background: 'rgba(255,255,255,.03)',
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        padding: '.7rem .9rem',
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: '.72rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: fg, lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

/** Accessible tab strip — arrow-key roving focus, matching WCAG 2.1 AA. */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: ReadonlyArray<{ id: T; label: string }>;
  active: T;
  onChange: (id: T) => void;
  label: string;
}) {
  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange(tabs[(i + 1) % tabs.length]!.id); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(tabs[(i - 1 + tabs.length) % tabs.length]!.id); }
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={on}
            aria-controls={`panel-${t.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            style={{
              ...btn(on ? 'primary' : 'ghost'),
              borderRadius: 999,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel<T extends string>({ id, active, children }: { id: T; active: T; children: React.ReactNode }) {
  if (id !== active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0}>
      {children}
    </div>
  );
}
