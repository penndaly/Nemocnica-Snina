/**
 * Machine-translation provider abstraction (Sprint A3).
 *
 * Env-switched via MT_PROVIDER: `mock` (dev/CI — returns "[MT] " + source, with
 * glossary terms preserved) and `deepl` (prod — interface only; wired when the
 * API key + glossary are provisioned). Mirrors the wearables mock/live pattern.
 *
 * Machine output is ALWAYS a draft: it never auto-publishes. The translation
 * review gate (lifecycle hook + /api/cms/translations) is the publish guard.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TranslateRequest {
  text: string;
  sourceLocale: string; // 'sk'
  targetLocale: string; // cs|pl|hu|uk
}

@Injectable()
export class TranslationProviderService {
  private readonly logger = new Logger(TranslationProviderService.name);
  private readonly provider: 'mock' | 'deepl';
  private readonly targets: string[];

  constructor(private readonly cfg: ConfigService) {
    this.provider = (cfg.get<string>('MT_PROVIDER') as 'mock' | 'deepl') ?? 'mock';
    this.targets = (cfg.get<string>('MT_TARGET_LOCALES') ?? 'cs,pl,hu,uk').split(',').map((s) => s.trim());
  }

  get targetLocales(): string[] {
    return this.targets;
  }

  /**
   * Translate, preserving locked glossary terms verbatim (brand/clinical terms
   * must not be machine-mangled). The mock provider keeps glossary terms intact
   * and prefixes "[MT] " so reviewers can see it is unreviewed machine output.
   */
  async translate(req: TranslateRequest, glossary: string[] = DEFAULT_GLOSSARY): Promise<string> {
    if (this.provider === 'deepl') {
      // TODO(prod): POST api-free.deepl.com/v2/translate with MT_DEEPL_API_KEY +
      // MT_GLOSSARY_ID; respect MT glossary for medical/hospital terms.
      this.logger.warn('DeepL provider not wired — returning source unchanged');
      return req.text;
    }
    // mock — glossary terms preserved (already verbatim in source); flag as MT.
    return `[MT] ${req.text}`;
  }

  /** Returns the glossary terms present (verbatim-preserved) in a string. */
  preservedTerms(text: string, glossary: string[] = DEFAULT_GLOSSARY): string[] {
    return glossary.filter((term) => text.includes(term));
  }
}

/** Locked terms — brand + clinical names that must not be machine-translated. */
export const DEFAULT_GLOSSARY = [
  'Nemocnica Snina',
  'APS',
  'OAIM',
  'JIS',
  'FRO',
  'LSPP',
  'eDohoda',
  'eZdravie',
  'NCZI',
];
