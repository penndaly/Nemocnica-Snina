/**
 * POST /api/portal/labs?action=challenge|download&id=<observationId>
 *
 * Proxies step-up 2FA requests to the NestJS API, forwarding the
 * httpOnly session cookie as a header. The browser never touches the session JWT.
 *
 * action=challenge  → sends OTP SMS (body: { phone })
 * action=download   → verifies OTP, returns PDF blob (body: { phone, otp })
 */
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get('ns_patient_session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const action = searchParams.get('action');   // 'challenge' | 'download'
  const id     = searchParams.get('id') ?? ''; // observation ID

  if (!action || !id) {
    return NextResponse.json({ error: 'Missing action or id' }, { status: 400 });
  }

  const body = await req.json() as Record<string, string>;

  try {
    const apiPath = action === 'challenge'
      ? `/api/portal/labs/${id}/pdf-challenge`
      : `/api/portal/labs/${id}/pdf-download`;

    const res = await fetch(`${API_BASE}${apiPath}`, {
      method: 'POST',
      headers: {
        'Content-Type':        'application/json',
        'x-patient-session':   sessionToken,
        'x-forwarded-for':     req.headers.get('x-forwarded-for') ?? '',
        'x-forwarded-email':   'portal-proxy',
      },
      body: JSON.stringify(body),
    });

    if (action === 'download' && res.ok) {
      const pdf = await res.arrayBuffer();
      return new NextResponse(pdf, {
        headers: {
          'Content-Type':        'application/pdf',
          'Content-Disposition': res.headers.get('Content-Disposition') ?? `attachment; filename="lab-result.pdf"`,
        },
      });
    }

    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
