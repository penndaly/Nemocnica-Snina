import { HttpException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

// otplib v13 ships ESM (@scure/base) that Jest can't transform — mock it.
//
// v13 is a full rewrite: there is no `authenticator` singleton (that was the
// v11/v12 API) — exports are flat top-level functions, `verify`/`generate`
// are async, and `verify` resolves an object (`{ valid, delta, ... }`), not
// a plain boolean. This mock previously mirrored the OLD API, which matched
// a bug in staff-auth.service.ts's production code (it called
// `otplib.authenticator.verify(...)`, `.generateSecret()`, `.keyuri(...)` —
// all undefined at runtime against the installed v13.4.1) — the mock hid a
// real MFA-verify outage. Fixed alongside the production call sites.
jest.mock('otplib', () => ({
  verify: jest.fn().mockResolvedValue({ valid: true }),
  generateSecret: jest.fn().mockReturnValue('GENERATED'),
  generateURI: jest.fn().mockReturnValue('otpauth://totp/x'),
}));
import * as otplib from 'otplib';
import { StaffAuthService } from '../staff-auth.service';

const CFG: Record<string, unknown> = {
  STAFF_LOGIN_MAX_FAILURES: 10,
  STAFF_MFA_CHALLENGE_TTL_SECONDS: 300,
  STAFF_MFA_SECRET: 'mfa-secret',
  STAFF_JWT_SECRET: 'jwt-secret',
  STAFF_JWT_EXPIRES_IN: '15m',
  STAFF_REFRESH_EXPIRES_IN: '7d',
};

function makeService(over: {
  redis?: Partial<Record<string, jest.Mock>>;
  prisma?: any;
  jwt?: any;
}) {
  const cfg = {
    get: (k: string) => CFG[k],
    getOrThrow: (k: string) => CFG[k],
  } as any;
  const redis = {
    incrLoginFailure: jest.fn().mockResolvedValue(1),
    resetLoginFailures: jest.fn().mockResolvedValue(undefined),
    blacklistJti: jest.fn().mockResolvedValue(undefined),
    isBlacklisted: jest.fn().mockResolvedValue(false),
    ...over.redis,
  };
  const jwt = { sign: jest.fn().mockReturnValue('signed.token'), verify: jest.fn(), ...over.jwt };
  const totpCrypto = { encrypt: jest.fn(), decrypt: jest.fn().mockReturnValue('TOTPSECRET') } as any;
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;
  const prisma = over.prisma ?? {};
  const svc = new StaffAuthService(prisma, cfg, jwt, totpCrypto, redis as any, audit);
  return { svc, redis, jwt, audit, totpCrypto };
}

describe('StaffAuthService.login', () => {
  let hash: string;
  beforeAll(async () => { hash = await bcrypt.hash('right-password', 4); });

  it('locks after the failure threshold (429)', async () => {
    const { svc } = makeService({ redis: { incrLoginFailure: jest.fn().mockResolvedValue(11) } });
    await expect(svc.login('a@x.sk', 'whatever')).rejects.toBeInstanceOf(HttpException);
  });

  it('rejects wrong password with 401 and increments the failure counter', async () => {
    const prisma = { staffAccount: { findUnique: jest.fn().mockResolvedValue({ id: 's1', email: 'a@x.sk', role: 'editor', status: 'active', passwordHash: hash }) } };
    const { svc, redis } = makeService({ prisma });
    await expect(svc.login('a@x.sk', 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(redis.incrLoginFailure).toHaveBeenCalledWith('a@x.sk');
  });

  it('issues an MFA challenge token on correct password and resets failures', async () => {
    const prisma = { staffAccount: { findUnique: jest.fn().mockResolvedValue({ id: 's1', email: 'a@x.sk', role: 'editor', status: 'active', passwordHash: hash }) } };
    const { svc, redis, jwt } = makeService({ prisma });
    const res = await svc.login('a@x.sk', 'right-password');
    expect(res.mfaToken).toBe('signed.token');
    expect(redis.resetLoginFailures).toHaveBeenCalledWith('a@x.sk');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 's1', typ: 'mfa' }),
      expect.objectContaining({ audience: 'ns.staff.mfa' }),
    );
  });

  it('rejects an inactive/unknown account with 401', async () => {
    const prisma = { staffAccount: { findUnique: jest.fn().mockResolvedValue(null) } };
    const { svc } = makeService({ prisma });
    await expect(svc.login('ghost@x.sk', 'x')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('StaffAuthService.verifyMfa', () => {
  it('rejects a wrong TOTP code with 401 and increments failures', async () => {
    const account = { id: 's1', email: 'a@x.sk', role: 'editor', status: 'active', totpEnabled: true, totpSecret: 'enc' };
    const prisma = { staffAccount: { findUnique: jest.fn().mockResolvedValue(account) } };
    const { svc, redis } = makeService({ prisma, jwt: { verify: jest.fn().mockReturnValue({ sub: 's1' }), sign: jest.fn() } });
    (otplib.verify as jest.Mock).mockResolvedValue({ valid: false });
    await expect(svc.verifyMfa('mfa.token', '000000')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(redis.incrLoginFailure).toHaveBeenCalledWith('a@x.sk');
    (otplib.verify as jest.Mock).mockResolvedValue({ valid: true });
  });

  it('rejects an invalid/expired MFA challenge token', async () => {
    const { svc } = makeService({ jwt: { verify: jest.fn(() => { throw new Error('expired'); }), sign: jest.fn() } });
    await expect(svc.verifyMfa('bad', '123456')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
