import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SatisfactionSurveyService } from './satisfaction-survey.service';

@Controller('api/patient-feedback/survey')
export class SatisfactionSurveyController {
  constructor(private readonly surveys: SatisfactionSurveyService) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async submit(@Body() body: Record<string, unknown>) {
    return this.surveys.submit({
      clinicName: String(body['clinicName'] ?? ''),
      visitDate: body['visitDate'] ? String(body['visitDate']) : undefined,
      rating: Number(body['rating']),
      comment: body['comment'] ? String(body['comment']) : undefined,
    });
  }
}
