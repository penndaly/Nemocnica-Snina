import { Module } from '@nestjs/common';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsAdminController } from './complaints-admin.controller';
import { ComplaintsService } from './complaints.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ComplaintsController, ComplaintsAdminController],
  providers: [ComplaintsService],
})
export class ComplaintsModule {}
