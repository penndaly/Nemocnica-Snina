import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { CmsModule } from './cms/cms.module';
import { PublicModule } from './public/public.module';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { PortalModule } from './portal/portal.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { BookingModule } from './booking/booking.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { HisModule } from './his/his.module';
import { SmsModule } from './sms/sms.module';
import { ApsModule } from './aps/aps.module';
import { GdprModule } from './gdpr/gdpr.module';
import { PaymentsModule } from './payments/payments.module';
import { TelehealthModule } from './telehealth/telehealth.module';
import { WearablesModule } from './wearables/wearables.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    CmsModule,
    PublicModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    AdminUsersModule,
    AuditModule,
    BookingModule,
    OnboardingModule,
    HisModule,
    SmsModule,
    ApsModule,
    GdprModule,
    PaymentsModule,
    TelehealthModule,
    WearablesModule,
    PortalModule,
    HealthModule,
  ],
})
export class AppModule {}
