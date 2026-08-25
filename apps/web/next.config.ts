import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * CSP connect-src.
 *
 * `'self'` alone is correct only when the NestJS API is reverse-proxied onto
 * the web origin. In local dev (and any deploy where the API keeps its own
 * hostname) NEXT_PUBLIC_API_URL is cross-origin, and a bare `'self'` silently
 * blocks every admin/portal fetch in the browser. So the API origin — and the
 * LiveKit signalling socket — are folded in from config rather than hardcoded.
 * When the API is same-origin the extra entry collapses to a no-op.
 */
function connectSrc(): string {
  const origins = new Set<string>(["'self'"]);

  const add = (value: string | undefined, wsToo = false) => {
    if (!value) return;
    try {
      const u = new URL(value);
      origins.add(u.origin);
      // LiveKit upgrades to wss:; some browsers match the ws(s) scheme, not http(s).
      if (wsToo) origins.add(u.origin.replace(/^http/, 'ws'));
    } catch {
      /* not an absolute URL — nothing to allow */
    }
  };

  add(process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000');
  add(process.env['NEXT_PUBLIC_LIVEKIT_URL'], true);

  // Firebase Analytics (analytics-only integration — no Firestore/Auth/Storage).
  // Added only when a measurement ID is configured, so deploys without
  // analytics keep the tighter policy.
  if (process.env['NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID']) {
    origins.add('https://*.google-analytics.com');
    origins.add('https://*.analytics.google.com');
    origins.add('https://*.googletagmanager.com');
  }

  return `connect-src ${[...origins].join(' ')}`;
}

function scriptSrc(): string {
  const base = ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
  if (process.env['NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID']) base.push('https://*.googletagmanager.com');
  return `script-src ${base.join(' ')}`;
}

const nextConfig: NextConfig = {
  // Emits .next/standalone — a self-contained server with only the traced
  // dependencies, which is what infra/docker/Dockerfile.web ships. `next start`
  // continues to work unchanged for local dev and the CI e2e job.
  output: 'standalone',
  experimental: {
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // CMS media will be added here once Strapi URL is known
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc(),
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.google-analytics.com",
              connectSrc(),
            ].join('; '),
          },
        ],
      },
      {
        // The blanket Permissions-Policy above disables camera/microphone
        // site-wide, which also blocks getUserMedia on the telehealth video
        // room itself — patients/physicians could never actually join a
        // call. Re-allow for same-origin on just the room route. Next.js
        // applies the LAST matching config's value for a given header key,
        // so this overrides (not appends to) the block above for this path.
        source: '/:lang/telehealth/konzultacia/:sessionId*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
