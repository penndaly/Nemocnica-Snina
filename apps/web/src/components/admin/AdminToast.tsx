'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastDispatch: ((msg: string, type?: 'success' | 'error') => void) | null = null;

export function showToast(msg: string, type: 'success' | 'error' = 'success') {
  toastDispatch?.(msg, type);
}

export function AdminToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let counter = 0;
    toastDispatch = (message, type = 'success') => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500);
    };
    return () => { toastDispatch = null; };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '.5rem',
        pointerEvents: 'none',
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '.6rem',
            background: t.type === 'success' ? '#1e3a2a' : '#3a1e1e',
            color: t.type === 'success' ? '#6ee7b7' : '#fca5a5',
            border: `1px solid ${t.type === 'success' ? '#2f7a55' : '#7a2f2f'}`,
            borderRadius: 10,
            padding: '.7rem 1.1rem',
            fontSize: '.9rem',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,.4)',
            animation: 'slideIn .2s ease',
          }}
          role="status"
        >
          {t.type === 'success'
            ? <CheckCircle size={16} />
            : <AlertCircle size={16} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}
