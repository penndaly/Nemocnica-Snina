/**
 * Portal OIDC login initiator — GET /[lang]/portal/login
 * Generates a PKCE code verifier + random state, stores the verifier in an
 * httpOnly cookie, then redirects the browser to the IdP authorization URL.
 *
 * The verifier is read back by the callback handler at /[lang]/portal/callback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { buildAuthUrl, generateCodeVerifier, generateNonce } from '@/lib/oidc-client';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;

  const verifier = generateCodeVerifier();
  const state    = randomBytes(16).toString('hex');
  const nonce    = generateNonce();

  const authUrl  = buildAuthUrl(state, verifier, lang, nonce);

  const res = NextResponse.redirect(authUrl);

  // Replay protection: the id_token's nonce must match this at callback.
  res.cookies.set('ns_oidc_nonce', nonce, {
    httpOnly: true,
    secure:   process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    maxAge:   600,
    path:     '/',
  });

  // Store verifier in httpOnly cookie for the callback to read
  res.cookies.set('ns_oidc_verifier', verifier, {
    httpOnly: true,
    secure:   process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    maxAge:   600, // 10 min — longer than any IdP round-trip
    path:     '/',
  });
  res.cookies.set('ns_oidc_state', state, {
    httpOnly: true,
    secure:   process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    maxAge:   600,
    path:     '/',
  });

  return res;
}
