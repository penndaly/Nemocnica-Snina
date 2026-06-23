/**
 * Garmin push webhook (Sprint W6).
 *
 * Order of operations (non-negotiable): validate the HMAC-SHA1 signature FIRST,
 * rate-limit per source IP, return 200 immediately, and enqueue for async
 * processing (never sync inside the handler). Invalid signatures are audited and
 * rejected 401; rate-limit breaches 429. Raw token values are never logged.
 */
import {
  Controller,
  HttpCode,
  Post,
  Req,
  Headers,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AuditService } from '../../audit/audit.service';
import { WearablesQueueService } from '../wearables-queue.service';
import { SlidingWindowRateLimiter, verifyHmacSha1 } from './webhook-signature';

interface RawReq {
  rawBody?: Buffer;
  body?: unknown;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

@Controller('api/wearables/webhooks')
export class GarminWebhookController {
  private readonly key: string;
  private readonly limiter = new SlidingWindowRateLimiter(100, 60_000); // 100/min/IP

  constructor(
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
    private readonly queue: WearablesQueueService,
  ) {
    this.key = cfg.get<string>('GARMIN_WEBHOOK_KEY') ?? '';
  }

  @Post('garmin')
  @HttpCode(200)
  async garmin(
    @Req() req: RawReq,
    @Headers('x-garmin-signature') signature: string | undefined,
  ): Promise<{ ok: true }> {
    const fwd = req.headers?.['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd) ?? req.ip ?? 'unknown';

    if (!this.limiter.allow(String(ip), Date.now())) {
      throw new HttpException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }

    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    if (!verifyHmacSha1(rawBody, signature, this.key)) {
      await this.audit.log({
        actorEmail: 'system:webhook',
        actorRole: 'system',
        action: 'webhook_invalid_signature',
        resource: 'wearable_webhook',
        resourceId: 'garmin',
        detail: { ipHash: createHash('sha256').update(String(ip)).digest('hex').slice(0, 32) },
      });
      throw new UnauthorizedException('INVALID_WEBHOOK_SIGNATURE');
    }

    // Valid: record receipt (body hash only — never raw tokens) and enqueue.
    const bodyHash = createHash('sha256').update(rawBody).digest('hex');
    await this.audit.log({
      actorEmail: 'system:webhook',
      actorRole: 'system',
      action: 'webhook_received',
      resource: 'wearable_webhook',
      resourceId: 'garmin',
      detail: { bodyHash },
    });
    await this.queue.publish('wearables.webhook.garmin', { bodyHash, receivedAt: new Date().toISOString() });

    return { ok: true };
  }
}
