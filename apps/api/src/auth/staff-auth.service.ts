/**
 * Staff authentication — password → MFA challenge → TOTP → staff JWT, plus the
 * invite/reset/MFA-setup flows.
 *
 * Security invariants (Sprint A2 non-negotiables):
 *  - Staff JWT uses its own key (STAFF_JWT_SECRET) and aud='ns.staff'. The MFA
 *    challenge token uses STAFF_MFA_SECRET and aud='ns.staff.mfa'. Neither is the
 *    patient key, and neither is accepted on patient endpoints.
 *  - TOTP secrets are AES-256-GCM encrypted at rest (StaffTotpCryptoService).
 *  - Invite/reset tokens are random 32-byte values, SHA-256 hashed at rest,
 *    single-use, with 72h / 30min expiry.
 *  - Login failures and revoked sessions are tracked in Redis (blacklist + lock).
 *  - Every event writes to the append-only audit_log (reused AuditService).
 */
import {
  Injectable,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as otplib from 'otplib';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StaffTotpCryptoService } from './staff-totp-crypto.service';
import { StaffSecurityRedis } from './staff-security.redis';
import { STAFF_AUD, STAFF_MFA_AUD } from './staff-auth.constants';

export { STAFF_AUD, STAFF_MFA_AUD } from './staff-auth.constants';
const TOTP_ISSUER = 'Nemocnica Snina';

