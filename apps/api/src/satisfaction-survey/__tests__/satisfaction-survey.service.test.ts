import { BadRequestException } from '@nestjs/common';
import { SatisfactionSurveyService } from '../satisfaction-survey.service';

function buildMocks() {
  const prisma = {
    satisfactionSurveyResponse: {
      create: jest.fn().mockResolvedValue({ id: 'survey-uuid-1' }),
    },
  };
  const audit = { writeAuditEntry: jest.fn().mockResolvedValue(undefined) };
  const service = new SatisfactionSurveyService(prisma as never, audit as never);
  return { service, prisma, audit };
}

describe('SatisfactionSurveyService.submit', () => {
  it('rejects a missing clinicName without hitting the DB', async () => {
    const { service, prisma } = buildMocks();
    await expect(
      service.submit({ clinicName: '', rating: 5 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.satisfactionSurveyResponse.create).not.toHaveBeenCalled();
  });

  it.each([0, 6, 2.5, NaN])('rejects an out-of-range or non-integer rating (%p)', async (rating) => {
    const { service, prisma } = buildMocks();
    await expect(
      service.submit({ clinicName: 'Urologická ambulancia', rating }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.satisfactionSurveyResponse.create).not.toHaveBeenCalled();
  });

  it('persists a valid submission and returns its id', async () => {
    const { service, prisma } = buildMocks();
    const result = await service.submit({ clinicName: 'Urologická ambulancia', rating: 4, comment: 'Great care' });

    expect(result).toEqual({ id: 'survey-uuid-1' });
    const data = prisma.satisfactionSurveyResponse.create.mock.calls[0][0].data;
    expect(data.clinicName).toBe('Urologická ambulancia');
    expect(data.rating).toBe(4);
    expect(data.comment).toBe('Great care');
  });

  it('writes a survey_submitted audit entry with no PII (anonymous by design)', async () => {
    const { service, audit } = buildMocks();
    await service.submit({ clinicName: 'Angiologická ambulancia', rating: 3 });

    expect(audit.writeAuditEntry).toHaveBeenCalledTimes(1);
    const entry = audit.writeAuditEntry.mock.calls[0][0];
    expect(entry.action).toBe('survey_submitted');
    expect(entry.meta).not.toHaveProperty('email');
    expect(entry.meta).not.toHaveProperty('fullName');
  });

  it('stores a null visitDate when none is given, without throwing', async () => {
    const { service, prisma } = buildMocks();
    await service.submit({ clinicName: 'Hematologická ambulancia', rating: 5 });
    expect(prisma.satisfactionSurveyResponse.create.mock.calls[0][0].data.visitDate).toBeNull();
  });
});
