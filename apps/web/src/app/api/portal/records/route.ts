/**
 * GET /api/portal/records
 * Proxies the patient-record request to the NestJS API, forwarding the
 * httpOnly session cookie as an Authorization header so the API can
 * validate the patient's identity without the browser sending raw credentials.
 *
 * The session cookie is httpOnly and never accessible to JavaScript on
 * the client — this server route reads it and passes it to the API.
 */
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:3001';

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get('ns_patient_session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE}/api/portal/records`, {
      headers: {
        'x-patient-session': sessionToken,
        'x-forwarded-for':   req.headers.get('x-forwarded-for') ?? req.ip ?? '',
        'x-forwarded-email': `portal-proxy`,
      },
      cache: 'no-store', // Patient records must never be cached
    });

    if (!res.ok) {
      const body = await res.json() as Record<string, unknown>;
      return NextResponse.json(body, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
