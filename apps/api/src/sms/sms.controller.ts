import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { PrismaClient } from '@prisma/client';
import { SmsService } from './sms.service';

const prisma = new PrismaClient();

@Controller('api/sms')
export class SmsController {
  private readonly isConsole: boolean;

  constructor(
    private readonly sms: SmsService,
    cfg: ConfigService,
  ) {
    this.isConsole = cfg.get<string>('SMS_PROVIDER') === 'console';
  }

  @Post('otp')
  @HttpCode(201)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  async sendOtp(@Body() body: { phone: string; purpose: string; ttlOverrideMs?: number }) {
    await this.sms.sendOtp(body.phone, body.purpose ?? 'booking');
    return { sent: true };
  }

  @Post('verify')
  @HttpCode(200)
  async verifyOtp(@Body() body: { phone: string; code: string; purpose: string }) {
    const valid = await this.sms.verifyOtp(body.phone, body.code, body.purpose ?? 'booking');
    return { valid };
  }

  /**
   * GET /api/sms/last-otp — TEST HELPER, console mode only.
   * Returns the last OTP code sent to a phone for a given purpose.
   * Enabled ONLY when SMS_PROVIDER=console (dev/CI). NEVER in production.
   */
  @Get('last-otp')
  async lastOtp(@Query('phone') phone: string, @Query('purpose') purpose: string) {
    if (!this.isConsole) {
      return { error: 'Not available in production' };
    }
    // Fetch the most recent unused OTP for this phone/purpose
    const otp = await prisma.smsOtp.findFirst({
      where: { phone, purpose, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) return { code: null, message: 'No active OTP found' };
    // The code is stored as bcrypt hash — we can't reverse it.
    // In console mode, we log the plaintext; here we return a sentinel for integration tests.
    // For real E2E OTP testing, check the console/log output.
    return {
      code: null,
      message: 'OTP was logged to console (SMS_PROVIDER=console). Check API logs for the code.',
      otpId: otp.id,
      expiresAt: otp.expiresAt,
    };
  }
}
