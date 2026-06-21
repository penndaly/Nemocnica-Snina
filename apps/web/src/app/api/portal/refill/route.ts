/**
 * POST /api/portal/refill
 * Proxies medication refill requests to the NestJS API.
 * Body: { medicationRequestId: string }
 * Response: { queued: true } | 400 (rate-limited) | 401
 */
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get('ns_patient_session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const body = await req.json() as Record<string, string>;

  try {
    const res = await fetch(`${API_BASE}/api/portal/refill`, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-patient-session': sessionToken,
        'x-forwarded-for':   req.headers.get('x-forwarded-for') ?? '',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
