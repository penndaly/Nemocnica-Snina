import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HisModule } from '../his/his.module';

@Module({
  imports: [HisModule],
  controllers: [HealthController],
})
export class HealthModule {}
