import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { AuditModule } from '../audit/audit.module';
// Sprint A2 — staff auth, MFA, RBAC
import { StaffAuthService } from './staff-auth.service';
import { StaffAuthController } from './staff-auth.controller';
import { StaffTotpCryptoService } from './staff-totp-crypto.service';
import { StaffSecurityRedis } from './staff-security.redis';
import { StaffJwtGuard, ScopeGuard, StaffRolesGuard } from './staff-jwt.guard';
import { StaffEmailService } from '../notifications/staff-email.service';

@Module({
  imports: [
    PassportModule,
    AuditModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, StaffAuthController],
  providers: [
    AuthService,
    JwtStrategy,
    StaffAuthService,
    StaffTotpCryptoService,
    StaffSecurityRedis,
    StaffEmailService,
    StaffJwtGuard,
    ScopeGuard,
    StaffRolesGuard,
  ],
  exports: [
    AuthService,
    JwtModule,
    StaffAuthService,
    StaffSecurityRedis,
    StaffEmailService,
    StaffTotpCryptoService,
    StaffJwtGuard,
    ScopeGuard,
    StaffRolesGuard,
  ],
})
export class AuthModule {}
