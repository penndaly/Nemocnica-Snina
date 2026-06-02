'use client';

import { useEffect, useState } from 'react';
import { Sun, ZoomIn } from 'lucide-react';

const HC_KEY = 'ns_high_contrast';
const FS_KEY = 'ns_font_size';
const SIZES = [100, 115, 130] as const;
type FontSize = typeof SIZES[number];

export function AccessibilityControls() {
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(100);

  useEffect(() => {
    const hc = localStorage.getItem(HC_KEY) === '1';
    const fs = Number(localStorage.getItem(FS_KEY) ?? 100) as FontSize;
    setHighContrast(hc);
    setFontSize(SIZES.includes(fs) ? fs : 100);
    applyHc(hc);
    applyFs(fs);
  }, []);

  function applyHc(on: boolean) {
    document.documentElement.classList.toggle('high-contrast', on);
  }

  function applyFs(size: FontSize) {
    document.documentElement.style.fontSize = `${size}%`;
  }

  function toggleHc() {
    const next = !highContrast;
    setHighContrast(next);
    localStorage.setItem(HC_KEY, next ? '1' : '0');
    applyHc(next);
  }

  function cycleFs() {
    const idx = SIZES.indexOf(fontSize);
    const next = SIZES[(idx + 1) % SIZES.length] as FontSize;
    setFontSize(next);
    localStorage.setItem(FS_KEY, String(next));
    applyFs(next);
  }

  return (
    <div
      style={{ display: 'flex', gap: '.3rem' }}
      aria-label="Nastavenia prístupnosti"
      role="group"
    >
      <button
        onClick={toggleHc}
        aria-pressed={highContrast}
        title="Vysoký kontrast"
        aria-label={highContrast ? 'Vypnúť vysoký kontrast' : 'Zapnúť vysoký kontrast'}
        style={{
          background: highContrast ? 'var(--blue-600)' : 'rgba(255,255,255,.12)',
          color: '#d6e2f0',
          border: 'none',
          borderRadius: 6,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'background .14s',
        }}
      >
        <Sun size={14} aria-hidden />
      </button>
      <button
        onClick={cycleFs}
        title={`Veľkosť textu: ${fontSize}%`}
        aria-label={`Zmeniť veľkosť textu (aktuálne ${fontSize}%)`}
        style={{
          background: fontSize > 100 ? 'var(--blue-600)' : 'rgba(255,255,255,.12)',
          color: '#d6e2f0',
          border: 'none',
          borderRadius: 6,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'background .14s',
        }}
      >
        <ZoomIn size={14} aria-hidden />
      </button>
    </div>
  );
}
