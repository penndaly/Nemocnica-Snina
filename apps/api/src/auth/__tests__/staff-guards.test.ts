import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ScopeGuard, StaffRolesGuard, STAFF_ROLES_KEY, type StaffContext } from '../staff-jwt.guard';

function ctxWith(req: Record<string, unknown>, handler?: unknown, klass?: unknown): any {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => klass,
  };
}

const editor = (scopes: string[]): StaffContext => ({
  staffId: 's1', email: 'e@x.sk', role: 'editor', scopes, jti: 'j1',
});

describe('ScopeGuard — item-level access (A2-4 / A2-5)', () => {
  const guard = new ScopeGuard();

  it('allows when the editor has NO scope rows of that type (unrestricted)', () => {
    const req = { staff: editor([]), params: { collection: 'departments', id: 'interne' } };
    expect(guard.canActivate(ctxWith(req))).toBe(true);
  });

  it('allows an in-scope target', () => {
    const req = { staff: editor(['department:chirurgia']), params: { collection: 'departments', id: 'chirurgia' } };
    expect(guard.canActivate(ctxWith(req))).toBe(true);
  });

  it('denies an out-of-scope target with SCOPE_DENIED', () => {
    const req = { staff: editor(['department:chirurgia']), params: { collection: 'departments', id: 'interne' } };
    expect(() => guard.canActivate(ctxWith(req))).toThrow(ForbiddenException);
    try {
      guard.canActivate(ctxWith(req));
    } catch (e) {
      expect((e as ForbiddenException).message).toBe('SCOPE_DENIED');
    }
  });

  it('super_admin and administrator bypass scope checks', () => {
    for (const role of ['super_admin', 'administrator']) {
      const req = {
        staff: { staffId: 's', email: 'e', role, scopes: ['department:chirurgia'], jti: 'j' },
        params: { collection: 'departments', id: 'interne' },
      };
      expect(guard.canActivate(ctxWith(req))).toBe(true);
    }
  });

  it('does not scope non-scopable collections (news) or list routes (no id)', () => {
    expect(guard.canActivate(ctxWith({ staff: editor(['department:chirurgia']), params: { collection: 'news', id: 'x' } }))).toBe(true);
    expect(guard.canActivate(ctxWith({ staff: editor(['department:chirurgia']), params: { collection: 'departments' } }))).toBe(true);
  });

  it('scopes are per-type: a clinic scope does not restrict departments', () => {
    const req = { staff: editor(['clinic:urologicka']), params: { collection: 'departments', id: 'interne' } };
    expect(guard.canActivate(ctxWith(req))).toBe(true); // no department scopes ⇒ unrestricted
  });
});

describe('StaffRolesGuard — role gating (A2-6)', () => {
  const reflector = new Reflector();
  const guard = new StaffRolesGuard(reflector);

  function withRequiredRoles(roles: string[] | undefined, staffRole: string) {
    const handler = () => undefined;
    if (roles) Reflect.defineMetadata(STAFF_ROLES_KEY, roles, handler);
    const req = { staff: { staffId: 's', email: 'e', role: staffRole, scopes: [], jti: 'j' } };
    return guard.canActivate(ctxWith(req, handler, class {}));
  }

  it('allows when no roles are required', () => {
    expect(withRequiredRoles(undefined, 'editor')).toBe(true);
  });

  it('allows super_admin on a super_admin-only route', () => {
    expect(withRequiredRoles(['super_admin'], 'super_admin')).toBe(true);
  });

  it('denies administrator on a super_admin-only route (POST /api/admin/users)', () => {
    expect(() => withRequiredRoles(['super_admin'], 'administrator')).toThrow(ForbiddenException);
  });
});
