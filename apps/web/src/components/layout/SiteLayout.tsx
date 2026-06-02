import React from 'react';
import { UtilityBar } from './UtilityBar';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

interface SiteLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

export function SiteLayout({ children, activePath }: SiteLayoutProps) {
  return (
    <>
      <UtilityBar />
      <SiteHeader activePath={activePath} />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
