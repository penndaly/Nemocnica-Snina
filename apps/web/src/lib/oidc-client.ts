/**
 * eID / OIDC patient authentication client.
 * Uses auth-code + PKCE flow against Slovensko.sk OIDC broker.
 * OIDC_MOCK_ENABLED=true swaps in the local mock IdP for dev/CI.
 *
 * The verifier is stored in an httpOnly session cookie; the
 * access token is exchanged server-side (never sent to the browser).
 * Patient identity is mapped to a short-lived session token stored
 * in an httpOnly cookie — no patient data is persisted in our DB.
 */
import { randomBytes, createHash } from 'crypto';

const ISSUER        = process.env['OIDC_MOCK_ENABLED'] === 'true'
  ? `http://localhost:${process.env['OIDC_MOCK_PORT'] ?? 4010}`
  : (process.env['OIDC_ISSUER_URL'] ?? 'https://oidc.slovensko.sk');
const CLIENT_ID     = process.env['OIDC_CLIENT_ID']     ?? 'dev-client';
const CLIENT_SECRET = process.env['OIDC_CLIENT_SECRET'] ?? 'dev-secret';
const REDIRECT_URI  = process.env['OIDC_REDIRECT_URI']  ?? 'http://localhost:3000/sk/portal/callback';
const SCOPES        = process.env['OIDC_SCOPES']         ?? 'openid profile';

// PKCE helpers
export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// Build the authorization URL
export function buildAuthUrl(state: string, verifier: string, locale = 'sk'): string {
  const challenge = generateCodeChallenge(verifier);
  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             CLIENT_ID,
    redirect_uri:          REDIRECT_URI.replace('/sk/', `/${locale}/`),
    scope:                 SCOPES,
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  });
  return `${ISSUER}/authorize?${params.toString()}`;
}

export interface TokenResponse {
  access_token:  string;
  id_token:      string;
  token_type:    string;
  expires_in:    number;
}

// Exchange auth code for tokens (server-side only)
export async function exchangeCode(
  code: string,
  verifier: string,
  locale = 'sk',
): Promise<TokenResponse> {
  const tokenEndpoint = `${ISSUER}/token`;
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  REDIRECT_URI.replace('/sk/', `/${locale}/`),
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code_verifier: verifier,
  });

  const res = await fetch(tokenEndpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<TokenResponse>;
}

export interface PatientIdentity {
  sub:   string;  // Slovensko.sk subject identifier
  name?: string;
  // No RC or sensitive fields stored on web tier
}

// Fetch userinfo from the IdP and return only what we need
export async function fetchUserinfo(accessToken: string): Promise<PatientIdentity> {
  const userinfoEndpoint = `${ISSUER}/userinfo`;
  const res = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Userinfo failed: ${res.status}`);
  const data = await res.json() as Record<string, unknown>;
  return { sub: String(data['sub'] ?? ''), ...(data['name'] ? { name: String(data['name']) } : {}) };
}
