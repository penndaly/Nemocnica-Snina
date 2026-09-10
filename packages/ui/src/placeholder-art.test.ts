import { sceneFor, sceneDataUri, monogram } from './placeholder-art';

describe('sceneFor', () => {
  it('resolves every explicit slot id from the media plan', () => {
    const explicit: Record<string, string> = {
      'home-campus': 'campus',
      'home-care-1': 'nurse',
      'home-care-2': 'consult',
      'home-care-3': 'equipment',
      'about-hero': 'campus',
      'about-history': 'archive',
      'about-invest': 'equipment',
      'patients-hero': 'reception',
      'patients-admission': 'reception',
      'patients-pharmacy': 'pharmacy',
      'patients-room': 'ward',
      'patients-visit': 'ward',
      'patients-nurse': 'nurse',
      'patients-discharge': 'corridor',
      'careers-hero': 'team',
      'careers-1': 'nurse',
      'careers-2': 'corridor',
      'careers-3': 'education',
      'education-hero': 'education',
      'departments-hero': 'corridor',
      'clinics-hero': 'waiting',
      'diagnostics-hero': 'imaging',
      'diag-1': 'imaging',
      'diag-2': 'lab',
      'diag-3': 'equipment',
      'services-hero': 'nurse',
      'physicians-hero': 'team',
      'news-hero': 'news',
      'contact-hero': 'aerial',
      'booking-hero': 'booking',
      'telehealth-hero': 'video',
      'teleconsult-hero': 'video',
      'disclosure-hero': 'admin',
    };
    for (const [id, scene] of Object.entries(explicit)) {
      expect(sceneFor(id)).toBe(scene);
    }
  });

  it('resolves dept-<id> from the department map', () => {
    expect(sceneFor('dept-chirurgia')).toBe('equipment');
    expect(sceneFor('dept-interne')).toBe('ward');
    expect(sceneFor('dept-gynekologia')).toBe('nurse');
    expect(sceneFor('dept-pediatria')).toBe('ward');
    expect(sceneFor('dept-oaim')).toBe('equipment');
    expect(sceneFor('dept-fro')).toBe('education');
    expect(sceneFor('dept-neonatologia')).toBe('nurse');
    expect(sceneFor('dept-neurologicka')).toBe('consult');
    expect(sceneFor('dept-ortopedicka')).toBe('imaging');
    expect(sceneFor('dept-kardiologicka')).toBe('equipment');
  });

  it('resolves dept-<id>-hero the same as dept-<id>', () => {
    expect(sceneFor('dept-chirurgia-hero')).toBe('equipment');
    expect(sceneFor('dept-neurologicka-hero')).toBe('consult');
  });

  it('falls back to ward for an unmapped department id', () => {
    expect(sceneFor('dept-unknown-dept')).toBe('ward');
  });

  it('resolves doc-<id> to portrait', () => {
    expect(sceneFor('doc-kulan')).toBe('portrait');
    expect(sceneFor('doc-anything-at-all')).toBe('portrait');
  });

  it('regex fallback: lab/biochem/hemato -> lab', () => {
    expect(sceneFor('diag-lab-extra')).toBe('lab');
    expect(sceneFor('some-biochem-slot')).toBe('lab');
    expect(sceneFor('hemato-panel')).toBe('lab');
  });

  it('regex fallback: pharm/lekar(en)? -> pharmacy', () => {
    expect(sceneFor('random-pharm-slot')).toBe('pharmacy');
    expect(sceneFor('lekaren-facility')).toBe('pharmacy');
    expect(sceneFor('lekar-x')).toBe('pharmacy');
  });

  it('regex fallback: docs-prefixed non-doc- ids -> docs', () => {
    expect(sceneFor('documents-index')).toBe('docs');
    expect(sceneFor('docs-list')).toBe('docs');
  });

  it('regex fallback: generic "hero" -> campus', () => {
    expect(sceneFor('some-unmapped-hero')).toBe('campus');
  });

  it('final fallback -> ward', () => {
    expect(sceneFor('totally-unrelated-slot')).toBe('ward');
  });

  it('handles a missing/empty id', () => {
    expect(sceneFor(null)).toBe('campus');
    expect(sceneFor(undefined)).toBe('campus');
    expect(sceneFor('')).toBe('campus');
  });
});

describe('sceneDataUri', () => {
  it('returns a memoised, URL-encoded (not base64) SVG data URI', () => {
    const a = sceneDataUri('campus');
    const b = sceneDataUri('campus');
    expect(a).toBe(b);
    expect(a.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(a).not.toContain('base64');
    expect(decodeURIComponent(a.replace('data:image/svg+xml;charset=utf-8,', ''))).toContain('<svg');
  });

  it('falls back to the ward scene for an unknown name cast past the type', () => {
    const uri = sceneDataUri('nonexistent-scene' as never);
    expect(uri).toBe(sceneDataUri('ward'));
  });
});

describe('monogram', () => {
  it('returns a deterministic, URL-encoded SVG data URI containing the initials', () => {
    const a = monogram('AK');
    const b = monogram('AK');
    expect(a).toBe(b);
    expect(a.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    const decoded = decodeURIComponent(a.replace('data:image/svg+xml;charset=utf-8,', ''));
    expect(decoded).toContain('>AK<');
  });

  it('strips angle brackets and ampersands from initials', () => {
    const decoded = decodeURIComponent(monogram('<A&B>').replace('data:image/svg+xml;charset=utf-8,', ''));
    expect(decoded).toContain('>AB<');
  });
});
