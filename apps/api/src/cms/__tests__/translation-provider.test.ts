import { ConfigService } from '@nestjs/config';
import { TranslationProviderService, DEFAULT_GLOSSARY } from '../translation-provider.service';

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
});
