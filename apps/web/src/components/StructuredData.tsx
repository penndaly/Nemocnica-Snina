/**
 * JSON-LD structured data — MedicalOrganization + Physician cards.
 * Injected as <script type="application/ld+json"> in page <head>.
 */
import { SEED } from '@/lib/seed';
import type { SupportedLocale } from '@/i18n/config';

interface Props {
  locale: SupportedLocale;
  page?: 'home' | 'department' | 'physician';
  entityId?: string;
}

export function StructuredData({ locale, page = 'home', entityId }: Props) {
  const h = SEED.hospital;
  const base = 'https://nemocnicasnina.sk';

  let data: Record<string, unknown>;

  if (page === 'home') {
    data = {
      '@context': 'https://schema.org',
      '@type': 'MedicalOrganization',
      '@id': `${base}/#hospital`,
      name: h.name,
      alternateName: 'Nemocnica Snina',
      url: `${base}/${locale}`,
      logo: `${base}/logo.png`,
      telephone: h.phone,
      email: h.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Sládkovičova 300/3',
        postalCode: '069 01',
        addressLocality: 'Snina',
        addressCountry: 'SK',
        addressRegion: 'Prešovský kraj',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 48.9878,
        longitude: 22.1511,
      },
      medicalSpecialty: SEED.departments.map((d) => d.short[locale] ?? d.short.sk ?? ''),
      hasMap: `https://maps.google.com/?q=Nemocnica+Snina`,
      sameAs: [`${base}/${locale}`],
    };
  } else if (page === 'department' && entityId) {
    const dept = SEED.departments.find((d) => d.id === entityId);
    if (!dept) return null;
    data = {
      '@context': 'https://schema.org',
      '@type': 'MedicalClinic',
      name: dept.name[locale] ?? dept.name.sk ?? '',
      description: dept.summary[locale] ?? dept.summary.sk ?? '',
      telephone: dept.phone ?? h.phone,
      parentOrganization: { '@id': `${base}/#hospital` },
    };
  } else if (page === 'physician' && entityId) {
    const physician = SEED.physicians.find((p) => p.id === entityId);
    if (!physician) return null;
    data = {
      '@context': 'https://schema.org',
      '@type': 'Physician',
      name: physician.name,
      description: physician.bio[locale] ?? physician.bio.sk ?? '',
      worksFor: { '@id': `${base}/#hospital` },
      knowsLanguage: physician.langs,
    };
  } else {
    return null;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
