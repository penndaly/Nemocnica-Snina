import React from 'react';
import type { Metadata } from 'next';
import '@ns/ui/globals.css';

export const metadata: Metadata = {
  title: 'Admin — Nemocnica Snina',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body style={{ margin: 0, background: '#0f1923', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  );
}
