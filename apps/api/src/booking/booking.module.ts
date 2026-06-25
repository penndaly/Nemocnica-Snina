import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingAdminController } from './booking-admin.controller';
import { BookingService } from './booking.service';
import { BookingAdminService } from './booking-admin.service';
import { BookingRulesService } from './booking-rules.service';
import { BookingReminderService } from './booking-reminder.service';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { HisModule } from '../his/his.module';
import { SmsModule } from '../sms/sms.module';

// PrismaModule and CmsModule are @Global() — no import needed.
// AuthModule supplies the staff guards (StaffJwtGuard / StaffRolesGuard).
@Module({
  imports: [AuditModule, AuthModule, HisModule, SmsModule],
  controllers: [BookingController, BookingAdminController],
  providers: [BookingService, BookingAdminService, BookingRulesService, BookingReminderService],
  exports: [BookingService],
})
export class BookingModule {}
