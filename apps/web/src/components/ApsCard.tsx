'use client';

/**
 * ApsCard — live ambulatory emergency service schedule widget.
 *
 * Fetches /api/aps on mount and renders the live APS schedule.
 * If isFallback is true (API unavailable) it shows a "temporarily unavailable" note
 * but always renders fallback contact information so the card is never empty.
 *
 * Sprint S2.
 */

import { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';

interface ApsEntry {
  date: string;
  from: string;
  to: string;
  facility: string;
  phone: string;
  address?: string;
  type: 'adult' | 'child' | 'dental';
}

interface ApsData {
  source: 'live' | 'cache' | 'fallback';
  updatedAt: string;
  schedule: ApsEntry[];
  isFallback?: boolean;
}

interface Props {
  /** Title label (localised by caller) */
  title: string;
  /** Static note text (localised by caller) — shown while loading / as sub-heading */
  note: string;
  locale: string;
}

export function ApsCard({ title, note, locale }: Props) {
  const [data, setData] = useState<ApsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/aps')
      .then((r) => r.json() as Promise<ApsData>)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        // Network-level failure — show nothing, fallback copy in note is still visible
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const typeLabel = (type: ApsEntry['type']) => {
    if (locale === 'sk') {
      return type === 'adult' ? 'Dospelí' : type === 'child' ? 'Deti' : 'Stomatológ';
    }
    return type === 'adult' ? 'Adult' : type === 'child' ? 'Paediatric' : 'Dental';
  };

  return (
    <div
      className="card card-pad"
      style={{ borderTop: '4px solid var(--blue-600)' }}
      aria-label={title}
      aria-live="polite"
    >
      <p className="eyebrow">{title}</p>

      {/* Staleness / fallback notice */}
      {data?.isFallback && (
        <p
          role="status"
          style={{
            fontSize: '.82rem',
            color: 'var(--amber-700, #92400e)',
            background: 'var(--amber-50, #fffbeb)',
            border: '1px solid var(--amber-200, #fde68a)',
            borderRadius: 'var(--radius-sm)',
            padding: '.4rem .6rem',
            marginBottom: '.75rem',
          }}
        >
          {locale === 'sk'
            ? 'Živý plán dočasne nedostupný — zobrazujú sa statické kontaktné údaje.'
            : 'Live schedule temporarily unavailable — showing static contact details.'}
        </p>
      )}

      {loading && (
        <p style={{ fontSize: '.88rem', color: 'var(--ink-3)', marginBottom: '.75rem' }}>
          {locale === 'sk' ? 'Načítava sa…' : 'Loading…'}
        </p>
      )}

      {!loading && data && data.schedule.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 0 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '.6rem',
          }}
        >
          {data.schedule.map((entry, i) => (
            <li
              key={i}
              style={{
                fontSize: '.88rem',
                borderBottom: '1px solid var(--line)',
                paddingBottom: '.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.5rem' }}>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.05em',
                      color: 'var(--ink-3)',
                      marginBottom: '.15rem',
                    }}
                  >
                    {typeLabel(entry.type)}
                  </span>
                  <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{entry.facility}</div>
                  {entry.date && (
                    <div style={{ color: 'var(--ink-2)', fontSize: '.82rem' }}>
                      {entry.date} · {entry.from}–{entry.to}
                    </div>
                  )}
                  {entry.address && (
                    <div style={{ color: 'var(--ink-3)', fontSize: '.8rem' }}>{entry.address}</div>
                  )}
                </div>
                <a
                  href={`tel:${entry.phone.replace(/\s/g, '')}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '.3rem',
                    color: 'var(--blue-700)',
                    fontWeight: 700,
                    fontSize: '.85rem',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  aria-label={`${locale === 'sk' ? 'Volať' : 'Call'} ${entry.phone}`}
                >
                  <Phone size={14} aria-hidden />
                  {entry.phone}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !data && (
        <p style={{ fontSize: '.88rem', color: 'var(--ink-2)', marginBottom: '.75rem' }}>{note}</p>
      )}

      {loading && (
        <p style={{ fontSize: '.88rem', color: 'var(--ink-2)', marginBottom: '.75rem' }}>{note}</p>
      )}

      {data?.source && !data.isFallback && (
        <p style={{ fontSize: '.75rem', color: 'var(--ink-3)', marginTop: '.5rem' }}>
          {locale === 'sk' ? 'Zdroj' : 'Source'}: {data.source} ·{' '}
          {new Date(data.updatedAt).toLocaleTimeString(locale === 'sk' ? 'sk-SK' : 'en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  );
}
