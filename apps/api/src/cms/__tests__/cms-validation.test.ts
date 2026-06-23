import { BadRequestException } from '@nestjs/common';
import { validateCollectionBody, validateSingletonBody } from '../cms.dto';

describe('validateCollectionBody — bilingual contract (server-side, not cosmetic)', () => {
  const validClinic = {
    name: { sk: 'Urologická ambulancia', en: 'Urology Clinic' },
    specialty: { sk: 'Urológia', en: 'Urology' },
    doctor: 'MUDr. Patrik Nebesník',
    location: { sk: '2. poschodie', en: '2nd floor' },
    status: 'new',
    bookable: true,
    referral: true,
    bookingDays: [1, 2, 3, 4, 5],
    schedule: { sk: ['Po–Pi 07:00–15:00'], en: ['Mon–Fri 07:00–15:00'] },
    bookingRule: { sk: 'Pravidlo', en: 'Rule' },
  };

  it('accepts a well-formed bilingual create body', () => {
    expect(() => validateCollectionBody('clinics', validClinic, { partial: false })).not.toThrow();
  });

  it('rejects a bilingual field sent as a bare string', () => {
    const bad = { ...validClinic, name: 'Urologická ambulancia' };
    expect(() => validateCollectionBody('clinics', bad, { partial: false })).toThrow(BadRequestException);
  });

  it('rejects a bilingual field missing the en locale', () => {
    const bad = { ...validClinic, name: { sk: 'Iba SK' } };
    expect(() => validateCollectionBody('clinics', bad, { partial: false })).toThrow(BadRequestException);
  });

  it('rejects an invalid select (status) value', () => {
    const bad = { ...validClinic, status: 'paused' };
    expect(() => validateCollectionBody('clinics', bad, { partial: false })).toThrow(BadRequestException);
  });

  it('rejects unknown fields', () => {
    const bad = { ...validClinic, hacked: true };
    expect(() => validateCollectionBody('clinics', bad, { partial: false })).toThrow(BadRequestException);
  });

  it('requires the slug-source field on create but not on partial update', () => {
    const { name, ...noName } = validClinic;
    expect(() => validateCollectionBody('clinics', noName, { partial: false })).toThrow(BadRequestException);
    // partial update of a single non-slug field is allowed
    expect(() => validateCollectionBody('clinics', { bookable: false }, { partial: true })).not.toThrow();
  });

  it('validates billist as { sk: string[], en: string[] }', () => {
    const bad = { ...validClinic, schedule: { sk: 'not-an-array', en: [] } };
    expect(() => validateCollectionBody('clinics', bad, { partial: false })).toThrow(BadRequestException);
  });

  it('rejects an unknown collection', () => {
    expect(() => validateCollectionBody('bogus', validClinic, { partial: false })).toThrow(BadRequestException);
  });
});

describe('validateSingletonBody', () => {
  it('accepts nested pages shape with bilingual leaves', () => {
    const pages = {
      hero: { badge: { sk: 'a', en: 'a' }, title: { sk: 'b', en: 'b' }, subtitle: { sk: 'c', en: 'c' } },
      about: { title: { sk: 'd', en: 'd' }, body: { sk: 'e', en: 'e' } },
      aps: { title: { sk: 'f', en: 'f' }, note: { sk: 'g', en: 'g' } },
    };
    expect(() => validateSingletonBody('pages', pages)).not.toThrow();
  });

  it('rejects a pages leaf that is not bilingual', () => {
    const pages = { hero: { badge: 'plain string' } };
    expect(() => validateSingletonBody('pages', pages)).toThrow(BadRequestException);
  });

  it('validates hospital bilingual fields', () => {
    expect(() => validateSingletonBody('hospital', { name: 'Nemocnica', tagline: { sk: 'x', en: 'y' } })).not.toThrow();
    expect(() => validateSingletonBody('hospital', { tagline: 'plain' })).toThrow(BadRequestException);
  });
});