export interface StaffJwtPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
  aud: string;
  typ?: 'access' | 'refresh';
}

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
    private readonly jwt: JwtService,
    private readonly totpCrypto: StaffTotpCryptoService,
    private readonly redis: StaffSecurityRedis,
    private readonly audit: AuditService,
  ) {}

  // ── config getters ────────────────────────────────────────
  private get jwtSecret() { return this.cfg.getOrThrow<string>('STAFF_JWT_SECRET'); }
  private get mfaSecret() { return this.cfg.getOrThrow<string>('STAFF_MFA_SECRET'); }
  private get accessTtl() { return this.cfg.get<string>('STAFF_JWT_EXPIRES_IN') ?? '15m'; }
  private get refreshTtl() { return this.cfg.get<string>('STAFF_REFRESH_EXPIRES_IN') ?? '7d'; }
  private get challengeTtl() { return Number(this.cfg.get('STAFF_MFA_CHALLENGE_TTL_SECONDS') ?? 300); }
  private get maxLoginFailures() { return Number(this.cfg.get('STAFF_LOGIN_MAX_FAILURES') ?? 10); }
  private get inviteExpiryH() { return Number(this.cfg.get('STAFF_INVITE_EXPIRES_H') ?? 72); }
  private get resetExpiryM() { return Number(this.cfg.get('STAFF_RESET_EXPIRES_M') ?? 30); }

  private async logEvent(
    action: string,
    account: { id: string; email: string; role: string } | null,
    email: string,
    detail?: Record<string, unknown>,
    ip?: string,
  ): Promise<void> {
    await this.audit.log({
      actorId: account?.id,
      actorEmail: account?.email ?? email,
      actorRole: account?.role ?? 'unknown',
      action,
      resource: 'staff_account',
      resourceId: account?.id ?? email,
      detail,
      ip,
    });
  }

  // ── 1. Login (password) ───────────────────────────────────

  async login(email: string, password: string, ip?: string): Promise<{ mfaToken: string }> {
    const normEmail = email.toLowerCase().trim();

    // Lock check first — independent of whether the account exists.
    const failures = await this.redis.incrLoginFailure(normEmail);
    if (failures > this.maxLoginFailures) {
      await this.logEvent('staff_login_attempt', null, normEmail, { success: false, reason: 'locked' }, ip);
      throw new HttpException('Too many failed attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const account = await this.prisma.staffAccount.findUnique({ where: { email: normEmail } });
    const passwordOk =
      account?.status === 'active' &&
      !!account.passwordHash &&
      (await bcrypt.compare(password, account.passwordHash));

    if (!account || !passwordOk) {
      await this.logEvent('staff_login_attempt', account ? acc(account) : null, normEmail, { success: false, reason: 'invalid_credentials' }, ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Password ok → reset the failure counter and issue the MFA challenge.
    await this.redis.resetLoginFailures(normEmail);
    await this.logEvent('staff_login_attempt', acc(account), normEmail, { success: true }, ip);

    const mfaToken = this.jwt.sign(
      { sub: account.id, typ: 'mfa' },
      { secret: this.mfaSecret, audience: STAFF_MFA_AUD, expiresIn: this.challengeTtl },
    );
    return { mfaToken };
  }

  // ── 2. Login (TOTP) ───────────────────────────────────────

  async verifyMfa(
    mfaToken: string,
    totpCode: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let staffId: string;
    try {
      const payload = this.jwt.verify<{ sub: string }>(mfaToken, { secret: this.mfaSecret, audience: STAFF_MFA_AUD });
      staffId = payload.sub;
    } catch {
      throw new UnauthorizedException('MFA challenge invalid or expired');
    }

    const account = await this.prisma.staffAccount.findUnique({ where: { id: staffId } });
    if (!account || account.status !== 'active' || !account.totpEnabled || !account.totpSecret) {
      throw new UnauthorizedException('MFA not available for this account');
    }

    // Enforce the same lockout as login() — this endpoint was previously
    // brute-forceable because the failure count was only checked in login().
    // Increment-and-check up front so a bad code below does not double-count.
    const failures = await this.redis.incrLoginFailure(account.email);
    if (failures > this.maxLoginFailures) {
      await this.logEvent('staff_mfa_locked', acc(account), account.email, undefined, ip);
      throw new UnauthorizedException('Account temporarily locked due to repeated failures');
    }

    const secret = this.totpCrypto.decrypt(account.totpSecret);
    const valid = (otplib as any).authenticator.verify({ token: totpCode, secret }) as boolean;
    if (!valid) {
      await this.logEvent('staff_mfa_failure', acc(account), account.email, undefined, ip);
      throw new UnauthorizedException('Invalid MFA code');
    }

    // Single-use: reject replay of a still-valid code within its time step.
    const totpCounter = Math.floor(Date.now() / 1000 / 30);
    if (account.lastTotpCounter !== null && totpCounter <= Number(account.lastTotpCounter)) {
      await this.logEvent('staff_mfa_replay', acc(account), account.email, undefined, ip);
      throw new UnauthorizedException('MFA code already used');
    }

    await this.redis.resetLoginFailures(account.email);
    const scopes = await this.loadScopeStrings(account.id);
    const tokens = await this.issueSession(acc(account), scopes, ip, userAgent);
    await this.prisma.staffAccount.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip ?? null, lastTotpCounter: BigInt(totpCounter) },
    });
    await this.logEvent('staff_login_success', acc(account), account.email, undefined, ip);
    return tokens;
  }

  /** Scope rows as compact "type:targetId" strings, embedded in the access token. */
  async loadScopeStrings(staffId: string): Promise<string[]> {
    const rows = await this.prisma.staffAccessScope.findMany({ where: { staffId } });
    return rows.map((r) => `${r.scopeType}:${r.scopeTargetId}`);
  }

  private async issueSession(
    account: { id: string; email: string; role: string },
    scopes: string[],
    ip?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const jti = randomUUID();
    const issuedAt = new Date();
    const refreshMs = parseDuration(this.refreshTtl);
    const expiresAt = new Date(issuedAt.getTime() + refreshMs);

    const accessToken = this.jwt.sign(
      { sub: account.id, email: account.email, role: account.role, scopes, jti, typ: 'access' },
      { secret: this.jwtSecret, audience: STAFF_AUD, expiresIn: this.accessTtl },
    );
    const refreshToken = this.jwt.sign(
      { sub: account.id, jti, typ: 'refresh' },
      { secret: this.jwtSecret, audience: STAFF_AUD, expiresIn: this.refreshTtl },
    );

    await this.prisma.staffSession.create({
      data: { jti, staffId: account.id, issuedAt, expiresAt, userAgent: userAgent ?? null, ipAddress: ip ?? null },
    });
    return { accessToken, refreshToken };
  }

  // ── 3. Token refresh ──────────────────────────────────────

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: { sub: string; jti: string; typ?: string };
    try {
      payload = this.jwt.verify(refreshToken, { secret: this.jwtSecret, audience: STAFF_AUD });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('Not a refresh token');

    const session = await this.prisma.staffSession.findUnique({ where: { jti: payload.jti } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session revoked or expired');
    }
    if (await this.redis.isBlacklisted(payload.jti)) throw new UnauthorizedException('Session revoked');

    const account = await this.prisma.staffAccount.findUnique({ where: { id: payload.sub } });
    if (!account || account.status !== 'active') throw new UnauthorizedException('Account inactive');

    // Reload scopes so scope changes take effect on refresh (≤ access TTL delay).
    const scopes = await this.loadScopeStrings(account.id);
    const accessToken = this.jwt.sign(
      { sub: account.id, email: account.email, role: account.role, scopes, jti: payload.jti, typ: 'access' },
      { secret: this.jwtSecret, audience: STAFF_AUD, expiresIn: this.accessTtl },
    );
    return { accessToken };
  }

  // ── 4. Logout ─────────────────────────────────────────────

  async logout(jti: string, ip?: string): Promise<void> {
    const session = await this.prisma.staffSession.findUnique({ where: { jti } });
    if (!session) return;
    await this.prisma.staffSession.update({ where: { jti }, data: { revokedAt: new Date() } });
    const ttlSec = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
    await this.redis.blacklistJti(jti, ttlSec);
    const account = await this.prisma.staffAccount.findUnique({ where: { id: session.staffId } });
    await this.logEvent('staff_logout', account ? acc(account) : null, account?.email ?? '', undefined, ip);
  }

  // ── MFA setup (authenticated, by staffId) ─────────────────

  async setupMfa(staffId: string): Promise<{ otpauthUrl: string; secret: string }> {
    const account = await this.prisma.staffAccount.findUnique({ where: { id: staffId } });
    if (!account) throw new NotFoundException('Account not found');
    const secret = (otplib as any).authenticator.generateSecret() as string;
    await this.prisma.staffAccount.update({
      where: { id: staffId },
      data: { totpSecret: this.totpCrypto.encrypt(secret), totpEnabled: false },
    });
    const otpauthUrl = (otplib as any).authenticator.keyuri(account.email, TOTP_ISSUER, secret) as string;
    return { otpauthUrl, secret };
  }

  async confirmMfa(staffId: string, totpCode: string): Promise<{ recoveryCodes: string[] }> {
    const account = await this.prisma.staffAccount.findUnique({ where: { id: staffId } });
    if (!account?.totpSecret) throw new BadRequestException('MFA setup not started');
    const secret = this.totpCrypto.decrypt(account.totpSecret);
    const valid = (otplib as any).authenticator.verify({ token: totpCode, secret }) as boolean;
    if (!valid) throw new BadRequestException('Invalid MFA code');

    const plainCodes = Array.from({ length: 10 }, () => formatRecoveryCode(randomBytes(10)));
    const hashed = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));
    await this.prisma.staffAccount.update({
      where: { id: staffId },
      data: { totpEnabled: true, recoveryCodes: hashed },
    });
    await this.logEvent('mfa_setup_complete', acc(account), account.email);
    return { recoveryCodes: plainCodes };
  }

  /** Step-up MFA re-verify for a sensitive action (e.g. GDPR erasure). */
  async verifyTotpForStaff(staffId: string, totpCode: string): Promise<boolean> {
    const account = await this.prisma.staffAccount.findUnique({ where: { id: staffId } });
    if (!account?.totpEnabled || !account.totpSecret) return false;
    const secret = this.totpCrypto.decrypt(account.totpSecret);
    return (otplib as any).authenticator.verify({ token: totpCode, secret }) as boolean;
  }

  // ── Token helpers (invite / reset / mfa_reset) ────────────

  /** Create a single-use token; returns the RAW token (only the hash is stored). */
  async createAuthToken(staffId: string, type: 'invite' | 'reset' | 'mfa_reset'): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    const ms =
      type === 'invite'
        ? this.inviteExpiryH * 3600_000
        : this.resetExpiryM * 60_000;
    await this.prisma.staffAuthToken.create({
      data: { staffId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ms) },
    });
    return raw;
  }

  private async consumeToken(raw: string, type: 'invite' | 'reset' | 'mfa_reset', markUsed: boolean) {
    const rec = await this.prisma.staffAuthToken.findFirst({
      where: { type, tokenHash: sha256(raw), usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!rec) throw new BadRequestException('Invalid or expired token');
    if (markUsed) await this.prisma.staffAuthToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
    return rec;
  }

  // ── Accept invite & password setup (public) ───────────────

  async acceptInvite(token: string, password: string, ip?: string): Promise<{ mfaSetupRequired: true; setupToken: string }> {
    const rec = await this.consumeToken(token, 'invite', true);
    const passwordHash = await bcrypt.hash(password, 12);
    const account = await this.prisma.staffAccount.update({
      where: { id: rec.staffId },
      data: { passwordHash, status: 'active' },
    });
    await this.logEvent('invite_accepted', acc(account), account.email, undefined, ip);
    // Issue a short-lived mfa_reset token so the user can complete MFA setup
    // unauthenticated (the next step in the onboarding flow).
    const setupToken = await this.createAuthToken(account.id, 'mfa_reset');
    return { mfaSetupRequired: true, setupToken };
  }

  /** Generate + store a TOTP secret for the account behind a setup token (not consumed). */
  async beginMfaSetupWithToken(setupToken: string): Promise<{ otpauthUrl: string; secret: string }> {
    const rec = await this.consumeToken(setupToken, 'mfa_reset', false);
    return this.setupMfa(rec.staffId);
  }

  /** Verify the TOTP code, enable MFA, consume the setup token, return recovery codes. */
  async completeMfaSetupWithToken(setupToken: string, totpCode: string): Promise<{ recoveryCodes: string[] }> {
    const rec = await this.consumeToken(setupToken, 'mfa_reset', false);
    const result = await this.confirmMfa(rec.staffId, totpCode);
    await this.prisma.staffAuthToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
    return result;
  }

  async resetPassword(token: string, password: string, ip?: string): Promise<void> {
    const rec = await this.consumeToken(token, 'reset', true);
    const passwordHash = await bcrypt.hash(password, 12);
    const account = await this.prisma.staffAccount.update({ where: { id: rec.staffId }, data: { passwordHash } });
    await this.logEvent('password_reset_complete', acc(account), account.email, undefined, ip);
  }
}

// ── helpers ─────────────────────────────────────────────────

function acc(a: { id: string; email: string; role: string }) {
  return { id: a.id, email: a.email, role: a.role };
}

/** Format 10 random bytes as a grouped, human-copyable recovery code. */
function formatRecoveryCode(buf: Buffer): string {
  const hex = buf.toString('hex').toUpperCase(); // 20 chars
  return `${hex.slice(0, 5)}-${hex.slice(5, 10)}-${hex.slice(10, 15)}-${hex.slice(15, 20)}`;
}

/** Parse a JWT-style duration ("15m","7d","3600") into milliseconds. */
function parseDuration(d: string): number {
  const m = /^(\d+)([smhd])?$/.exec(d.trim());
  if (!m) return 7 * 24 * 3600_000;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60_000;
    case 'h': return n * 3600_000;
    case 'd': return n * 24 * 3600_000;
    default: return n * 1000;
  }
}
