import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HisQueueService } from '../his/his-queue.service';
import { randomUUID } from 'crypto';

@Controller('api')
export class HealthController {
  constructor(private readonly his: HisQueueService) {}

  /** GET /api/health — liveness probe for load balancers and smoke tests */
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** POST /api/his/smoke — publishes a test HIS event; admin-only */
  @Post('his/smoke')
  @UseGuards(AuthGuard('jwt'))
  async hisSmokePublish(
    @Body() body: { type: string; clinicId?: string; patientName?: string },
    @Request() req: { user: { role: string } },
  ) {
    if (req.user.role !== 'ADMIN') {
      throw Object.assign(new Error('Admin role required'), { status: 403 });
    }
    await this.his.publish({
      type: 'booking.confirmed',
      idempotencyKey: `smoke:${randomUUID()}`,
      payload: { clinicId: body.clinicId ?? 'smoke', patientName: body.patientName ?? 'Smoke Test' },
      timestamp: new Date().toISOString(),
    });
    return { published: true };
  }
}
