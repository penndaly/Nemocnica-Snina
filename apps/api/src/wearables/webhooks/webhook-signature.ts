/**
 * Webhook signature verification (Sprint W6).
 *
 * Garmin (and future platforms) sign the raw request body with HMAC-SHA1. We
 * compare in constant time. Pure + dependency-free so it is unit-testable in
 * isolation and reusable across webhook handlers.
 */
import { createHmac, timingSafeEqual } from 'crypto';

export function computeHmacSha1(rawBody: Buffer | string, key: string): string {
  return createHmac('sha1', key).update(rawBody).digest('hex');
}

/** Constant-time validation. Returns false on any mismatch/format error. */
export function verifyHmacSha1(rawBody: Buffer | string, signature: string | undefined, key: string): boolean {
  if (!signature) return false;
  const expected = computeHmacSha1(rawBody, key);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Simple in-memory sliding-window rate limiter (per key, e.g. source IP). */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly limit: number, private readonly windowMs: number) {}

  /** Returns true if the request is allowed; false if the limit is exceeded. */
  allow(key: string, now: number): boolean {
    const cutoff = now - this.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(now);
    this.hits.set(key, arr);
    return true;
  }
}
