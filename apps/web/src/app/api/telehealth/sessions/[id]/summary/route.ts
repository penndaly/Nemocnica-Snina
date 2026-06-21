/**
 * GET /api/telehealth/sessions/[id]/summary
 * Proxies summary fetch to NestJS. Requires patient session.
 *
 * POST /api/telehealth/sessions/[id]/summary?action=pdf-challenge|pdf-download
 * Step-up 2FA gate for PDF download (same pattern as lab PDF).
 */
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:3001';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sessionToken = req.cookies.get('ns_patient_session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE}/api/telehealth/sessions/${id}/summary`, {
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

// Step-up 2FA for PDF download
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sessionToken = req.cookies.get('ns_patient_session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const action = new URL(req.url).searchParams.get('action');
  const body = await req.json() as { phone?: string; otp?: string };

  if (action === 'pdf-challenge') {
    // Send SMS OTP via NestJS sms/challenge endpoint
    try {
      const res = await fetch(`${API_BASE}/api/portal/stepup/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ phone: body.phone, resource: `telehealth-summary-${id}` }),
      });
      if (!res.ok) return NextResponse.json({ error: 'challenge_failed' }, { status: res.status });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 502 });
    }
  }

  if (action === 'pdf-download') {
    try {
      const res = await fetch(`${API_BASE}/api/telehealth/sessions/${id}/summary/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ phone: body.phone, otp: body.otp }),
      });
      if (!res.ok) {
        const errBody = await res.json() as Record<string, unknown>;
        return NextResponse.json(errBody, { status: res.status });
      }
      const pdf = await res.arrayBuffer();
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="summary-${id}.pdf"`,
        },
      });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 502 });
    }
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
