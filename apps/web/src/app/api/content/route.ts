/**
 * GET /api/content?type=clinics|physicians|disclosures&locale=sk
 *
 * Thin server-side proxy so client components can fetch CMS data without
 * shipping Strapi credentials to the browser. Responses use the same ISR
 * revalidation as the server components.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getClinics, getPhysicians, getDisclosures } from '@/lib/strapi-client';
import type { Locale } from '@ns/types';

const VALID_LOCALES = new Set(['sk', 'cs', 'pl', 'hu', 'uk', 'en']);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type   = searchParams.get('type')   ?? '';
  const locale = (VALID_LOCALES.has(searchParams.get('locale') ?? '') ? searchParams.get('locale') : 'sk') as Locale;

  try {
    switch (type) {
      case 'clinics':
        return NextResponse.json(await getClinics(locale), {
          headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
        });
      case 'physicians':
        return NextResponse.json(await getPhysicians(locale), {
          headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
        });
      case 'disclosures':
        return NextResponse.json(await getDisclosures(locale), {
          headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
        });
      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
