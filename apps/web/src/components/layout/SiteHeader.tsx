'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Menu, X, Plus } from 'lucide-react';
import type { SupportedLocale } from '@/i18n/config';

interface NavItem {
  key: string;
  href: string;
}

export function SiteHeader({ activePath = '' }: { activePath?: string }) {
  const t = useTranslations();
  const locale = useLocale() as SupportedLocale;
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    { key: 'nav.departments', href: `/${locale}/oddelenia` },
    { key: 'nav.clinics', href: `/${locale}/ambulancie` },
    { key: 'nav.doctors', href: `/${locale}/lekari` },
    { key: 'nav.services', href: `/${locale}/sluzby` },
    { key: 'nav.telehealth', href: `/${locale}/telehealth` },
    { key: 'nav.diagnostics', href: `/${locale}/diagnostika` },
    { key: 'nav.news', href: `/${locale}/aktuality` },
    { key: 'nav.contact', href: `/${locale}/kontakt` },
  ];

  return (
    <header
      className="site-header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(250,246,240,.92)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--line)',
        minHeight: 'var(--header-h)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        className="container"
        style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', width: '100%' }}
      >
        {/* Brand */}
        <Link
          href={`/${locale}`}
          style={{ display: 'flex', alignItems: 'center', gap: '.7rem', textDecoration: 'none', flexShrink: 0 }}
          aria-label="Nemocnica Snina — domov"
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              background: 'var(--blue-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-hidden
          >
            <Plus size={22} color="white" strokeWidth={2.5} />
          </div>
          <div>
            <div
              style={{
                fontFamily: 'Newsreader, Georgia, serif',
                fontWeight: 600,
                fontSize: '1.22rem',
                color: 'var(--blue-900)',
                lineHeight: 1.1,
              }}
            >
              Nemocnica Snina
            </div>
            <div
              style={{
                fontFamily: 'Mulish, sans-serif',
                fontWeight: 700,
                fontSize: '.72rem',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
                lineHeight: 1,
              }}
            >
              {t('brand.sub')}
            </div>
          </div>
        </Link>

        {/* Primary nav — hidden < 940px. flexWrap so 8 nowrap items wrapping onto a
            second row (taller header) is preferred over forcing the page to scroll
            horizontally — WCAG 1.4.10 Reflow — on viewports just above the breakpoint
            or with enlarged text. */}
        <nav
          className="hidden-mobile"
          aria-label="Hlavná navigácia"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '.2rem', flex: 1, minWidth: 0 }}
        >
          {navItems.map(({ key, href }) => {
            const isActive = activePath.startsWith(href);
            return (
              <Link
                key={key}
                href={href}
                style={{
                  fontFamily: 'Mulish, sans-serif',
                  fontWeight: 600,
                  fontSize: '.92rem',
                  color: isActive ? 'var(--blue-700)' : 'var(--ink-2)',
                  background: isActive ? 'var(--blue-50)' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                  padding: '.45em .7em',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  transition: 'background .14s, color .14s',
                }}
              >
                {t(key)}
              </Link>
            );
          })}
        </nav>

        {/* CTAs */}
        <div
          className="hidden-mobile"
          style={{ display: 'flex', gap: '.6rem', alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}
        >
          <Link href={`/${locale}/portal`} className="btn btn-ghost btn-sm">
            {t('portal.title')}
          </Link>
          <Link href={`/${locale}/objednanie`} className="btn btn-primary btn-sm">
            {t('book')}
          </Link>
        </div>

        {/* Hamburger — visible < 940px */}
        <button
          className="show-mobile"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? t('a11y.closeMenu') : t('a11y.openMenu')}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--blue-900)',
            padding: '.4rem',
          }}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div
          id="mobile-menu"
          role="navigation"
          aria-label="Mobilná navigácia"
          style={{
            position: 'absolute',
            top: 'var(--header-h)',
            left: 0,
            right: 0,
            background: 'var(--surface)',
            borderBottom: '1px solid var(--line)',
            boxShadow: 'var(--shadow)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '.3rem',
          }}
        >
          {navItems.map(({ key, href }) => (
            <Link
              key={key}
              href={href}
              onClick={() => setMenuOpen(false)}
              style={{
                fontWeight: 600,
                fontSize: '1rem',
                color: 'var(--ink)',
                padding: '.65rem .9rem',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
              }}
            >
              {t(key)}
            </Link>
          ))}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: '.5rem', paddingTop: '.75rem', display: 'flex', gap: '.6rem' }}>
            <Link href={`/${locale}/portal`} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
              {t('portal.title')}
            </Link>
            <Link href={`/${locale}/objednanie`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
              {t('book')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
