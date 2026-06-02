import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const res = NextResponse.redirect(new URL(`/${lang}/portal`, req.url));
  res.cookies.delete('ns_patient_session');
  return res;
}
