import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';
import { SEED } from '@/lib/seed';

const BASE = 'https://nemocnicasnina.sk';

type Frequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

interface SitemapEntry {
  url: string;
  lastModified: Date;
  changeFrequency: Frequency;
  priority: number;
  alternates?: { languages: Record<string, string> };
}

function withAlternates(path: string): { languages: Record<string, string> } {
  return {
    languages: Object.fromEntries(locales.map((l) => [l, `${BASE}/${l}${path}`])),
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: SitemapEntry[] = [];

  // Static pages
  const staticPaths: Array<[string, Frequency, number]> = [
    ['',               'weekly',  1.0],
    ['/oddelenia',     'weekly',  0.9],
    ['/ambulancie',    'weekly',  0.9],
    ['/lekari',        'weekly',  0.8],
    ['/sluzby',        'weekly',  0.7],
    ['/diagnostika',   'weekly',  0.7],
    ['/aktuality',     'daily',   0.8],
    ['/zverejnovanie', 'monthly', 0.5],
    ['/kontakt',       'monthly', 0.6],
    ['/registracia',   'weekly',  0.6],
    ['/objednanie',    'weekly',  0.9],
  ];

  for (const [path, freq, priority] of staticPaths) {
    entries.push({
      url: `${BASE}/sk${path}`,
      lastModified: now,
      changeFrequency: freq,
      priority,
      alternates: withAlternates(path),
    });
  }

  // Department detail pages
  for (const dept of SEED.departments) {
    entries.push({
      url: `${BASE}/sk/oddelenia/${dept.id}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
      alternates: withAlternates(`/oddelenia/${dept.id}`),
    });
  }

  return entries;
}
