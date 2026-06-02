import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaClient, OnboardingStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { validateRodneCislo } from '../common/rc-validation';
import { NcziXmlService } from './nczi-xml.service';
import { AuditService } from '../audit/audit.service';

interface ApplyDto {
  physicianId: string;
  patientName: string;
  patientRc: string;
  insurerCode: string;
  phone: string;
  email?: string;
}

const prisma = new PrismaClient();

@Injectable()
export class OnboardingService {
  constructor(
    private readonly ncziXml: NcziXmlService,
    private readonly audit: AuditService,
  ) {}

  async apply(dto: ApplyDto) {
    if (!validateRodneCislo(dto.patientRc)) {
      throw new BadRequestException('Invalid rodné číslo');
    }

    const rcHash = await bcrypt.hash(dto.patientRc, 12);

    const application = await prisma.onboardingApplication.create({
      data: {
        id: randomUUID(),
        physicianId: dto.physicianId,
        patientName: dto.patientName,
        patientRcHash: rcHash,
        insurerCode: dto.insurerCode,
        phone: dto.phone,
        email: dto.email,
        status: OnboardingStatus.SUBMITTED,
      },
    });

    return { applicationId: application.id };
  }

  async review(
    applicationId: string,
    decision: 'accept' | 'reject',
    reviewerEmail: string,
    reviewerRole: string,
    reviewNote: string,
    ip: string,
  ) {
    const app = await prisma.onboardingApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });

    const newStatus =
      decision === 'accept' ? OnboardingStatus.ACCEPTED : OnboardingStatus.REJECTED;

    await prisma.onboardingApplication.update({
      where: { id: applicationId },
      data: { status: newStatus, reviewNote },
    });

    await this.audit.log({
      actorEmail: reviewerEmail,
      actorRole: reviewerRole,
      action: decision === 'accept' ? 'onboarding_accept' : 'onboarding_reject',
      resource: 'onboarding_application',
      resourceId: applicationId,
      detail: { reviewNote, physicianId: app.physicianId },
      ip,
    });

    if (decision === 'accept') {
      // Generate eDohoda XML for patient to sign via eID
      const xml = this.ncziXml.generateEDohoda({
        patientRc: '[REDACTED — retrieve via secure channel]',
        insurerCode: app.insurerCode,
        doctorCode: app.physicianId,
        validFrom: new Date().toISOString().substring(0, 10),
      });
      // TODO: send xml + eID signing link to patient via SMS/email
      return { status: newStatus, edohodaXml: xml };
    }

    return { status: newStatus };
  }
}
