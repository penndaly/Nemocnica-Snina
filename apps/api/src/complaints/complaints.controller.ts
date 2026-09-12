import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ComplaintsService } from './complaints.service';

@Controller('api/patient-feedback/complaints')
export class ComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  async submit(@Body() body: Record<string, unknown>) {
    return this.complaints.submit({
      fullName: String(body['fullName'] ?? ''),
      email: String(body['email'] ?? ''),
      department: body['department'] ? String(body['department']) : undefined,
      complaintText: String(body['complaintText'] ?? ''),
    });
  }
}
