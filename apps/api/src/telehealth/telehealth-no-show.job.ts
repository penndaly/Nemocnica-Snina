import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TelehealthStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TelehealthNoShowJob {
  private readonly logger = new Logger(TelehealthNoShowJob.name);
  private readonly gracePeriodMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    cfg: ConfigService,
  ) {
    this.gracePeriodMinutes = cfg.get<number>('TELEHEALTH_NO_SHOW_GRACE_MINUTES') ?? 15;
  }

  // Every 5 minutes: mark sessions as no_show if patient never joined within grace period
  @Cron(CronExpression.EVERY_5_MINUTES)
  async markNoShows(): Promise<void> {
    const graceCutoff = new Date(
      Date.now() - this.gracePeriodMinutes * 60 * 1000,
    );

    // Sessions still in 'scheduled' status past the grace window → no_show
    const overdueSessions = await this.prisma.telehealthSession.findMany({
      where: {
        status:      TelehealthStatus.scheduled,
        scheduledAt: { lt: graceCutoff },
      },
    });

    if (overdueSessions.length === 0) return;

    this.logger.log(`No-show check: ${overdueSessions.length} overdue sessions`);

    for (const session of overdueSessions) {
      try {
        // Guard against a TOCTOU race: between the findMany above and now the
        // patient may have moved the session scheduled→waiting (or the physician
        // →active). updateMany with the status+time predicate only flips rows
        // STILL scheduled and overdue; if the patient just joined, count===0 and
        // we skip — never clobbering an active/waiting session to no_show.
        const res = await this.prisma.telehealthSession.updateMany({
          where: { id: session.id, status: TelehealthStatus.scheduled, scheduledAt: { lt: graceCutoff } },
          data:  { status: TelehealthStatus.no_show, updatedAt: new Date() },
        });
        if (res.count === 0) continue; // session changed state — leave it alone

        await this.audit.log({
          actorEmail: 'system',
          actorRole:  'scheduler',
          action:     'telehealth.status.scheduled_to_no_show',
          resource:   'telehealth_session',
          resourceId: session.id,
          detail:     {
            scheduledAt:        session.scheduledAt.toISOString(),
            gracePeriodMinutes: this.gracePeriodMinutes,
          },
        });

        // SMS notification to physician is deferred to S9 (requires CMS phone lookup)
        this.logger.log(
          `No-show: session ${session.id} physician=${session.physicianId} at ${session.scheduledAt.toISOString()}`,
        );
      } catch (err: unknown) {
        this.logger.error(`Failed to mark no-show for session ${session.id}: ${String(err)}`);
      }
    }
  }
}
