/**
 * OIDC callback handler — GET /[lang]/portal/callback?code=&state=
 * Exchanges the auth code for tokens, stores a short-lived session cookie,
 * then redirects to the portal dashboard.
 * The code verifier is read from the ns_oidc_verifier httpOnly cookie set at login.
 */
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, fetchUserinfo } from '@/lib/oidc-client';
import { SignJWT } from 'jose';
import { SESSION_SECRET, PATIENT_AUDIENCE } from '@/lib/session-secret';

const SESSION_MAX_AGE = 30 * 60; // 30 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  const { searchParams } = req.nextUrl;
  const code     = searchParams.get('code');
  const state    = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(new URL(`/${lang}/portal?error=oidc_${errorParam}`, req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL(`/${lang}/portal?error=missing_code`, req.url));
  }

  // CSRF protection: the state returned by the IdP must match the one we stored
  // at login (ns_oidc_state httpOnly cookie). Without this check the OIDC code
  // flow has no defense against login-CSRF / session fixation.
  const expectedState = req.cookies.get('ns_oidc_state')?.value;
  if (!expectedState || expectedState !== state) {
    const res = NextResponse.redirect(new URL(`/${lang}/portal?error=invalid_state`, req.url));
    res.cookies.delete('ns_oidc_state');
    res.cookies.delete('ns_oidc_verifier');
    return res;
  }

  const verifier = req.cookies.get('ns_oidc_verifier')?.value;
  if (!verifier) {
    return NextResponse.redirect(new URL(`/${lang}/portal?error=missing_verifier`, req.url));
  }

  try {
    const tokens   = await exchangeCode(code, verifier, lang);
    const identity = await fetchUserinfo(tokens.access_token);

    // Mint a short-lived session JWT (no sensitive claims — just the opaque sub)
    const sessionToken = await new SignJWT({ sub: identity.sub, name: identity.name ?? '' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      // Audience binds this token to patient endpoints; the API rejects it on
      // staff routes (and rejects staff tokens here) despite the shared secret.
      .setAudience(PATIENT_AUDIENCE)
      .setExpirationTime(`${SESSION_MAX_AGE}s`)
      .sign(SESSION_SECRET);

    const res = NextResponse.redirect(new URL(`/${lang}/portal`, req.url));

    // httpOnly, Secure, SameSite=Lax session cookie
    res.cookies.set('ns_patient_session', sessionToken, {
      httpOnly: true,
      secure:   process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge:   SESSION_MAX_AGE,
      path:     '/',
    });
    // Clear the PKCE verifier
    res.cookies.delete('ns_oidc_verifier');

    return res;
  } catch (err) {
    console.error('OIDC callback error:', err);
    return NextResponse.redirect(new URL(`/${lang}/portal?error=auth_failed`, req.url));
  }
}
