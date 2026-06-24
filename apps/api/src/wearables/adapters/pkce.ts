/**
 * PKCE (RFC 7636) helpers for OAuth2 adapters that require a code challenge
 * (e.g. Dexcom). The challenge is the base64url(SHA-256(verifier)).
 *
 * Stateless derivation: an adapter can derive the verifier deterministically
 * from the OAuth state nonce + server key (HMAC), so getAuthUrl (which builds
 * the challenge) and exchangeCode (which needs the verifier) agree without any
 * extra round trip — the service is the single state-consume point.
 */
import { createHash, createHmac } from 'crypto';

export function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url(SHA-256(verifier)) — the S256 code challenge. */
export function pkceChallenge(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest());
}

/**
 * Deterministically derive a high-entropy code verifier from the state nonce and
 * the server key. Same (nonce, key) → same verifier in getAuthUrl and exchangeCode.
 */
export function deriveCodeVerifier(stateNonce: string, key: string): string {
  return base64url(createHmac('sha256', key).update(`pkce:${stateNonce}`).digest());
}
