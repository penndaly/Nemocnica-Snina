/**
 * GET /api/telehealth/sessions/[id]/intake
 * Physician fetches the patient's pre-call intake data.
 * Requires physician admin JWT.
 */
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:3001';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE}/api/telehealth/sessions/${id}/intake`, {
      headers: {
        Authorization: authHeader,
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
