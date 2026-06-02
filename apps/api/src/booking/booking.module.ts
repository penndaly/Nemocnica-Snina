import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { BookingRulesService } from './booking-rules.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [BookingController],
  providers: [BookingService, BookingRulesService],
  exports: [BookingService],
})
export class BookingModule {}
