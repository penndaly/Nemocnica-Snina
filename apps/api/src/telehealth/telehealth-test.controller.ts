import { Body, Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelehealthStatus } from '@prisma/client';
import { TelehealthSessionService } from './telehealth-session.service';

/**
 * E2E fixture endpoint — POST /api/test/telehealth/seed-session.
 * Lets the Playwright suite create a Booking + BookingConsent +
 * TelehealthSession at an arbitrary starting status without driving the
 * full booking wizard. Gated two ways: never registered/reachable when
 * NODE_ENV=production, and requires the X-Test-Secret header to match
 * TEST_SECRET (defaults to 'ci-secret', matching the CI/test-helper default).
 */
@Controller('api/test/telehealth')
export class TelehealthTestController {
  private readonly isProduction: boolean;
  private readonly testSecret: string;

  constructor(
    private readonly sessionSvc: TelehealthSessionService,
    cfg: ConfigService,
  ) {
    this.isProduction = cfg.get<string>('NODE_ENV') === 'production';
    this.testSecret = cfg.get<string>('TEST_SECRET') ?? 'ci-secret';
  }

  @Post('seed-session')
  async seedSession(
    @Body() body: { clinicId?: string; status?: string; withConsent?: boolean },
    @Headers('x-test-secret') providedSecret?: string,
  ) {
    if (this.isProduction || providedSecret !== this.testSecret) {
      throw new ForbiddenException('Not available');
    }

    const status = (body.status ?? 'scheduled') as TelehealthStatus;
    const clinicId = body.clinicId ?? 'fro';
    const withConsent = body.withConsent !== false;

    return this.sessionSvc.seedTestSession(clinicId, status, withConsent);
  }
}
