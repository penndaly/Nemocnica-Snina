/**
 * GET /api/portal/appointments/[fhirId]/cancel-token
 * Returns the cancel token for a booking so the patient can deep-link
 * to /[lang]/objednanie/zrusit/[token].
 * Patient session required.
 */
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fhirId: string }> },
) {
  const { fhirId } = await params;
  const sessionToken = req.cookies.get('ns_patient_session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE}/api/portal/appointments/${fhirId}/cancel-token`, {
      headers: {
        'x-patient-session': sessionToken,
        'x-forwarded-for':   req.headers.get('x-forwarded-for') ?? '',
      },
    });

    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
