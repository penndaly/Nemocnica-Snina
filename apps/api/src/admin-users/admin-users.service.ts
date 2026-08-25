/**
 * Super Admin user management (Sprint A2, Part D).
 *
 * All mutations are super_admin-only (enforced by StaffRolesGuard on the
 * controller); read is also allowed to administrator. Every operation writes to
 * the append-only audit_log. Guard rails baked in here (not just the UI):
 *  - cannot change your own role/status, cannot delete your own account
 *  - cannot demote/delete the last active super_admin
 *  - disable/delete/reset-mfa/revoke immediately revoke sessions (Redis blacklist)
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StaffAuthService } from '../auth/staff-auth.service';
import { StaffSecurityRedis } from '../auth/staff-security.redis';
import { StaffEmailService } from '../notifications/staff-email.service';
import type { CreateUserDto, ScopeDto, UpdateUserDto } from './admin-users.dto';

interface Actor { staffId: string; email: string; role: string; }

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly staffAuth: StaffAuthService,
    private readonly redis: StaffSecurityRedis,
    private readonly email: StaffEmailService,
  ) {}

  // ── queries ───────────────────────────────────────────────

  async list(filter: { role?: string; status?: string; search?: string }) {
    const where: Record<string, unknown> = {};
    if (filter.role) where.role = filter.role;
    if (filter.status) where.status = filter.status;
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    const accounts = await this.prisma.staffAccount.findMany({
      where,
      include: { scopes: true },
      orderBy: { createdAt: 'desc' },
    });
    return accounts.map(toPublic);
  }

  async get(id: string) {
    const account = await this.prisma.staffAccount.findUnique({ where: { id }, include: { scopes: true } });
    if (!account) throw new NotFoundException('User not found');
    const recentAudit = await this.prisma.auditLog.findMany({
      where: { resource: 'staff_account', resourceId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { ...toPublic(account), recentAudit };
  }

  // ── create ────────────────────────────────────────────────

  async create(actor: Actor, dto: CreateUserDto, ip?: string) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.staffAccount.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const account = await this.prisma.staffAccount.create({
      data: {
        email,
        name: dto.name,
        role: dto.role,
        status: 'invited',
        createdById: actor.staffId,
        scopes: dto.scopes?.length
          ? { create: dto.scopes.map((s) => ({ scopeType: s.scope_type, scopeTargetId: s.scope_target_id, createdById: actor.staffId })) }
          : undefined,
      },
    });

    const rawToken = await this.staffAuth.createAuthToken(account.id, 'invite');
    await this.email.sendInviteEmail(account.email, account.name, rawToken, account.role);

    await this.log(actor, 'staff_account_created', account.id, { email, role: dto.role }, ip);
    await this.log(actor, 'invite_sent', account.id, { email }, ip);
    return this.get(account.id);
  }

  // ── update ────────────────────────────────────────────────

  async update(actor: Actor, id: string, dto: UpdateUserDto, ip?: string) {
    const account = await this.prisma.staffAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('User not found');

    if (id === actor.staffId && (dto.role !== undefined || dto.status !== undefined)) {
      throw new ForbiddenException('Cannot change your own role or status');
    }
    if (dto.role !== undefined && account.role === 'super_admin' && dto.role !== 'super_admin') {
      await this.assertNotLastSuperAdmin(id);
    }

    const changes: Record<string, unknown> = {};
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) { data.name = dto.name; changes.name = dto.name; }
    if (dto.role !== undefined) { data.role = dto.role; changes.role = dto.role; }
    if (dto.status !== undefined) { data.status = dto.status; changes.status = dto.status; }

    if (Object.keys(data).length) {
      await this.prisma.staffAccount.update({ where: { id }, data });
    }
    if (dto.scopes !== undefined) {
      await this.replaceScopes(actor, id, dto.scopes, ip);
      changes.scopes = dto.scopes;
    }
    if (dto.status === 'disabled') {
      await this.revokeAllSessions(id);
    }

    await this.log(actor, 'staff_account_updated', id, { changes }, ip);
    return this.get(id);
  }

  // ── delete (soft) ─────────────────────────────────────────

  async remove(actor: Actor, id: string, ip?: string) {
    if (id === actor.staffId) throw new ForbiddenException('Cannot delete your own account');
    const account = await this.prisma.staffAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('User not found');
    if (account.role === 'super_admin') await this.assertNotLastSuperAdmin(id);

    await this.prisma.staffAccount.update({
      where: { id },
      data: { status: 'disabled', email: `deleted-${id}@ns.internal` },
    });
    await this.revokeAllSessions(id);
    await this.log(actor, 'staff_account_deleted', id, { originalEmail: account.email }, ip);
    return { ok: true };
  }

  // ── invite / reset / mfa-reset / revoke ───────────────────

  async reinvite(actor: Actor, id: string, ip?: string) {
    const account = await this.requireAccount(id);
    const rawToken = await this.staffAuth.createAuthToken(id, 'invite');
    await this.email.sendInviteEmail(account.email, account.name, rawToken, account.role); // rate-limited (429)
    await this.log(actor, 'invite_sent', id, { email: account.email }, ip);
    return { ok: true };
  }

  async resetPassword(actor: Actor, id: string, ip?: string) {
    const account = await this.requireAccount(id);
    const rawToken = await this.staffAuth.createAuthToken(id, 'reset');
    await this.email.sendPasswordResetEmail(account.email, account.name, rawToken); // rate-limited
    await this.log(actor, 'password_reset_issued', id, { email: account.email }, ip);
    return { ok: true };
  }

  async resetMfa(actor: Actor, id: string, ip?: string) {
    const account = await this.requireAccount(id);
    await this.prisma.staffAccount.update({
      where: { id },
      data: { totpSecret: null, totpEnabled: false, recoveryCodes: [] },
    });
    const rawToken = await this.staffAuth.createAuthToken(id, 'mfa_reset');
    await this.email.sendMfaResetEmail(account.email, account.name, rawToken); // rate-limited
    await this.revokeAllSessions(id); // force re-login + fresh MFA setup
    await this.log(actor, 'mfa_reset_issued', id, { email: account.email }, ip);
    return { ok: true };
  }

  async revokeSessions(actor: Actor, id: string, ip?: string) {
    const account = await this.requireAccount(id);
    await this.revokeAllSessions(id);
    await this.email.sendSessionRevokedEmail(account.email, account.name);
    await this.log(actor, 'sessions_revoked', id, { email: account.email }, ip);
    return { ok: true };
  }

  // ── scopes ────────────────────────────────────────────────

  async setScopes(actor: Actor, id: string, scopes: ScopeDto[], ip?: string) {
    await this.requireAccount(id);
    await this.replaceScopes(actor, id, scopes, ip);
    return this.get(id);
  }

  private async replaceScopes(actor: Actor, id: string, scopes: ScopeDto[], ip?: string) {
    const previous = await this.prisma.staffAccessScope.findMany({ where: { staffId: id } });
    await this.prisma.$transaction([
      this.prisma.staffAccessScope.deleteMany({ where: { staffId: id } }),
      ...(scopes.length
        ? [this.prisma.staffAccessScope.createMany({
            data: scopes.map((s) => ({ staffId: id, scopeType: s.scope_type, scopeTargetId: s.scope_target_id, createdById: actor.staffId })),
            skipDuplicates: true,
          })]
        : []),
    ]);
    await this.log(actor, 'scopes_updated', id, {
      previous: previous.map((p) => ({ scope_type: p.scopeType, scope_target_id: p.scopeTargetId })),
      updated: scopes,
    }, ip);
  }

  // ── internals ─────────────────────────────────────────────

  private async requireAccount(id: string) {
    const account = await this.prisma.staffAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('User not found');
    return account;
  }

  private async assertNotLastSuperAdmin(id: string) {
    const count = await this.prisma.staffAccount.count({ where: { role: 'super_admin', status: 'active' } });
    const target = await this.prisma.staffAccount.findUnique({ where: { id } });
    if (target?.role === 'super_admin' && target.status === 'active' && count <= 1) {
      throw new ConflictException('Cannot remove the last active super_admin');
    }
  }

  /** Revoke all sessions for an account and blacklist their jtis. */
  private async revokeAllSessions(staffId: string) {
    const now = new Date();
    const active = await this.prisma.staffSession.findMany({
      where: { staffId, revokedAt: null, expiresAt: { gt: now } },
    });
    await this.prisma.staffSession.updateMany({
      where: { staffId, revokedAt: null },
      data: { revokedAt: now },
    });
    await Promise.all(
      active.map((s) => {
        const ttl = Math.max(1, Math.floor((s.expiresAt.getTime() - Date.now()) / 1000));
        return this.redis.blacklistJti(s.jti, ttl);
      }),
    );
  }

  private async log(actor: Actor, action: string, targetId: string, detail: Record<string, unknown>, ip?: string) {
    if (!action) throw new BadRequestException('audit action required');
    // AuditLog.actorId has a hard FK to the legacy StaffUser table, not
    // StaffAccount (this service's actor type) — passing a StaffAccount id
    // there throws a foreign-key violation on every write. See
    // staff-auth.service.ts's logEvent() for the original fix of this same
    // issue; kept out of the FK-constrained column and preserved in detail.
    await this.audit.log({
      actorEmail: actor.email,
      actorRole: actor.role,
      action,
      resource: 'staff_account',
      resourceId: targetId,
      detail: { ...detail, staffAccountId: actor.staffId },
      ip,
    });
  }
}

interface AccountWithScopes {
  id: string; email: string; name: string; role: string; status: string;
  totpEnabled: boolean; lastLoginAt: Date | null; createdAt: Date;
  scopes?: { scopeType: string; scopeTargetId: string }[];
}

/** Strip secrets (password hash, totp secret, recovery codes) before returning. */
function toPublic(a: AccountWithScopes) {
  const mfaStatus = a.status === 'invited' ? 'pending' : a.totpEnabled ? 'active' : 'reset';
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    status: a.status,
    mfaStatus,
    lastLoginAt: a.lastLoginAt,
    createdAt: a.createdAt,
    scopes: (a.scopes ?? []).map((s) => ({ scope_type: s.scopeType, scope_target_id: s.scopeTargetId })),
  };
}
