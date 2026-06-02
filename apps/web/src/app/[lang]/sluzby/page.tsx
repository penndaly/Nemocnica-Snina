import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import {
  Scissors, Heart, Activity, Stethoscope, Zap, Shield, FlaskConical, ScanLine, Pill,
} from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { getServices } from '@/lib/strapi-client';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';
import type { ServiceIcon } from '@ns/types';

const ICON_MAP: Record<ServiceIcon, React.ReactNode> = {
  scalpel:     <Scissors  size={26} />,
  heart:       <Heart     size={26} />,
  activity:    <Activity  size={26} />,
  stethoscope: <Stethoscope size={26} />,
  pulse:       <Zap       size={26} />,
  shield:      <Shield    size={26} />,
  flask:       <FlaskConical size={26} />,
  scan:        <ScanLine  size={26} />,
  pill:        <Pill      size={26} />,
};

export default async function ServicesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });
  const services = await getServices(locale);

  return (
    <SiteLayout activePath={`/${locale}/sluzby`}>
      {/* Page hero */}
      <div style={{ padding: '2.5rem 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <p className="eyebrow">{t('nav.services')}</p>
          <h1>{locale === 'sk' ? 'Služby a klinické postupy' : 'Services & clinical practices'}</h1>
        </div>
      </div>

      {/* Services grid */}
      <div style={{ padding: '3rem 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.2rem' }}>
            {services.map((svc) => {
              const linkHref = svc.dept
                ? `/${locale}/oddelenia/${svc.dept}`
                : svc.clinic
                ? `/${locale}/ambulancie`
                : svc.facility
                ? `/${locale}/diagnostika`
                : null;
              const linkLabel = svc.dept
                ? (locale === 'sk' ? 'Zobraziť oddelenie' : 'View department')
                : svc.clinic
                ? (locale === 'sk' ? 'Zobraziť ambulanciu' : 'View clinic')
                : (locale === 'sk' ? 'Zobraziť pracovisko' : 'View facility');

              return (
                <div key={svc.id} className="card card-pad" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--blue-50)',
                      color: 'var(--blue-700)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    aria-hidden
                  >
                    {ICON_MAP[svc.icon as ServiceIcon] ?? <Activity size={26} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: '.3rem' }}>{localizeField(svc.name, locale)}</h3>
                    <p style={{ color: 'var(--ink-2)', fontSize: '.9rem', marginBottom: '.75rem' }}>
                      {localizeField(svc.desc, locale)}
                    </p>
                    {linkHref && (
                      <Link href={linkHref} style={{ fontSize: '.85rem', color: 'var(--blue-700)', fontWeight: 700 }}>
                        → {linkLabel}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dark CTA band */}
      <div className="band-blue">
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#fff', marginBottom: '.75rem' }}>
            {locale === 'sk' ? 'Potrebujete termín?' : 'Need an appointment?'}
          </h2>
          <p style={{ color: 'var(--blue-200)', marginBottom: '1.5rem' }}>
            {locale === 'sk'
              ? 'Objednajte sa online — rýchlo, jednoducho, bez čakania na telefóne.'
              : 'Book online — fast, easy, no waiting on the phone.'}
          </p>
          <Link href={`/${locale}/objednanie`} className="btn btn-terra btn-lg">
            {t('book')}
          </Link>
        </div>
      </div>
    </SiteLayout>
  );
}
