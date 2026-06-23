/**
 * Wearables proxy — forwards /api/portal/wearables/* to the NestJS API
 * /api/wearables/*, attaching the httpOnly ns_patient_session cookie as the
 * x-patient-session header. The browser never touches the session JWT, mirroring
 * the established portal proxy pattern (see /api/portal/labs).
 *
 * Sprint W4: GET (list/readings/consents/audit/sync-job), POST (connect/sync/upload),
 * PUT (consent), DELETE (disconnect).
 */
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:3001';

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const sessionToken = req.cookies.get('ns_patient_session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const search = req.nextUrl.search;
  const target = `${API_BASE}/api/wearables/${path.map(encodeURIComponent).join('/')}${search}`;

  const headers: Record<string, string> = {
    'x-patient-session': sessionToken,
    'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '',
  };

  const init: RequestInit = { method: req.method, headers, redirect: 'manual' };
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    const text = await req.text();
    if (text) {
      init.body = text;
      headers['Content-Type'] = 'application/json';
    }
  }

  try {
    const res = await fetch(target, init);
    const ct = res.headers.get('content-type') ?? '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    return NextResponse.json(data as unknown, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
