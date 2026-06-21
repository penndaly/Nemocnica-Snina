import { Body, Controller, ForbiddenException, Get, Ip, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { OnboardingService } from './onboarding.service';

function assertClinician(req: { user: { role: string } }) {
  if (req.user.role === 'EDITOR') {
    throw new ForbiddenException('Clinician or Admin role required');
  }
}

@Controller('api/onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post('apply')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  async apply(@Body() body: Record<string, unknown>) {
    return this.onboarding.apply({
      physicianId: String(body['physicianId'] ?? ''),
      patientName: String(body['patientName'] ?? ''),
      patientRc: String(body['patientRc'] ?? ''),
      insurerCode: String(body['insurerCode'] ?? ''),
      phone: String(body['phone'] ?? ''),
      email: body['email'] ? String(body['email']) : undefined,
    });
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async list(@Request() req: { user: { role: string } }) {
    assertClinician(req);
    return this.onboarding.list();
  }

  @Post(':id/review')
  @UseGuards(AuthGuard('jwt'))
  async review(
    @Param('id') id: string,
    @Body() body: { decision: 'accept' | 'reject'; note?: string },
    @Request() req: { user: { email: string; role: string } },
    @Ip() ip: string,
  ) {
    assertClinician(req);
    return this.onboarding.review(
      id,
      body.decision,
      req.user.email,
      req.user.role,
      body.note ?? '',
      ip,
    );
  }
}
