import { Body, Controller, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // 10 attempts/min
  async login(
    @Body() body: { email: string; password: string; totpCode: string },
    @Ip() ip: string,
  ) {
    return this.auth.login(body.email, body.password, body.totpCode, ip);
  }
}
