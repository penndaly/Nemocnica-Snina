import type { AbstractIntlMessages } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isValidLocale } from './config';
import skMessages from '../messages/sk.json';

type Messages = Record<string, unknown>;

/**
 * Deep-merge `locale` over the Slovak source messages.
 *
 * cs/pl/hu/uk are partial — they currently lack the `telehealth`, `wearables`
 * and `room` namespaces. next-intl throws MISSING_MESSAGE on a missing key,
 * which failed the production build during prerender (`next build` renders
 * every locale). Falling back key-by-key to sk means an untranslated string
 * renders in Slovak instead of taking the page down.
 *
 * This applies to UI chrome shipped in this repo, not to CMS clinical content —
 * machine-translated clinical content stays draft-gated server-side.
 */
function mergeMessages(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const existing = out[k];
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) &&
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? mergeMessages(existing as Messages, v as Messages)
        : v;
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isValidLocale(requested ?? '') ? requested! : defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default as Messages;

  return {
    locale,
    messages: (locale === 'sk'
      ? messages
      : mergeMessages(skMessages as Messages, messages)) as AbstractIntlMessages,
  };
});
