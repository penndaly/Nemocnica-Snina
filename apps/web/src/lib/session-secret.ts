/**
 * Shared patient-session signing secret + audience for the portal OIDC flow.
 *
 * Fails fast in production if JWT_SECRET is unset/weak — previously each route
 * silently fell back to a hardcoded public constant, so a missing prod env var
 * meant any patient session could be forged. The dev fallback is dev-only.
 */
function resolveSecret(): string {
  const s = process.env['JWT_SECRET'];
  if (s && s.length >= 32) return s;
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('JWT_SECRET must be set to a >=32-character value in production');
  }
  return 'dev-secret-min-32-chars-long-xxx';
}

export const SESSION_SECRET = new TextEncoder().encode(resolveSecret());

/** Audience claim binding a token to patient endpoints (vs staff). */
export const PATIENT_AUDIENCE = 'ns.patient';
