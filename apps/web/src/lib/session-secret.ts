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

/**
 * Resolved per call, NOT at module load. `next build` runs route modules with
 * NODE_ENV=production to collect page data, so a module-level throw made the
 * production build fail unless a real JWT_SECRET was present at BUILD time —
 * a build-time secret that has nothing to do with the runtime one. Deferring
 * to first use keeps the fail-fast guarantee exactly where it matters (a
 * production request) while letting the image build without secrets.
 */
export function getSessionSecret(): Uint8Array {
  return new TextEncoder().encode(resolveSecret());
}

/** Audience claim binding a token to patient endpoints (vs staff). */
export const PATIENT_AUDIENCE = 'ns.patient';
