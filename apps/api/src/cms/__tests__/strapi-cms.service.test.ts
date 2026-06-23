import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StrapiCmsService, validateMediaConstraints } from '../strapi-cms.service';
import { CMS_COLLECTIONS } from '../cms.schema';

function makeService(): StrapiCmsService {
  // No real Strapi token → useFallback; buildStrapiPayloads is pure regardless.
  const cfg = { get: () => undefined } as unknown as ConfigService;
  return new StrapiCmsService(cfg);
}

describe('buildStrapiPayloads — i18n split + key mapping', () => {
  const svc = makeService();

  it('splits a bilingual department into base (sk) + en localization', () => {
    const { base, localized } = svc.buildStrapiPayloads(CMS_COLLECTIONS.departments, {
      name: { sk: 'Interné oddelenie', en: 'Internal Medicine' },
      short: { sk: 'Interné', en: 'Internal Medicine' },
      lead: 'MUDr. Jana Borščová',
      beds: 57,
      featured: true,
      facilities: { sk: ['JIS'], en: ['ICU'] },
    });

    expect(base.name).toBe('Interné oddelenie');
    expect(base.short).toBe('Interné');
    expect(base.lead).toBe('MUDr. Jana Borščová'); // shared, not localized
    expect(base.beds).toBe(57);
    expect(base.featured).toBe(true);
    expect(base.facilities).toEqual(['JIS']);

    expect(localized.name).toBe('Internal Medicine');
    expect(localized.short).toBe('Internal Medicine');
    expect(localized.facilities).toEqual(['ICU']);
    expect(localized.lead).toBeUndefined(); // shared field never in the en payload
    expect(localized.beds).toBeUndefined();
  });

  it('maps body keys to Strapi attribute names (dept→department, photo→avatar)', () => {
    const { base } = svc.buildStrapiPayloads(CMS_COLLECTIONS.physicians, {
      name: 'MUDr. Test',
      dept: 'interne',
      photo: { id: 7, url: '/uploads/x.jpg' },
      langs: ['SK', 'EN'],
    });
    expect(base.department).toBe('interne');
    expect(base.avatar).toEqual({ id: 7, url: '/uploads/x.jpg' });
    expect(base.dept).toBeUndefined();
    expect(base.langs).toEqual(['SK', 'EN']);
  });

  it('maps disclosure body id → documentId', () => {
    const { base } = svc.buildStrapiPayloads(CMS_COLLECTIONS.disclosures, {
      id: 'ZML-2024-051',
      type: { sk: 'Zmluva', en: 'Contract' },
      partner: 'Siemens',
      value: '45 000 €',
      date: '2024-09-20',
    });
    expect(base.documentId).toBe('ZML-2024-051');
    expect(base.type).toBe('Zmluva');
  });
});

describe('buildSingletonPayloads — pages nested → flat Strapi fields', () => {
  const svc = makeService();
  it('flattens hero/about/aps and splits locales', () => {
    const { base, localized } = svc.buildSingletonPayloads('pages', {
      hero: { badge: { sk: 'odznak', en: 'badge' }, title: { sk: 'nadpis', en: 'title' } },
      aps: { note: { sk: 'sk-note', en: 'en-note' } },
    });
    expect(base.heroBadge).toBe('odznak');
    expect(base.heroTitle).toBe('nadpis');
    expect(base.apsNote).toBe('sk-note');
    expect(localized.heroBadge).toBe('badge');
    expect(localized.apsNote).toBe('en-note');
  });
});

describe('validateMediaConstraints', () => {
  it('accepts jpeg/png/webp up to 10MB', () => {
    expect(() => validateMediaConstraints('image/jpeg', 5 * 1024 * 1024)).not.toThrow();
    expect(() => validateMediaConstraints('image/webp', 10 * 1024 * 1024)).not.toThrow();
  });
  it('rejects images over 10MB', () => {
    expect(() => validateMediaConstraints('image/png', 11 * 1024 * 1024)).toThrow(BadRequestException);
  });
  it('accepts pdf up to 50MB, rejects over', () => {
    expect(() => validateMediaConstraints('application/pdf', 49 * 1024 * 1024)).not.toThrow();
    expect(() => validateMediaConstraints('application/pdf', 51 * 1024 * 1024)).toThrow(BadRequestException);
  });
  it('rejects unsupported types', () => {
    expect(() => validateMediaConstraints('application/zip', 1024)).toThrow(BadRequestException);
    expect(() => validateMediaConstraints('image/gif', 1024)).toThrow(BadRequestException);
  });
});

describe('writes refuse to run without a configured Strapi (no silent no-op)', () => {
  it('create throws 503 in fallback mode', async () => {
    const svc = makeService();
    await expect(
      svc.create('departments', { short: { sk: 'X', en: 'X' }, name: { sk: 'X', en: 'X' }, lead: 'a', summary: { sk: 's', en: 's' }, desc: { sk: 'd', en: 'd' } }),
    ).rejects.toThrow(/Strapi not configured/);
    expect(svc.isFallback).toBe(true);
  });
});
