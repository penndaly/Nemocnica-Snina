import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuditService, stripPii, ALLOWED_ACTIONS } from '../audit.service';

const sha = (v: string) => `sha256:${createHash('sha256').update(v).digest('hex')}`;

describe('stripPii', () => {
  it('hashes RC (national ID) and email values', () => {
    const out = stripPii({ patientRc: '850315/1234', email: 'jana@x.sk' }) as Record<string, string>;
    expect(out.patientRc).toBe(sha('850315/1234'));
    expect(out.email).toBe(sha('jana@x.sk'));
  });

  it('truncates patient_token to 8 chars + ellipsis', () => {
    const out = stripPii({ patient_token: 'PT-84A2B9C7D6E5' }) as Record<string, string>;
    expect(out.patient_token).toBe('PT-84A2B…');
  });

  it('redacts passwords / tokens / secrets', () => {
    const out = stripPii({ password: 'hunter2', accessToken: 'xyz', totp: '123456' }) as Record<string, string>;
    expect(out.password).toBe('[redacted]');
    expect(out.accessToken).toBe('[redacted]');
    expect(out.totp).toBe('[redacted]');
  });

  it('hashes email-shaped string values regardless of key', () => {
    const out = stripPii({ contact: 'tomas@ns.sk' }) as Record<string, string>;
    expect(out.contact).toBe(sha('tomas@ns.sk'));
  });

  it('recurses into nested objects and arrays', () => {
    const out = stripPii({ a: { b: { email: 'x@y.sk' } }, list: [{ password: 'p' }] }) as any;
    expect(out.a.b.email).toBe(sha('x@y.sk'));
    expect(out.list[0].password).toBe('[redacted]');
  });
});

describe('AuditService.writeAuditEntry', () => {
  function make() {
    const create = jest.fn().mockResolvedValue(undefined);
    const svc = new AuditService({ auditLog: { create } } as any);
    return { svc, create };
  }

  it('rejects an action not in ALLOWED_ACTIONS', async () => {
    const { svc } = make();
    await expect(svc.writeAuditEntry({ action: 'rm_-rf_slash' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts an allowed action and strips PII from meta before persisting', async () => {
    const { svc, create } = make();
    await svc.writeAuditEntry({ action: 'gdpr_export_requested', meta: { email: 'a@b.sk', requestReference: 'R1' } });
    expect(create).toHaveBeenCalledTimes(1);
    const written = create.mock.calls[0][0].data;
    expect(written.action).toBe('gdpr_export_requested');
    expect((written.detail as Record<string, string>).email).toBe(sha('a@b.sk'));
    expect((written.detail as Record<string, string>).requestReference).toBe('R1');
  });

  it('the legacy log() adapter strips PII (without enforcing ALLOWED_ACTIONS)', async () => {
    const { svc, create } = make();
    await svc.log({ actorEmail: 'sys@ns.sk', actorRole: 'admin', action: 'login', resource: 'staff', resourceId: '1', detail: { password: 'x' } });
    expect((create.mock.calls[0][0].data.detail as Record<string, string>).password).toBe('[redacted]');
  });

  it('ALLOWED_ACTIONS covers GDPR + translation + content-tools actions', () => {
    for (const a of ['gdpr_erasure_completed', 'translation_reviewed', 'content_export', 'content_reset']) {
      expect(ALLOWED_ACTIONS.has(a)).toBe(true);
    }
  });
});
