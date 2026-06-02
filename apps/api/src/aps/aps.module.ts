import { Module } from '@nestjs/common';
import { ApsService } from './aps.service';
import { ApsController } from './aps.controller';

@Module({
  controllers: [ApsController],
  providers: [ApsService],
  exports: [ApsService],
})
export class ApsModule {}
