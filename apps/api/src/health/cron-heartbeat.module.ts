/**
 * Global so any scheduled job can inject the heartbeat without every feature
 * module importing a health module (which would invert the dependency —
 * health reads from features, not the other way round).
 */
import { Global, Module } from '@nestjs/common';
import { CronHeartbeatService } from './cron-heartbeat.service';

@Global()
@Module({
  providers: [CronHeartbeatService],
  exports: [CronHeartbeatService],
})
export class CronHeartbeatModule {}
