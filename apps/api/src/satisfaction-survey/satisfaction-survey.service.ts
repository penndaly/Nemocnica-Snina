import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface SubmitSurveyDto {
  clinicName: string;
  visitDate?: string;
  rating: number;
  comment?: string;
}

/** Anonymous — no name/email/session captured, so no audit `meta` PII to strip. */
@Injectable()
export class SatisfactionSurveyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async submit(dto: SubmitSurveyDto) {
    if (!dto.clinicName.trim()) {
      throw new BadRequestException('clinicName is required');
    }
    if (!Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('rating must be an integer 1-5');
    }

    const response = await this.prisma.satisfactionSurveyResponse.create({
      data: {
        id: randomUUID(),
        clinicName: dto.clinicName,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : null,
        rating: dto.rating,
        comment: dto.comment ?? null,
      },
    });

    await this.audit.writeAuditEntry({
      action: 'survey_submitted',
      targetType: 'satisfaction_survey_response',
      targetId: response.id,
      meta: { clinicName: dto.clinicName, rating: dto.rating },
    });

    return { id: response.id };
  }
}
