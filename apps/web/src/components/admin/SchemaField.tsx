'use client';

import React from 'react';
import type { FieldDef } from './admin-schemas';
import type { Seed } from '@ns/types';

interface SchemaFieldProps {
  field: FieldDef;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  data: Seed;
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'Mulish, sans-serif',
  fontSize: '.95rem',
  padding: '.6em .85em',
  border: '1.5px solid rgba(255,255,255,.12)',
  borderRadius: 9,
  background: 'rgba(255,255,255,.06)',
  color: '#e8f0fb',
  width: '100%',
  outline: 'none',
  transition: 'border .14s',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'Mulish, sans-serif',
  fontWeight: 700,
  fontSize: '.78rem',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,.45)',
  marginBottom: '.4rem',
  display: 'block',
};

const bilTagStyle: React.CSSProperties = {
  fontSize: '.68rem',
  fontWeight: 800,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: 'var(--blue-400, #5a9fd4)',
  marginBottom: '.3rem',
  display: 'block',
};

export function SchemaField({ field, value, onChange, data }: SchemaFieldProps) {
  const { k, t, label } = field;

  const fieldWrap = (content: React.ReactNode) => (
    <div style={{ marginBottom: '1.2rem' }}>
      <span style={labelStyle}>{label.sk}</span>
      {content}
    </div>
  );

  if (t === 'biltext' || t === 'biltextarea') {
    const bilVal = (value as Record<string, string> | null) ?? { sk: '', en: '' };
    const BilInput = ({ lang }: { lang: 'sk' | 'en' }) => {
      const tag = (
        <span style={bilTagStyle}>{lang.toUpperCase()}</span>
      );
      if (t === 'biltextarea') {
        return (
          <div>
            {tag}
            <textarea
              value={bilVal[lang] ?? ''}
              onChange={(e) => onChange(k, { ...bilVal, [lang]: e.target.value })}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              aria-label={`${label.sk} (${lang.toUpperCase()})`}
            />
          </div>
        );
      }
      return (
        <div>
          {tag}
          <input
            type="text"
            value={bilVal[lang] ?? ''}
            onChange={(e) => onChange(k, { ...bilVal, [lang]: e.target.value })}
            style={inputStyle}
            aria-label={`${label.sk} (${lang.toUpperCase()})`}
          />
        </div>
      );
    };
    return fieldWrap(
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
        <BilInput lang="sk" />
        <BilInput lang="en" />
      </div>,
    );
  }

  if (t === 'billist') {
    const bilVal = (value as Record<string, string[]> | null) ?? { sk: [], en: [] };
    return fieldWrap(
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
        {(['sk', 'en'] as const).map((lang) => (
          <div key={lang}>
            <span style={bilTagStyle}>{lang.toUpperCase()}</span>
            <textarea
              value={(bilVal[lang] ?? []).join('\n')}
              onChange={(e) => onChange(k, { ...bilVal, [lang]: e.target.value.split('\n') })}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
              aria-label={`${label.sk} (${lang.toUpperCase()})`}
            />
          </div>
        ))}
      </div>,
    );
  }

  if (t === 'bool') {
    return (
      <div style={{ marginBottom: '1.2rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.7rem', cursor: 'pointer' }}>
          <div
            onClick={() => onChange(k, !value)}
            role="switch"
            aria-checked={!!value}
            tabIndex={0}
            onKeyDown={(e) => e.key === ' ' || e.key === 'Enter' ? onChange(k, !value) : undefined}
            style={{
              width: 40,
              height: 22,
              borderRadius: 999,
              background: value ? 'var(--blue-600, #2563a8)' : 'rgba(255,255,255,.15)',
              position: 'relative',
              transition: 'background .15s',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 3,
                left: value ? 20 : 3,
                width: 16,
                height: 16,
                borderRadius: 999,
                background: '#fff',
                transition: 'left .15s',
              }}
            />
          </div>
          <span style={{ color: 'rgba(255,255,255,.75)', fontSize: '.92rem', fontWeight: 600 }}>
            {label.sk}
          </span>
        </label>
      </div>
    );
  }

  if (t === 'select' && field.opts) {
    return fieldWrap(
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(k, e.target.value)}
        style={{ ...inputStyle, cursor: 'pointer' }}
      >
        {field.opts.map((opt) => (
          <option key={opt.v} value={opt.v} style={{ background: '#1a2533' }}>
            {opt.l.sk}
          </option>
        ))}
      </select>,
    );
  }

  if (t === 'ref' && field.ref) {
    const refKey = field.ref as keyof Seed;
    const refItems = (Array.isArray(data[refKey]) ? data[refKey] : []) as Array<{
      id: string;
      name: unknown;
      short?: unknown;
    }>;
    return fieldWrap(
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(k, e.target.value || undefined)}
        style={{ ...inputStyle, cursor: 'pointer' }}
      >
        <option value="" style={{ background: '#1a2533' }}>— žiadne —</option>
        {refItems.map((item) => {
          const lbl =
            typeof item.short === 'object' && item.short !== null
              ? (item.short as Record<string, string>)['sk'] ?? item.id
              : typeof item.name === 'object' && item.name !== null
              ? (item.name as Record<string, string>)['sk'] ?? item.id
              : typeof item.name === 'string'
              ? item.name
              : item.id;
          return (
            <option key={item.id} value={item.id} style={{ background: '#1a2533' }}>
              {lbl}
            </option>
          );
        })}
      </select>,
    );
  }

  if (t === 'tags') {
    return fieldWrap(
      <input
        type="text"
        value={Array.isArray(value) ? (value as string[]).join(', ') : ''}
        onChange={(e) =>
          onChange(
            k,
            e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        placeholder="SK, EN, UK…"
        style={inputStyle}
      />,
    );
  }

  if (t === 'textarea') {
    return fieldWrap(
      <textarea
        value={String(value ?? '')}
        onChange={(e) => onChange(k, e.target.value)}
        rows={4}
        style={{ ...inputStyle, resize: 'vertical' }}
      />,
    );
  }

  if (t === 'number') {
    return fieldWrap(
      <input
        type="number"
        value={value != null ? String(value) : ''}
        onChange={(e) => onChange(k, e.target.value === '' ? '' : Number(e.target.value))}
        style={inputStyle}
      />,
    );
  }

  if (t === 'date') {
    return fieldWrap(
      <input
        type="date"
        value={String(value ?? '')}
        onChange={(e) => onChange(k, e.target.value)}
        style={inputStyle}
      />,
    );
  }

  // Default: text
  return fieldWrap(
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(k, e.target.value)}
      style={inputStyle}
    />,
  );
}
