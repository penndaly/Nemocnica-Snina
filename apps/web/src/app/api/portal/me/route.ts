/**
 * GET /api/portal/me
 * Validates the ns_patient_session httpOnly JWT cookie and returns the
 * patient's opaque identity (sub, name). Called by the portal page on mount
 * to determine if the user is already authenticated.
 *
 * 200 { sub, name } — valid session
 * 401 { error }     — missing or expired session
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getSessionSecret, PATIENT_AUDIENCE } from '@/lib/session-secret';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('ns_patient_session')?.value;
  if (!token) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), { audience: PATIENT_AUDIENCE });
    return NextResponse.json({
      sub:  String(payload['sub']  ?? ''),
      name: String(payload['name'] ?? ''),
    });
  } catch {
    return NextResponse.json({ error: 'invalid_session' }, { status: 401 });
  }
}
