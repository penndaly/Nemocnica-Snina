import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SmsService } from './sms.service';

@Controller('api/sms')
export class SmsController {
  constructor(private readonly sms: SmsService) {}

  @Post('otp')
  @HttpCode(204)
  @Throttle({ default: { ttl: 60_000, limit: 3 } }) // 3 OTP sends/min per IP
  async sendOtp(@Body() body: { phone: string; purpose: string }) {
    await this.sms.sendOtp(body.phone, body.purpose ?? 'booking');
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(@Body() body: { phone: string; code: string; purpose: string }) {
    const valid = await this.sms.verifyOtp(body.phone, body.code, body.purpose ?? 'booking');
    return { valid };
  }
}
