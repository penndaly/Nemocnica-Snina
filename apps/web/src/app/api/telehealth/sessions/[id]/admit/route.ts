/**
 * POST /api/telehealth/sessions/[id]/admit
 * Physician-side proxy — admits the patient (waiting→active).
 * Requires staff JWT session (forwarded as bearer token from the physician room).
 */
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:3001';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE}/api/telehealth/sessions/${id}/admit`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '',
      },
    });
    if (!res.ok) {
      const body = await res.json() as Record<string, unknown>;
      return NextResponse.json(body, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
