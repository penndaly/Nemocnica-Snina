/**
 * Staff authentication endpoints — /api/auth/staff/**.
 *
 * Two-step login (password → MFA), token refresh, logout, plus the public
 * invite-acceptance / MFA-setup / password-reset flows. The refresh token is
 * set as an HttpOnly cookie when the cookie plugin is available (production),
 * and also returned in the body as a dev fallback.
 *
 * These routes are NOT patient routes: the staff JWT (aud=ns.staff) issued here
 * is never accepted by patient endpoints (which verify x-patient-session JWTs).
 */
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { StaffAuthService } from './staff-auth.service';
import { StaffJwtGuard, type StaffContext } from './staff-jwt.guard';

const REFRESH_COOKIE = 'ns_staff_refresh';

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) password!: string;
}
class VerifyMfaDto {
  @IsString() mfaToken!: string;
  @IsString() totpCode!: string;
}
class AcceptInviteDto {
  @IsString() token!: string;
  @IsString() @MinLength(10) password!: string;
}
class BeginSetupDto {
  @IsString() setupToken!: string;
}
class SetupMfaDto {
  @IsString() setupToken!: string;
  @IsString() totpCode!: string;
}
class ResetPasswordDto {
  @IsString() token!: string;
  @IsString() @MinLength(10) password!: string;
}

interface FastifyReplyLike { setCookie?: (name: string, value: string, opts: Record<string, unknown>) => void; clearCookie?: (name: string, opts?: Record<string, unknown>) => void; }
interface FastifyReqLike {
  cookies?: Record<string, string>;
  staff?: StaffContext;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  body?: { refreshToken?: string };
}

function ipOf(req: FastifyReqLike): string | undefined {
  const fwd = req.headers?.['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : fwd) ?? req.ip;
}

@Controller('api/auth/staff')
export class StaffAuthController {
  constructor(private readonly staffAuth: StaffAuthService) {}

  // Step 1 — password → MFA challenge
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: FastifyReqLike) {
    return this.staffAuth.login(dto.email, dto.password, ipOf(req));
  }

  // Step 2 — TOTP → access token (+ refresh cookie)
  @Post('verify-mfa')
  @HttpCode(200)
  async verifyMfa(
    @Body() dto: VerifyMfaDto,
    @Req() req: FastifyReqLike,
    @Res({ passthrough: true }) reply: FastifyReplyLike,
  ) {
    const ua = req.headers?.['user-agent'];
    const { accessToken, refreshToken } = await this.staffAuth.verifyMfa(
      dto.mfaToken,
      dto.totpCode,
      ipOf(req),
      Array.isArray(ua) ? ua[0] : ua,
    );
    this.setRefreshCookie(reply, refreshToken);
    // refreshToken in body is a dev fallback when no cookie plugin is present.
    return { accessToken, refreshToken };
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() req: FastifyReqLike) {
    const token = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    if (!token) throw new UnauthorizedException('Missing refresh token');
    return this.staffAuth.refresh(token);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(StaffJwtGuard)
  async logout(@Req() req: FastifyReqLike, @Res({ passthrough: true }) reply: FastifyReplyLike) {
    if (req.staff?.jti) await this.staffAuth.logout(req.staff.jti, ipOf(req));
    reply.clearCookie?.(REFRESH_COOKIE, { path: '/api/auth/staff' });
  }

  // ── Public onboarding / recovery flows ────────────────────

  @Post('accept-invite')
  @HttpCode(200)
  acceptInvite(@Body() dto: AcceptInviteDto, @Req() req: FastifyReqLike) {
    return this.staffAuth.acceptInvite(dto.token, dto.password, ipOf(req));
  }

  // Generate + return the TOTP secret/QR for the setup token (not consumed yet).
  @Post('setup-mfa/begin')
  @HttpCode(200)
  beginSetup(@Body() dto: BeginSetupDto) {
    return this.staffAuth.beginMfaSetupWithToken(dto.setupToken);
  }

  // Verify the code, enable MFA, consume the token, return recovery codes (once).
  @Post('setup-mfa')
  @HttpCode(200)
  setupMfa(@Body() dto: SetupMfaDto) {
    return this.staffAuth.completeMfaSetupWithToken(dto.setupToken, dto.totpCode);
  }

  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: FastifyReqLike) {
    await this.staffAuth.resetPassword(dto.token, dto.password, ipOf(req));
  }

  private setRefreshCookie(reply: FastifyReplyLike, refreshToken: string) {
    reply.setCookie?.(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/api/auth/staff',
      maxAge: 7 * 24 * 3600,
    });
  }
}
