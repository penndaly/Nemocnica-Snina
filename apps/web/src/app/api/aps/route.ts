/**
 * GET /api/aps
 *
 * Proxies the APS (ambulatory emergency service) live schedule from the NestJS API.
 * On any failure — network error, non-OK response, parse error — returns a safe
 * fallback with isFallback: true so the browser always gets valid data (never 5xx).
 *
 * Sprint S2: proxy pattern mirrors /api/portal/labs.
 */
import { NextResponse } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:3001';

export interface ApsEntry {
  date: string;
  from: string;
  to: string;
  facility: string;
  phone: string;
  address?: string;
  type: 'adult' | 'child' | 'dental';
}

export interface ApsRouteResponse {
  source: 'live' | 'cache' | 'fallback';
  updatedAt: string;
  schedule: ApsEntry[];
  isFallback?: true;
}

const FALLBACK: ApsRouteResponse = {
  source: 'fallback',
  updatedAt: new Date().toISOString(),
  isFallback: true,
  schedule: [
    {
      date: '',
      from: '00:00',
      to: '23:59',
      facility: 'Nemocnica Snina, s.r.o.',
      phone: '+421 57 766 01 11',
      address: 'Sládkovičova 300/3, 069 01 Snina',
      type: 'adult',
    },
  ],
};

export async function GET(): Promise<NextResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/aps/schedule?district=snina`, {
      headers: { Accept: 'application/json' },
      // Next.js: opt out of caching so the browser always gets fresh data from the NestJS layer
      // (NestJS handles its own Redis/mem-cache TTL)
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`NestJS APS endpoint returned HTTP ${res.status}`);
    }

    const data = await res.json() as ApsRouteResponse;

    // Validate the response has the expected shape
    if (!Array.isArray(data.schedule)) {
      throw new Error('APS response missing schedule array');
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        // Allow CDN / browser to cache for up to 5 minutes; revalidate in background
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    // Always return fallback — never let the browser see a 5xx
    console.error('[/api/aps] Falling back to static schedule:', String(err));
    return NextResponse.json(
      { ...FALLBACK, updatedAt: new Date().toISOString() },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
