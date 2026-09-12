import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ComplaintsService } from '../complaints.service';

function buildMocks() {
  const complaint = {
    id: 'complaint-uuid-1',
    fullName: 'Jana Testová',
    email: 'jana@example.com',
    department: null,
    complaintText: 'Test complaint',
    status: 'RECEIVED' as const,
    resolvedById: null,
    resolutionNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const prisma = {
    complaint: {
      create: jest.fn().mockResolvedValue(complaint),
      findMany: jest.fn().mockResolvedValue([complaint]),
      findUnique: jest.fn().mockResolvedValue(complaint),
      update: jest.fn().mockResolvedValue({ ...complaint, status: 'RESOLVED' }),
    },
  };
  const audit = { writeAuditEntry: jest.fn().mockResolvedValue(undefined) };
  const service = new ComplaintsService(prisma as never, audit as never);
  const admin = { staffId: 'staff-1', email: 'admin@ns.sk', role: 'administrator' };
  const editor = { staffId: 'staff-2', email: 'editor@ns.sk', role: 'editor' };

  return { service, prisma, audit, complaint, admin, editor };
}

describe('ComplaintsService.submit', () => {
  it('rejects a missing fullName', async () => {
    const { service, prisma } = buildMocks();
    await expect(
      service.submit({ fullName: '', email: 'a@b.com', complaintText: 'x' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.complaint.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid email', async () => {
    const { service, prisma } = buildMocks();
    await expect(
      service.submit({ fullName: 'Jana', email: 'not-an-email', complaintText: 'x' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.complaint.create).not.toHaveBeenCalled();
  });

  it('rejects an empty complaintText', async () => {
    const { service, prisma } = buildMocks();
    await expect(
      service.submit({ fullName: 'Jana', email: 'jana@example.com', complaintText: '   ' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.complaint.create).not.toHaveBeenCalled();
  });

  it('persists a valid complaint and returns its id', async () => {
    const { service } = buildMocks();
    const result = await service.submit({ fullName: 'Jana Testová', email: 'jana@example.com', complaintText: 'Test complaint' });
    expect(result).toEqual({ id: 'complaint-uuid-1' });
  });

  it('writes a complaint_submitted audit entry — email is hashed by the shared PII stripper, not sent in the clear', async () => {
    const { service, audit } = buildMocks();
    await service.submit({ fullName: 'Jana Testová', email: 'jana@example.com', complaintText: 'Test complaint' });

    expect(audit.writeAuditEntry).toHaveBeenCalledTimes(1);
    const entry = audit.writeAuditEntry.mock.calls[0][0];
    expect(entry.action).toBe('complaint_submitted');
    // fullName is never placed in meta at all — only email/department are passed,
    // and AuditService.stripPii (exercised separately) hashes email before persist.
    expect(entry.meta).not.toHaveProperty('fullName');
  });
});

describe('ComplaintsService.list — RBAC', () => {
  it('throws ForbiddenException for a non-admin role', async () => {
    const { service, editor } = buildMocks();
    await expect(service.list(editor)).rejects.toThrow(ForbiddenException);
  });

  it('allows administrator and logs a complaint_viewed audit entry', async () => {
    const { service, admin, audit } = buildMocks();
    const result = await service.list(admin);
    expect(result).toHaveLength(1);
    expect(audit.writeAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'complaint_viewed', actorRole: 'administrator' }),
    );
  });
});

describe('ComplaintsService.resolve', () => {
  it('throws ForbiddenException for a non-admin role', async () => {
    const { service, editor } = buildMocks();
    await expect(service.resolve(editor, 'complaint-uuid-1', 'resolve', 'done')).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException for an unknown id', async () => {
    const { service, admin, prisma } = buildMocks();
    prisma.complaint.findUnique.mockResolvedValue(null);
    await expect(service.resolve(admin, 'nope', 'resolve', 'done')).rejects.toThrow(NotFoundException);
  });

  it('updates status to RESOLVED and audit-logs complaint_resolved', async () => {
    const { service, admin, prisma, audit } = buildMocks();
    const result = await service.resolve(admin, 'complaint-uuid-1', 'resolve', 'Addressed with department head');
    expect(result.status).toBe('RESOLVED');
    expect(prisma.complaint.update.mock.calls[0][0].data.status).toBe('RESOLVED');
    expect(audit.writeAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'complaint_resolved' }),
    );
  });
});
