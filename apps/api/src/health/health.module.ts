import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AdminHealthController } from './admin-health.controller';
import { AdminHealthService } from './admin-health.service';
import { HisModule } from '../his/his.module';
import { PrismaModule } from '../prisma/prisma.module';
// AuthModule supplies the staff guards (StaffJwtGuard / StaffRolesGuard) and
// the JwtService they depend on — AdminHealthController is staff-gated.
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [HisModule, PrismaModule, AuthModule],
  controllers: [HealthController, AdminHealthController],
  providers: [AdminHealthService],
})
export class HealthModule {}
