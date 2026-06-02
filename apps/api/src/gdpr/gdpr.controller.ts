/**
 * GDPR DSAR endpoints — admin-role-only, MFA-gated (enforced by JWT guard + role check).
 * Every access is written to the immutable audit_log.
 */
import { Body, Controller, HttpCode, Ip, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GdprService } from './gdpr.service';

function assertAdmin(req: { user: { role: string } }) {
  if (req.user.role !== 'ADMIN') {
    throw Object.assign(new Error('Admin role required'), { status: 403 });
  }
}

@Controller('api/gdpr')
@UseGuards(AuthGuard('jwt'))
export class GdprController {
  constructor(private readonly gdpr: GdprService) {}

  /** Art. 15 — export all web-tier data for a subject */
  @Post('export')
  @HttpCode(200)
  async export(
    @Body() body: { patientRc: string },
    @Request() req: { user: { email: string; role: string } },
    @Ip() ip: string,
  ) {
    assertAdmin(req);
    return this.gdpr.exportSubjectData(body.patientRc, req.user.email, req.user.role, ip);
  }

  /** Art. 17 — anonymize all web-tier PII for a subject */
  @Post('erase')
  @HttpCode(200)
  async erase(
    @Body() body: { patientRc: string; confirmErasure: boolean },
    @Request() req: { user: { email: string; role: string } },
    @Ip() ip: string,
  ) {
    assertAdmin(req);
    if (!body.confirmErasure) {
      throw Object.assign(new Error('confirmErasure must be true'), { status: 400 });
    }
    return this.gdpr.eraseSubjectData(body.patientRc, req.user.email, req.user.role, ip);
  }
}
