import { Body, Controller, Headers, HttpCode, Post, RawBody, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService, WebhookEvent } from './payments.service';

@Controller('api/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('session/lspp')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async createLsspSession(
    @Body() body: { bookingId: string; locale: string },
    @Request() req: { headers: { host?: string }; protocol?: string },
  ) {
    const baseUrl = `${req.protocol ?? 'https'}://${req.headers.host ?? 'localhost:3000'}`;
    return this.payments.createLsspSession(body.bookingId, body.locale ?? 'sk', baseUrl);
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Body() body: Record<string, unknown>,
    @RawBody() rawBody: Buffer,
    @Headers('x-payment-signature') sig: string,
  ) {
    this.payments.verifyWebhookSignature(rawBody.toString(), sig ?? '');
    await this.payments.handleWebhook(body as unknown as WebhookEvent);
    return { received: true };
  }
}
