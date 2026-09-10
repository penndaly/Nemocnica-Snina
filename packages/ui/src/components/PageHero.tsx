import type { ReactNode } from 'react';
import Link from 'next/link';
import { HospitalImage } from './HospitalImage';
import { cn } from '../lib/cn';

export interface PageHeroBreadcrumb {
  homeLabel: string;
  homeHref: string;
  here: string;
}

export interface PageHeroProps {
  /** Media-plan slot id (e.g. "patients-hero", or "dept-<id>-hero" for department detail). */
  slot: string;
  alt: string;
  photoUrl?: string | null;
  breadcrumb?: PageHeroBreadcrumb;
  /**
   * Content of the hero — eyebrow/h1/lede/chips/buttons, already localized. Passed
   * as children (not fixed props) so the home page's two-column .hero-grid (copy +
   * emergency-card aside) and the booking wizard's stepper can both live here.
   */
  children: ReactNode;
  /** e.g. "hero-grid" on the home page — exempted from the 62%-width copy cap. */
  containerClassName?: string;
  className?: string;
}

/**
 * Full-bleed hero image band with a contrast scrim behind the page's opening
 * copy. See design_handoff_nemocnica_snina/PLACEHOLDER_ART.md and
 * SPRINT_UI_HERO_NAV_ART.md — the 62% copy cap and scrim opacity are load-
 * bearing for WCAG AA contrast, not cosmetic; don't tune them per-page.
 */
export function PageHero({ slot, alt, photoUrl, breadcrumb, children, containerClassName, className }: PageHeroProps) {
  return (
    <section className={cn('page-hero has-hero-media', className)}>
      <div className="hero-media">
        <HospitalImage slot={slot} alt={alt} photoUrl={photoUrl ?? null} priority />
      </div>
      <div className="hero-scrim" aria-hidden="true" />
      <div className={cn('container', containerClassName)}>
        {breadcrumb && (
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href={breadcrumb.homeHref}>{breadcrumb.homeLabel}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{breadcrumb.here}</span>
          </nav>
        )}
        {children}
      </div>
    </section>
  );
}
