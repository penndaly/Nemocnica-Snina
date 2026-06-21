/**
 * Immutable audit log — append-only.
 * Application layer: only INSERT is called here.
 * DB layer: see infra/postgres/audit-immutability.sql — the ns_app role
 * has no UPDATE/DELETE grant, and a trigger raises an exception if attempted.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: LogParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actorEmail: params.actorEmail,
        actorRole: params.actorRole,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        detail: params.detail as never,
        ip: params.ip ?? null,
        actorId: params.actorId ?? null,
      },
    });
  }
}
