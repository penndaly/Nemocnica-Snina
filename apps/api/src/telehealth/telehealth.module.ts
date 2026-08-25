import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { HisModule } from '../his/his.module';
import { SmsModule } from '../sms/sms.module';
import { VIDEO_PROVIDER } from './video-provider.interface';
import { LiveKitAdapter } from './livekit.adapter';
import { MockVideoProvider } from './mock-video.provider';
import { TelehealthSessionService } from './telehealth-session.service';
import { TelehealthController } from './telehealth.controller';
import { TelehealthAdminController } from './telehealth-admin.controller';
import { TelehealthTestController } from './telehealth-test.controller';
import { TelehealthNoShowJob } from './telehealth-no-show.job';

@Module({
  imports: [ConfigModule, PrismaModule, AuditModule, AuthModule, HisModule, SmsModule],
  controllers: [TelehealthController, TelehealthAdminController, TelehealthTestController],
  providers: [
    {
      provide: VIDEO_PROVIDER,
      useFactory: (cfg: ConfigService) => {
        const provider = cfg.get<string>('TELEHEALTH_PROVIDER') ?? 'mock';
        return provider === 'mock' ? new MockVideoProvider() : new LiveKitAdapter(cfg);
      },
      inject: [ConfigService],
    },
    TelehealthSessionService,
    TelehealthNoShowJob,
  ],
  exports: [TelehealthSessionService],
})
export class TelehealthModule {}
