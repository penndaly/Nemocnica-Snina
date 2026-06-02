/**
 * ISR revalidation webhook — called by Strapi lifecycle hooks when content is saved.
 * Verifies the STRAPI_WEBHOOK_SECRET header before flushing the Next.js cache.
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

const LOCALES = ['sk', 'cs', 'pl', 'hu', 'uk', 'en'];
const SECRET  = process.env['STRAPI_WEBHOOK_SECRET'] ?? '';

// Map Strapi model names to the Next.js routes that should be invalidated
const MODEL_PATHS: Record<string, string[]> = {
  department:  LOCALES.flatMap((l) => [`/${l}/oddelenia`, `/${l}/oddelenia/[slug]`, `/${l}`]),
  clinic:      LOCALES.flatMap((l) => [`/${l}/ambulancie`, `/${l}/objednanie`, `/${l}`]),
  physician:   LOCALES.flatMap((l) => [`/${l}/lekari`, `/${l}`, `/${l}/oddelenia/[slug]`]),
  service:     LOCALES.flatMap((l) => [`/${l}/sluzby`]),
  facility:    LOCALES.flatMap((l) => [`/${l}/diagnostika`]),
  'news-item': LOCALES.flatMap((l) => [`/${l}/aktuality`, `/${l}`]),
  disclosure:  LOCALES.flatMap((l) => [`/${l}/zverejnovanie`]),
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-strapi-webhook-secret');
  if (!SECRET || secret !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { model?: string } = {};
  try { body = await req.json() as typeof body; } catch { /* no body */ }

  const paths = body.model ? MODEL_PATHS[body.model] ?? [] : Object.values(MODEL_PATHS).flat();

  for (const path of [...new Set(paths)]) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: paths.length, timestamp: new Date().toISOString() });
}
