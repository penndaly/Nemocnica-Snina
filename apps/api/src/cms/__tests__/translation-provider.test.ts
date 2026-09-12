import { ConfigService } from '@nestjs/config';
import { TranslationProviderService, DEFAULT_GLOSSARY, UnsupportedTranslationLocaleError, DEEPL_TARGET_LOCALES } from '../translation-provider.service';

const cfg = (over: Record<string, unknown> = {}) => ({
  get: (k: string) => ({ MT_PROVIDER: 'mock', MT_TARGET_LOCALES: 'cs,pl,hu,uk', ...over }[k]),
}) as unknown as ConfigService;

describe('TranslationProviderService (mock)', () => {
  it('flags machine output with an [MT] prefix (never silently authoritative)', async () => {
    const svc = new TranslationProviderService(cfg());
    const out = await svc.translate({ text: 'Chirurgia', sourceLocale: 'sk', targetLocale: 'cs' });
    expect(out.startsWith('[MT] ')).toBe(true);
  });

  it('reports preserved glossary terms present in the source', () => {
    const svc = new TranslationProviderService(cfg());
    const terms = svc.preservedTerms('Nemocnica Snina organizuje APS a OAIM');
    expect(terms).toEqual(expect.arrayContaining(['Nemocnica Snina', 'APS', 'OAIM']));
  });

  it('exposes the configured target locales', () => {
    const svc = new TranslationProviderService(cfg());
    expect(svc.targetLocales).toEqual(['cs', 'pl', 'hu', 'uk']);
  });

  it('glossary contains brand + clinical terms', () => {
    expect(DEFAULT_GLOSSARY).toEqual(expect.arrayContaining(['Nemocnica Snina', 'NCZI', 'eZdravie']));
  });

  // ── Unsupported-target guard (CMS-1 follow-up; protects Rusyn) ──────────
  it('translate() throws for rue — Rusyn is human-translated and must never reach a provider', async () => {
    const svc = new TranslationProviderService(cfg());
    await expect(svc.translate({ text: 'Chirurgia', sourceLocale: 'sk', targetLocale: 'rue' }))
      .rejects.toThrow(UnsupportedTranslationLocaleError);
  });

  it('translate() throws for rue under the deepl provider too', async () => {
    const svc = new TranslationProviderService(cfg({ MT_PROVIDER: 'deepl' }));
    await expect(svc.translate({ text: 'Chirurgia', sourceLocale: 'sk', targetLocale: 'rue' }))
      .rejects.toThrow(/not a supported machine-translation target/);
  });

  it('refuses to construct when MT_TARGET_LOCALES contains an unsupported locale', () => {
    expect(() => new TranslationProviderService(cfg({ MT_TARGET_LOCALES: 'cs,pl,hu,uk,rue' })))
      .toThrow(UnsupportedTranslationLocaleError);
  });

  it('mock is not more permissive than deepl (same supported set)', () => {
    const svc = new TranslationProviderService(cfg());
    for (const l of ['cs', 'pl', 'hu', 'uk']) expect(svc.supportsTarget(l)).toBe(true);
    expect(svc.supportsTarget('rue')).toBe(false);
    expect(DEEPL_TARGET_LOCALES.has('rue')).toBe(false);
  });
});
