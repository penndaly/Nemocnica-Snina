/**
 * GET /api/payments/receipt/[transactionRef]
 * Proxies payment receipt PDF download to NestJS.
 * Patient session required. Audited server-side.
 */
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ transactionRef: string }> },
) {
  const { transactionRef } = await params;
  const sessionToken = req.cookies.get('ns_patient_session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE}/api/payments/receipt/${transactionRef}`, {
      headers: {
        'x-patient-session': sessionToken,
        'x-forwarded-for':   req.headers.get('x-forwarded-for') ?? '',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'receipt_not_found' }, { status: res.status });
    }

    const pdf = await res.arrayBuffer();
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-${transactionRef}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
