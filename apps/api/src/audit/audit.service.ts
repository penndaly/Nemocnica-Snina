/**
 * Immutable audit log — every write is append-only.
 * Reads are restricted to admin role; no updates or deletes permitted.
 */
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

interface LogParams {
  actorEmail: string;
  actorRole: string;
  action: string;
  resource: string;
  resourceId: string;
  detail?: Record<string, unknown>;
  ip?: string;
  actorId?: string;
}

const prisma = new PrismaClient();

@Injectable()
export class AuditService {
  async log(params: LogParams): Promise<void> {
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorEmail: params.actorEmail,
        actorRole: params.actorRole,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        detail: params.detail as never,
        ip: params.ip,
        actorId: params.actorId,
      },
    });
  }
}
