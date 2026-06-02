import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as totp from 'otplib';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, totpCode: string, ip: string) {
    const user = await this.prisma.staffUser.findUnique({ where: { email } });
    if (!user || !user.active) throw new UnauthorizedException('Invalid credentials');

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      await this.audit.log({
        actorEmail: email,
        actorRole: 'unknown',
        action: 'login_failed',
        resource: 'staff_user',
        resourceId: user.id,
        ip,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // MFA mandatory (Decree 179/2020)
    if (user.mfaEnabled) {
      if (!user.mfaSecret) throw new UnauthorizedException('MFA not configured');
      const valid = totp.authenticator.verify({ token: totpCode, secret: user.mfaSecret });
      if (!valid) throw new UnauthorizedException('Invalid MFA code');
    }

    await this.prisma.staffUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({
      actorId: user.id,
      actorEmail: email,
      actorRole: user.role,
      action: 'login',
      resource: 'staff_user',
      resourceId: user.id,
      ip,
    });

    const token = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
    return { accessToken: token, role: user.role };
  }
}
