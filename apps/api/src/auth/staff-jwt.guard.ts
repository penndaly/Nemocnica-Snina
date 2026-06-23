/**
 * Staff auth + RBAC guards (Sprint A2).
 *
 *  StaffJwtGuard — validates the staff access token on protected routes:
 *    1. Bearer present, signature valid (STAFF_JWT_SECRET, aud='ns.staff'), typ='access'
 *    2. jti not in the Redis revocation blacklist
 *    3. staff_accounts.status = 'active'
 *    Attaches req.staff = { staffId, role, scopes } for downstream guards.
 *
 *    Dev/CI only: when CMS_AUTH_BYPASS=true a synthetic super_admin context is
 *    attached (the config validator rejects the flag in production).
 *
 *  ScopeGuard — item-level access. super_admin/administrator bypass. Otherwise,
 *    if the staff has scope rows of the route's type, the target slug must be in
 *    the list; no rows of that type ⇒ unrestricted.
 *
 *  StaffRolesGuard (+ @StaffRoles) — coarse role gating (e.g. super_admin only).
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { STAFF_AUD } from './staff-auth.constants';
import { StaffSecurityRedis } from './staff-security.redis';
import { PrismaService } from '../prisma/prisma.service';

export interface StaffContext {
  staffId: string;
  email: string;
  role: string;
  scopes: string[]; // "type:targetId"
  jti: string;
}

interface RequestWithStaff {
  headers: Record<string, string | string[] | undefined>;
  staff?: StaffContext;
  params?: Record<string, string>;
  routeConfig?: { path?: string };
  url?: string;
}

function bearer(req: RequestWithStaff): string | null {
  const h = req.headers['authorization'];
  const v = Array.isArray(h) ? h[0] : h;
  if (!v || !v.startsWith('Bearer ')) return null;
  return v.slice(7);
}

@Injectable()
export class StaffJwtGuard implements CanActivate {
  constructor(
    private readonly cfg: ConfigService,
    private readonly jwt: JwtService,
    private readonly redis: StaffSecurityRedis,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithStaff>();

    // Dev/CI bypass (prod-rejected by config validator) — synthetic super_admin.
    const bypass = String(this.cfg.get('CMS_AUTH_BYPASS') ?? '').toLowerCase() === 'true';
    if (bypass) {
      req.staff = { staffId: 'dev-bypass', email: 'dev-bypass@ns.internal', role: 'super_admin', scopes: [], jti: 'dev-bypass' };
      return true;
    }

    const token = bearer(req);
    if (!token) throw new UnauthorizedException('Missing staff bearer token');

    let payload: { sub: string; email: string; role: string; scopes?: string[]; jti: string; typ?: string };
    try {
      payload = this.jwt.verify(token, {
        secret: this.cfg.getOrThrow<string>('STAFF_JWT_SECRET'),
        audience: STAFF_AUD,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired staff token');
    }
    if (payload.typ !== 'access') throw new UnauthorizedException('Not an access token');

    if (await this.redis.isBlacklisted(payload.jti)) {
      throw new UnauthorizedException('Session revoked');
    }

    const account = await this.prisma.staffAccount.findUnique({ where: { id: payload.sub } });
    if (!account || account.status !== 'active') throw new UnauthorizedException('Account inactive');

    req.staff = { staffId: payload.sub, email: payload.email, role: payload.role, scopes: payload.scopes ?? [], jti: payload.jti };
    return true;
  }
}

// Map a CMS collection path segment → scope type.
const COLLECTION_SCOPE_TYPE: Record<string, string> = {
  departments: 'department',
  clinics: 'clinic',
  physicians: 'physician',
  facilities: 'facility',
};

@Injectable()
export class ScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithStaff>();
    const staff = req.staff;
    if (!staff) throw new UnauthorizedException('Not authenticated');

    // super_admin / administrator have unrestricted access.
    if (staff.role === 'super_admin' || staff.role === 'administrator') return true;

    const params = req.params ?? {};
    const collection = params['collection'];
    const targetId = params['id'] ?? params['slug'];
    // No collection/target in the route (e.g. list, slug helper) → nothing to scope.
    if (!collection || !targetId) return true;

    const scopeType = COLLECTION_SCOPE_TYPE[collection];
    if (!scopeType) return true; // non-scopable collection (news, disclosures, services)

    const ofType = staff.scopes.filter((s) => s.startsWith(`${scopeType}:`));
    if (ofType.length === 0) return true; // unrestricted for this type

    const allowed = ofType.some((s) => s === `${scopeType}:${targetId}`);
    if (!allowed) throw new ForbiddenException('SCOPE_DENIED');
    return true;
  }
}

export const STAFF_ROLES_KEY = 'staff_roles';
export const StaffRoles = (...roles: string[]) => SetMetadata(STAFF_ROLES_KEY, roles);

@Injectable()
export class StaffRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(STAFF_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest<RequestWithStaff>();
    const role = req.staff?.role;
    if (!role || !required.includes(role)) throw new ForbiddenException('INSUFFICIENT_ROLE');
    return true;
  }
}
