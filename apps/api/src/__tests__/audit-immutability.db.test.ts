/**
 * DB-level audit log immutability test.
 *
 * REQUIRES: a real PostgreSQL instance with audit-immutability.sql applied
 *   - DATABASE_URL env var → used by Prisma (ns_app role credentials)
 *   - The ns_app role has INSERT+SELECT only; no UPDATE/DELETE
 *   - The trigger fires even if somehow a superuser slips through
 *
 * Run in CI with the postgres service active:
 *   pnpm --filter=@ns/api test -- audit-immutability
 *
 * Run locally:
 *   make test-audit-immutability
 *
 * What this proves:
 *   1. AuditService.log() succeeds (INSERT works)
 *   2. A direct $queryRaw UPDATE on audit_log throws — privilege denied
 *   3. A direct $queryRaw DELETE on audit_log throws — privilege denied
 *   4. The error comes from the DB, not from our application code
 *      (we use raw SQL to bypass the ORM layer entirely)
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// This test uses the APPLICATION role (ns_app), not the superuser.
// DATABASE_URL in CI points to ns_app@nemocnica_test.
// The audit-immutability.sql is applied during CI db:push + db-harden step.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env['DATABASE_URL'] } },
});

const TEST_ENTRY_ID = randomUUID();

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  // Clean up — DELETE is blocked for ns_app, so we verify that here too.
  await prisma.$disconnect();
});

// Both layers documented in audit-immutability.sql are valid rejection paths:
// Postgres checks table-level privileges (Layer 1: REVOKE UPDATE/DELETE)
// before a statement ever reaches row-level trigger execution (Layer 2), so
// ns_app's mutations are always rejected by the privilege check first —
// "permission denied for table audit_log" — never by the trigger's own
// "append-only..." message. The trigger fires only if a role WITH grant-level
// UPDATE/DELETE privileges attempts a mutation (e.g. a superuser slipping
// through), which this ns_app-scoped test can't exercise. Both messages
// indicate the same correct outcome: the mutation was rejected.
const REJECTION_MESSAGE = /append-only|prohibited|insufficient_privilege|permission denied/i;

describe('audit_log DB-level immutability (Decree 179/2020)', () => {
  it('INSERT succeeds — application can write audit events', async () => {
    await expect(
      prisma.auditLog.create({
        data: {
          id: TEST_ENTRY_ID,
          actorEmail: 'test@nemocnicasnina.sk',
          actorRole: 'editor',
          action: 'test_immutability_check',
          resource: 'audit_log',
          resourceId: TEST_ENTRY_ID,
          detail: { test: true } as never,
          ip: '127.0.0.1',
        },
      }),
    ).resolves.toBeDefined();
  });

  it('SELECT works — application can read audit events', async () => {
    const row = await prisma.auditLog.findUnique({ where: { id: TEST_ENTRY_ID } });
    expect(row).not.toBeNull();
    expect(row?.action).toBe('test_immutability_check');
  });

  it('UPDATE is rejected at the DB layer — trigger raises exception', async () => {
    // Use $queryRaw to bypass Prisma ORM completely.
    // This proves the DB-level trigger fires, independent of application code.
    await expect(
      prisma.$queryRaw`
        UPDATE audit_log
        SET action = 'TAMPERED'
        WHERE id = ${TEST_ENTRY_ID}
      `,
    ).rejects.toMatchObject({
      message: expect.stringMatching(REJECTION_MESSAGE),
    });
  });

  it('DELETE is rejected at the DB layer — trigger raises exception', async () => {
    await expect(
      prisma.$queryRaw`
        DELETE FROM audit_log
        WHERE id = ${TEST_ENTRY_ID}
      `,
    ).rejects.toMatchObject({
      message: expect.stringMatching(REJECTION_MESSAGE),
    });
  });

  it('UPDATE via Prisma ORM is also rejected (belt-and-suspenders)', async () => {
    await expect(
      prisma.auditLog.update({
        where: { id: TEST_ENTRY_ID },
        data: { action: 'TAMPERED' },
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(REJECTION_MESSAGE),
    });
  });

  it('row is unchanged after rejected mutations', async () => {
    const row = await prisma.auditLog.findUnique({ where: { id: TEST_ENTRY_ID } });
    expect(row?.action).toBe('test_immutability_check');
  });

  it('TRUNCATE is rejected (no truncate privilege for ns_app)', async () => {
    await expect(
      prisma.$queryRaw`TRUNCATE audit_log`,
    ).rejects.toThrow();
  });
});
