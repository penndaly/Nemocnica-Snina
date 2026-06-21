/**
 * POST /api/telehealth/sessions/[id]/join
 * Proxies join-token requests to NestJS for both patient and physician roles.
 *
 * Patient: forwards ns_patient_session cookie as bearer token.
 * Physician: forwards Authorization header (admin JWT from sessionStorage).
 *            Body must include { role: 'physician', totpCode: string } for MFA re-verify.
 */
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:3001';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const role = body['role'] === 'physician' ? 'physician' : 'patient';

  // Pick authorization source based on role
  let authHeader: string;
  if (role === 'physician') {
    // Physician provides their admin JWT in the Authorization header
    authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'physician_not_authenticated' }, { status: 401 });
    }
  } else {
    // Patient uses httpOnly session cookie
    const sessionToken = req.cookies.get('ns_patient_session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
    }
    authHeader = `Bearer ${sessionToken}`;
  }

  try {
    const res = await fetch(`${API_BASE}/api/telehealth/sessions/${id}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.json() as Record<string, unknown>;
      return NextResponse.json(errBody, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
