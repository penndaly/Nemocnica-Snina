/**
 * POST /api/telehealth/sessions/[id]/save-summary
 * Physician posts clinical note + follow-up. Triggers telehealth.session.ended via NestJS.
 * Requires physician admin JWT in Authorization header.
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

  const body = await req.json() as Record<string, unknown>;

  try {
    // End session (triggers HIS queue event) via existing /end endpoint
    const endRes = await fetch(`${API_BASE}/api/telehealth/sessions/${id}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '',
      },
      body: JSON.stringify({
        clinicalNote:                body['clinicalNote'],
        followUpRecommendationSk:    body['followUpRecommendationSk'],
        followUpRecommendationEn:    body['followUpRecommendationEn'],
        prescriptionIssued:          body['prescriptionIssued'],
      }),
    });
    if (!endRes.ok) {
      const errBody = await endRes.json() as Record<string, unknown>;
      return NextResponse.json(errBody, { status: endRes.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
