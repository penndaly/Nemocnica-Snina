import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { BookingRulesService } from './booking-rules.service';
import { AuditModule } from '../audit/audit.module';
import { HisModule } from '../his/his.module';
import { SmsModule } from '../sms/sms.module';

// PrismaModule is @Global() — no import needed here.
@Module({
  imports: [AuditModule, HisModule, SmsModule],
  controllers: [BookingController],
  providers: [BookingService, BookingRulesService],
  exports: [BookingService],
})
export class BookingModule {}
