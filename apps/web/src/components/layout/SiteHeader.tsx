'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Menu, X, Plus, ChevronRight } from 'lucide-react';
import type { SupportedLocale } from '@/i18n/config';

interface NavLeaf {
  /** Key used for the leaf's own label translation (nav.<key> / a labelKey override below). */
  key: string;
  href: string;
  /** navGroups.<group>.<key> description string. */
  descKey: string;
  /** Override the leaf label translation key (e.g. "book" instead of "nav.booking"). */
  labelKey?: string;
}

interface NavGroup {
  key: string;
  labelKey: string;
  /** Present only for the direct "contact" link — no panel. */
  href?: string;
  items?: NavLeaf[];
}

export function SiteHeader({ activePath = '' }: { activePath?: string }) {
  const t = useTranslations();
  const locale = useLocale() as SupportedLocale;
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const ctasRef = useRef<HTMLDivElement>(null);
  // UI-2b (fixes UI-3): content-aware collapse. The 1100px CSS breakpoint is
  // a floor, not the rule — above it, whether the grouped nav fits depends on
  // the locale's label lengths (uk overflowed into the CTAs at every desktop
  // width; sk by 38px at 1101px). So measure: brand + nav content + CTAs +
  // gaps against the container's content box, and switch to the hamburger
  // when it would overlap. Intrinsic widths are read from the *children*
  // (`.nav-top` is nowrap and flex items don't shrink below content), so the
  // sum is the same whether the nav is currently in flow or parked off-flow
  // by `.nav-collapsed` (visibility:hidden keeps layout) — no hysteresis
  // needed. Below the CSS floor everything is display:none, the sum is 0,
  // and this state is simply false; CSS owns that range.
  const [navCollapsed, setNavCollapsed] = useState(false);

  const navGroups: NavGroup[] = [
    {
      key: 'care',
      labelKey: 'footer.care',
      items: [
        { key: 'departments', href: `/${locale}/oddelenia`, descKey: 'navGroups.care.departments' },
        { key: 'clinics', href: `/${locale}/ambulancie`, descKey: 'navGroups.care.clinics' },
        { key: 'doctors', href: `/${locale}/lekari`, descKey: 'navGroups.care.doctors' },
        { key: 'diagnostics', href: `/${locale}/diagnostika`, descKey: 'navGroups.care.diagnostics' },
        { key: 'services', href: `/${locale}/sluzby`, descKey: 'navGroups.care.services' },
        { key: 'education', href: `/${locale}/edukacia`, descKey: 'navGroups.care.education' },
      ],
    },
    {
      key: 'visit',
      labelKey: 'footer.patients',
      items: [
        { key: 'patients', href: `/${locale}/pre-pacientov`, descKey: 'navGroups.visit.patients' },
        { key: 'booking', href: `/${locale}/objednanie`, descKey: 'navGroups.visit.booking', labelKey: 'book' },
        { key: 'telehealth', href: `/${locale}/telehealth`, descKey: 'navGroups.visit.telehealth' },
        { key: 'portal', href: `/${locale}/portal`, descKey: 'navGroups.visit.portal', labelKey: 'portal.title' },
      ],
    },
    {
      key: 'hospital',
      labelKey: 'navGroups.hospitalLabel',
      items: [
        { key: 'about', href: `/${locale}/o-nemocnici`, descKey: 'navGroups.hospital.about' },
        { key: 'news', href: `/${locale}/aktuality`, descKey: 'navGroups.hospital.news' },
        { key: 'careers', href: `/${locale}/kariera`, descKey: 'navGroups.hospital.careers', labelKey: 'footer.careers' },
        { key: 'disclosures', href: `/${locale}/zverejnovanie`, descKey: 'navGroups.hospital.disclosures', labelKey: 'footer.disclosures' },
      ],
    },
    { key: 'contact', labelKey: 'nav.contact', href: `/${locale}/kontakt` },
  ];

  const leafLabel = (item: NavLeaf) => t(item.labelKey || `nav.${item.key}`);
  const groupOf: Record<string, string> = {};
  for (const g of navGroups) for (const it of g.items || []) groupOf[it.href] = g.key;
  const activeGroupKey = Object.entries(groupOf).find(([href]) => activePath.startsWith(href))?.[1]
    ?? (activePath.startsWith(`/${locale}/kontakt`) ? 'contact' : null);

  // Close on outside click / focus leaving the nav, and on Escape.
  useEffect(() => {
    if (!openGroup) return;
    function onPointerDown(e: PointerEvent) {
      if (navRef.current && e.target instanceof Node && !navRef.current.contains(e.target)) {
        setOpenGroup(null);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenGroup(null);
        const btn = navRef.current?.querySelector<HTMLButtonElement>(`[data-group-button="${openGroup}"]`);
        btn?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openGroup]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const brand = brandRef.current;
    const nav = navRef.current;
    const ctas = ctasRef.current;
    if (!container || !brand || !nav || !ctas) return;

    function measure() {
      if (!container || !brand || !nav || !ctas) return;
      const items = Array.from(nav.children) as HTMLElement[];
      const navGap = parseFloat(getComputedStyle(nav).columnGap) || 0;
      const navContent =
        items.reduce((w, el) => w + el.offsetWidth, 0) + navGap * Math.max(0, items.length - 1);
      if (navContent === 0) {
        // display:none (≤1100px CSS floor) — nothing to decide here.
        setNavCollapsed(false);
        return;
      }
      const cs = getComputedStyle(container);
      const available =
        container.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      const gap = parseFloat(cs.columnGap) || 0;
      const needed = brand.offsetWidth + gap + navContent + gap + ctas.offsetWidth;
      setNavCollapsed(needed > available);
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    // Web fonts land after first layout and change every label's width.
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => void 0);
    }
    return () => ro.disconnect();
  }, []);

  function toggleGroup(key: string) {
    setOpenGroup((cur) => (cur === key ? null : key));
  }

  function onGroupButtonKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, key: string) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpenGroup(key);
      requestAnimationFrame(() => {
        navRef.current?.querySelector<HTMLAnchorElement>(`[data-panel="${key}"] a`)?.focus();
      });
    }
  }

  function onPanelKeyDown(e: React.KeyboardEvent<HTMLDivElement>, key: string) {
    const links = Array.from(
      navRef.current?.querySelectorAll<HTMLAnchorElement>(`[data-panel="${key}"] a`) ?? [],
    );
    const idx = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      links[(idx + 1) % links.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      links[(idx - 1 + links.length) % links.length]?.focus();
    }
  }

  const mobileNavHtml = navGroups.map((g) =>
    g.href ? (
      <Link key={g.key} href={g.href} onClick={() => setMenuOpen(false)}>
        {t(g.labelKey)}
      </Link>
    ) : (
      <div key={g.key}>
        <p className="mm-head">{t(g.labelKey)}</p>
        {(g.items || []).map((it) => (
          <Link key={it.key} href={it.href} onClick={() => setMenuOpen(false)}>
            {leafLabel(it)}
          </Link>
        ))}
      </div>
    ),
  );

  return (
    <header
      className={`site-header${navCollapsed ? ' nav-collapsed' : ''}`}
      data-nav={navCollapsed ? 'collapsed' : 'expanded'}
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
        ref={containerRef}
        className="container"
        style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', width: '100%' }}
      >
        {/* Brand */}
        <Link
          ref={brandRef}
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

        {/* Primary nav — grouped, hidden < 1100px (see globals.css) and
            parked off-flow (still measurable) when .nav-collapsed — UI-2b. */}
        <nav
          ref={navRef}
          className="hidden-mobile nav-links"
          aria-label="Hlavná navigácia"
          aria-hidden={navCollapsed || undefined}
          inert={navCollapsed || undefined}
          style={{ flex: 1, minWidth: 0 }}
        >
          {navGroups.map((g) => {
            if (g.href) {
              return (
                <Link key={g.key} href={g.href} className={`nav-top${activeGroupKey === g.key ? ' active' : ''}`}>
                  {t(g.labelKey)}
                </Link>
              );
            }
            const isOpen = openGroup === g.key;
            return (
              <div key={g.key} className="nav-group">
                <button
                  type="button"
                  data-group-button={g.key}
                  className={`nav-top${activeGroupKey === g.key ? ' active' : ''}`}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onClick={() => toggleGroup(g.key)}
                  onKeyDown={(e) => onGroupButtonKeyDown(e, g.key)}
                >
                  {t(g.labelKey)}
                  <ChevronRight size={16} aria-hidden />
                </button>
                <div
                  data-panel={g.key}
                  className={`nav-panel${isOpen ? ' open' : ''}`}
                  role="menu"
                  onKeyDown={(e) => onPanelKeyDown(e, g.key)}
                >
                  {(g.items || []).map((it) => (
                    <Link
                      key={it.key}
                      href={it.href}
                      role="menuitem"
                      className={activePath.startsWith(it.href) ? 'active' : ''}
                      onClick={() => setOpenGroup(null)}
                    >
                      <b>{leafLabel(it)}</b>
                      <span>{t(it.descKey)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* CTAs */}
        <div
          ref={ctasRef}
          className="hidden-mobile header-ctas"
          aria-hidden={navCollapsed || undefined}
          inert={navCollapsed || undefined}
          style={{ display: 'flex', gap: '.6rem', alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}
        >
          <Link href={`/${locale}/portal`} className="btn btn-ghost btn-sm">
            {t('portal.title')}
          </Link>
          <Link href={`/${locale}/objednanie`} className="btn btn-primary btn-sm">
            {t('book')}
          </Link>
        </div>

        {/* Hamburger — visible < 1100px, and whenever .nav-collapsed (UI-2b) */}
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
          className="mobile-menu open"
          style={{
            position: 'absolute',
            top: 'var(--header-h)',
            left: 0,
            right: 0,
            background: 'var(--surface)',
            borderBottom: '1px solid var(--line)',
            boxShadow: 'var(--shadow)',
            padding: '1rem',
          }}
        >
          {mobileNavHtml}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: '.5rem', paddingTop: '.75rem', display: 'flex', gap: '.6rem' }}>
            <Link href={`/${locale}/portal`} className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setMenuOpen(false)}>
              {t('portal.title')}
            </Link>
            <Link href={`/${locale}/objednanie`} className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => setMenuOpen(false)}>
              {t('book')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
