import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AdminHealthController } from './admin-health.controller';
import { AdminHealthService } from './admin-health.service';
import { HisModule } from '../his/his.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [HisModule, PrismaModule],
  controllers: [HealthController, AdminHealthController],
  providers: [AdminHealthService],
})
export class HealthModule {}
