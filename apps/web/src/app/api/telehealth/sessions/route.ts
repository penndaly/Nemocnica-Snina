/**
 * GET /api/telehealth/sessions
 * Proxies to NestJS for listing the authenticated patient's telehealth sessions.
 * Forwards the httpOnly session cookie as a bearer token.
 */
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:3001';

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get('ns_patient_session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';
  const queryString = status ? `?patient=me&status=${encodeURIComponent(status)}` : '?patient=me';

  try {
    const res = await fetch(`${API_BASE}/api/telehealth/sessions${queryString}`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.json() as Record<string, unknown>;
      return NextResponse.json(body, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
