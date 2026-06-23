import { computeHmacSha1, verifyHmacSha1, SlidingWindowRateLimiter } from '../webhooks/webhook-signature';

const KEY = 'garmin-secret';
const body = Buffer.from(JSON.stringify({ userId: 'u1', readings: [] }));

describe('webhook HMAC-SHA1 verification', () => {
  it('accepts a correctly signed body', () => {
    const sig = computeHmacSha1(body, KEY);
    expect(verifyHmacSha1(body, sig, KEY)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const sig = computeHmacSha1(body, KEY);
    expect(verifyHmacSha1(Buffer.from('{"userId":"u1","readings":[1]}'), sig, KEY)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(verifyHmacSha1(body, undefined, KEY)).toBe(false);
  });

  it('rejects a signature made with the wrong key', () => {
    expect(verifyHmacSha1(body, computeHmacSha1(body, 'wrong'), KEY)).toBe(false);
  });
});

describe('SlidingWindowRateLimiter', () => {
  it('allows up to the limit then blocks (429 path)', () => {
    const rl = new SlidingWindowRateLimiter(3, 60_000);
    const now = 1_000_000;
    expect(rl.allow('ip', now)).toBe(true);
    expect(rl.allow('ip', now)).toBe(true);
    expect(rl.allow('ip', now)).toBe(true);
    expect(rl.allow('ip', now)).toBe(false);
  });

  it('frees capacity once the window rolls over', () => {
    const rl = new SlidingWindowRateLimiter(1, 1000);
    expect(rl.allow('ip', 0)).toBe(true);
    expect(rl.allow('ip', 500)).toBe(false);
    expect(rl.allow('ip', 2000)).toBe(true);
  });
});
