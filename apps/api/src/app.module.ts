import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { BookingModule } from './booking/booking.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { HisModule } from './his/his.module';
import { SmsModule } from './sms/sms.module';
import { ApsModule } from './aps/aps.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    AuditModule,
    BookingModule,
    OnboardingModule,
    HisModule,
    SmsModule,
    ApsModule,
  ],
})
export class AppModule {}
