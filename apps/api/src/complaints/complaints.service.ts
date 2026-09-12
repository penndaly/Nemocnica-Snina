import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ComplaintStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface SubmitComplaintDto {
  fullName: string;
  email: string;
  department?: string;
  complaintText: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PII-bearing (fullName, email) — handled under Act No. 9/2010 on
 * Complaints. Readable only by administrator|super_admin staff
 * (ComplaintsAdminController); every submission and every staff read is
 * audit-logged, per this repo's append-only audit convention.
 */
@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async submit(dto: SubmitComplaintDto) {
    if (!dto.fullName.trim()) throw new BadRequestException('fullName is required');
    if (!EMAIL_RE.test(dto.email)) throw new BadRequestException('A valid email is required');
    if (!dto.complaintText.trim()) throw new BadRequestException('complaintText is required');

    const complaint = await this.prisma.complaint.create({
      data: {
        id: randomUUID(),
        fullName: dto.fullName,
        email: dto.email,
        department: dto.department ?? null,
        complaintText: dto.complaintText,
        status: ComplaintStatus.RECEIVED,
      },
    });

    // meta goes through AuditService.writeAuditEntry -> stripPii, which
    // SHA-256-hashes any email-shaped value automatically — fullName/email
    // never reach the audit log in the clear.
    await this.audit.writeAuditEntry({
      action: 'complaint_submitted',
      targetType: 'complaint',
      targetId: complaint.id,
      meta: { email: dto.email, department: dto.department },
    });

    return { id: complaint.id };
  }

  private assertHrRole(role: string) {
    if (role !== 'administrator' && role !== 'super_admin') {
      throw new ForbiddenException('administrator or super_admin role required');
    }
  }

  async list(actor: { staffId: string; email: string; role: string }) {
    this.assertHrRole(actor.role);

    const complaints = await this.prisma.complaint.findMany({ orderBy: { createdAt: 'desc' } });

    await this.audit.writeAuditEntry({
      actorId: actor.staffId,
      actorName: actor.email,
      actorRole: actor.role,
      action: 'complaint_viewed',
      targetType: 'complaint',
      targetId: 'list',
      meta: { count: complaints.length },
    });

    return complaints;
  }

  async resolve(
    actor: { staffId: string; email: string; role: string },
    id: string,
    decision: 'resolve' | 'reject',
    resolutionNote: string,
  ) {
    this.assertHrRole(actor.role);

    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) throw new NotFoundException('Complaint not found');

    const status = decision === 'resolve' ? ComplaintStatus.RESOLVED : ComplaintStatus.REJECTED;
    await this.prisma.complaint.update({
      where: { id },
      data: { status, resolvedById: actor.staffId, resolutionNote },
    });

    await this.audit.writeAuditEntry({
      actorId: actor.staffId,
      actorName: actor.email,
      actorRole: actor.role,
      action: 'complaint_resolved',
      targetType: 'complaint',
      targetId: id,
      meta: { status, resolutionNote },
    });

    return { id, status };
  }
}
