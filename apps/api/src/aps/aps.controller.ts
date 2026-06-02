import { Controller, Get, Query } from '@nestjs/common';
import { ApsService } from './aps.service';

@Controller('api/aps')
export class ApsController {
  constructor(private readonly aps: ApsService) {}

  @Get('schedule')
  async getSchedule(@Query('district') district?: string) {
    return this.aps.getSchedule(district ?? 'snina');
  }
}
