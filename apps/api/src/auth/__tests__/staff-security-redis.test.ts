import { ConfigService } from '@nestjs/config';
import { StaffSecurityRedis } from '../staff-security.redis';

// No REDIS_URL → in-memory fallback (the path exercised in CI without infra).
const cfg = { get: () => undefined } as unknown as ConfigService;

describe('StaffSecurityRedis (in-memory fallback)', () => {
  it('blacklists a jti and reports it', async () => {
    const r = new StaffSecurityRedis(cfg);
    expect(await r.isBlacklisted('jti-1')).toBe(false);
    await r.blacklistJti('jti-1', 60);
    expect(await r.isBlacklisted('jti-1')).toBe(true);
  });

  it('counts login failures and resets them', async () => {
    const r = new StaffSecurityRedis(cfg);
    expect(await r.incrLoginFailure('a@x.sk')).toBe(1);
    expect(await r.incrLoginFailure('a@x.sk')).toBe(2);
    await r.resetLoginFailures('a@x.sk');
    expect(await r.incrLoginFailure('a@x.sk')).toBe(1);
  });

  it('counts email sends per address independently (case-insensitive)', async () => {
    const r = new StaffSecurityRedis(cfg);
    expect(await r.incrEmailSend('Jana@x.sk')).toBe(1);
    expect(await r.incrEmailSend('jana@x.sk')).toBe(2); // same address
    expect(await r.incrEmailSend('tomas@x.sk')).toBe(1); // different
  });
});
