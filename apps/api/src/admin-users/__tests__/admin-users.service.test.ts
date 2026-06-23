import { ConflictException, ForbiddenException } from '@nestjs/common';

// AdminUsersService transitively imports StaffAuthService → otplib (ESM). Mock it.
jest.mock('otplib', () => ({ authenticator: { verify: jest.fn(), generateSecret: jest.fn(), keyuri: jest.fn() } }));
import { AdminUsersService } from '../admin-users.service';

const SUPER = { staffId: 'super-1', email: 'boss@x.sk', role: 'super_admin' };

function make(prisma: any, over: { email?: any; staffAuth?: any; redis?: any } = {}) {
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;
  const staffAuth = { createAuthToken: jest.fn().mockResolvedValue('raw-token'), ...over.staffAuth } as any;
  const redis = { blacklistJti: jest.fn().mockResolvedValue(undefined), ...over.redis } as any;
  const email = {
    sendInviteEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendMfaResetEmail: jest.fn().mockResolvedValue(undefined),
    sendSessionRevokedEmail: jest.fn().mockResolvedValue(undefined),
    ...over.email,
  } as any;
  return { svc: new AdminUsersService(prisma, audit, staffAuth, redis, email), audit, staffAuth, redis, email };
}

describe('AdminUsersService guard rails', () => {
  it('refuses to delete your own account (403)', async () => {
    const prisma = { staffAccount: { findUnique: jest.fn() } } as any;
    const { svc } = make(prisma);
    await expect(svc.remove(SUPER, SUPER.staffId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to delete the last active super_admin (409)', async () => {
    const target = { id: 'sa-2', email: 's2@x.sk', role: 'super_admin', status: 'active' };
    const prisma = {
      staffAccount: {
        findUnique: jest.fn().mockResolvedValue(target),
        count: jest.fn().mockResolvedValue(1), // only one active super_admin
        update: jest.fn(),
      },
    } as any;
    const { svc } = make(prisma);
    await expect(svc.remove(SUPER, 'sa-2')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.staffAccount.update).not.toHaveBeenCalled();
  });

  it('refuses to demote the last active super_admin (409)', async () => {
    const target = { id: 'sa-2', email: 's2@x.sk', role: 'super_admin', status: 'active' };
    const prisma = {
      staffAccount: {
        findUnique: jest.fn().mockResolvedValue(target),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn(),
      },
    } as any;
    const { svc } = make(prisma);
    await expect(svc.update(SUPER, 'sa-2', { role: 'editor' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to change your own role/status (403)', async () => {
    const prisma = { staffAccount: { findUnique: jest.fn().mockResolvedValue({ id: SUPER.staffId, role: 'super_admin', status: 'active' }) } } as any;
    const { svc } = make(prisma);
    await expect(svc.update(SUPER, SUPER.staffId, { status: 'disabled' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AdminUsersService.create', () => {
  it('creates an invited account and sends the invite email with the raw token', async () => {
    const created = { id: 'new-1', email: 'jana@x.sk', name: 'Jana', role: 'editor', status: 'invited' };
    const prisma = {
      staffAccount: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null) // email uniqueness check
          .mockResolvedValue({ ...created, totpEnabled: false, lastLoginAt: null, createdAt: new Date(), scopes: [] }), // get()
        create: jest.fn().mockResolvedValue(created),
      },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const { svc, email, staffAuth } = make(prisma);

    const result = await svc.create(SUPER, { name: 'Jana', email: 'Jana@x.sk', role: 'editor' });

    expect(staffAuth.createAuthToken).toHaveBeenCalledWith('new-1', 'invite');
    expect(email.sendInviteEmail).toHaveBeenCalledWith('jana@x.sk', 'Jana', 'raw-token', 'editor');
    expect(result.status).toBe('invited');
    expect((result as any).email).toBe('jana@x.sk');
  });
});

describe('AdminUsersService.setScopes', () => {
  it('replaces scopes atomically in a single transaction', async () => {
    const account = { id: 'u1', email: 'u@x.sk', name: 'U', role: 'editor', status: 'active', totpEnabled: true, lastLoginAt: null, createdAt: new Date(), scopes: [] };
    const prisma = {
      staffAccount: { findUnique: jest.fn().mockResolvedValue(account) },
      staffAccessScope: {
        findMany: jest.fn().mockResolvedValue([{ scopeType: 'department', scopeTargetId: 'old' }]),
        deleteMany: jest.fn().mockReturnValue({ op: 'deleteMany' }),
        createMany: jest.fn().mockReturnValue({ op: 'createMany' }),
      },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockResolvedValue([]),
    } as any;
    const { svc, audit } = make(prisma);

    await svc.setScopes(SUPER, 'u1', [{ scope_type: 'department', scope_target_id: 'chirurgia' }]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const ops = prisma.$transaction.mock.calls[0][0];
    expect(ops).toHaveLength(2); // deleteMany + createMany
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'scopes_updated' }));
  });
});
