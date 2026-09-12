import { Module } from '@nestjs/common';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsAdminController } from './complaints-admin.controller';
import { ComplaintsService } from './complaints.service';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

// AuthModule supplies StaffJwtGuard's JwtService. Without it Nest cannot build
// the DI graph and `node dist/main` exits before listening — which is exactly
// how main shipped from ROUTE-1b until the E2E job's API boot caught it.
@Module({
  imports: [AuditModule, AuthModule],
  controllers: [ComplaintsController, ComplaintsAdminController],
  providers: [ComplaintsService],
})
export class ComplaintsModule {}
