import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { OAuthStateService } from '../oauth-state.service';
import { TokenCryptoService } from '../token-crypto.service';
import { InMemoryWearablesKv, WearablesRedisService } from '../wearables-redis.service';

const keyCfg = { get: () => 'a'.repeat(64) } as never;
const make = (kv: InMemoryWearablesKv | WearablesRedisService = new InMemoryWearablesKv()) =>
  new OAuthStateService(keyCfg, new TokenCryptoService(keyCfg), kv);

describe('OAuthStateService — Redis-backed CSRF hardening (WL9 Part A / WR-6)', () => {
  afterEach(() => jest.useRealTimers());

  it('accepts a freshly issued, platform-matched state once', async () => {
    const svc = make();
    const state = await svc.generateState('tok-1', 'fitbit');
    expect(await svc.validateState(state, 'fitbit')).toEqual({ patientToken: 'tok-1' });
  });

  it('rejects a reused state (one-time use, atomic GETDEL) → 400', async () => {
    const svc = make();
    const state = await svc.generateState('tok-1', 'fitbit');
    await svc.validateState(state, 'fitbit');
    await expect(svc.validateState(state, 'fitbit')).rejects.toThrow(BadRequestException);
  });

  it('rejects an expired state → 400 INVALID_OAUTH_STATE', async () => {
    jest.useFakeTimers();
    const svc = make();
    const state = await svc.generateState('tok-1', 'fitbit');
    jest.advanceTimersByTime(16 * 60 * 1000); // past the 15-minute TTL
    await expect(svc.validateState(state, 'fitbit')).rejects.toThrow('INVALID_OAUTH_STATE');
  });

  it('rejects a forged / unknown state → 400 INVALID_OAUTH_STATE', async () => {
    const svc = make();
    await expect(svc.validateState('deadbeef.forged', 'fitbit')).rejects.toThrow('INVALID_OAUTH_STATE');
  });

  it('rejects a tampered HMAC → 400 (before any Redis read)', async () => {
    const svc = make();
    const state = await svc.generateState('tok-1', 'fitbit');
    const [nonce] = state.split('.');
    await expect(svc.validateState(`${nonce}.${'0'.repeat(64)}`, 'fitbit')).rejects.toThrow(BadRequestException);
  });

  it('rejects a state issued for another platform → STATE_PLATFORM_MISMATCH', async () => {
    const svc = make();
    const state = await svc.generateState('tok-1', 'withings');
    await expect(svc.validateState(state, 'fitbit')).rejects.toThrow('STATE_PLATFORM_MISMATCH');
  });

  it('a state is not accepted by an instance that never stored it (cross-instance isolation)', async () => {
    const a = make();
    const b = make(); // separate KV — simulates a node that never saw the nonce
    const state = await a.generateState('tok-1', 'fitbit');
    await expect(b.validateState(state, 'fitbit')).rejects.toThrow(BadRequestException);
  });

  it('fails closed with 503 when Redis is unavailable (no in-memory fallback)', async () => {
    const noRedis = new WearablesRedisService({ get: () => undefined } as never);
    expect(noRedis.available()).toBe(false);
    const svc = make(noRedis);
    await expect(svc.generateState('tok-1', 'fitbit')).rejects.toThrow(ServiceUnavailableException);
  });
});
