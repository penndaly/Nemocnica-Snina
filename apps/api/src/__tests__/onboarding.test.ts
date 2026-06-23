import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { OnboardingService } from '../onboarding/onboarding.service';
import { NcziXmlService } from '../onboarding/nczi-xml.service';

// ── NcziXmlService ────────────────────────────────────────────────────────────

describe('NcziXmlService.generateEDohoda', () => {
  const svc = new NcziXmlService();

  it('produces valid XML with all required fields', () => {
    const xml = svc.generateEDohoda({
      patientRc: '800101/1234',
      insurerCode: '25',
      doctorCode: 'borscova',
      hospitalIco: '52379571',
      validFrom: '2026-06-21',
      validTo: '2027-06-21',
    });

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<eDohoda xmlns="urn:nczi:edohoda:1.0">');
    expect(xml).toContain('<rodneCislo>800101/1234</rodneCislo>');
    expect(xml).toContain('<kod>25</kod>');
    expect(xml).toContain('<kod>borscova</kod>');
    expect(xml).toContain('<ico>52379571</ico>');
    expect(xml).toContain('<platnostOd>2026-06-21</platnostOd>');
    expect(xml).toContain('<platnostDo>2027-06-21</platnostDo>');
    expect(xml).toContain('<typ>kapitacna</typ>');
  });

  it('escapes XML special characters in inputs', () => {
    const xml = svc.generateEDohoda({
      patientRc: '<test&>',
      insurerCode: '"27"',
      doctorCode: "it's",
      hospitalIco: '123',
      validFrom: '2026-01-01',
      validTo: '2027-01-01',
    });

    expect(xml).not.toContain('<test&>');
    expect(xml).toContain('&lt;test&amp;&gt;');
    expect(xml).toContain('&quot;27&quot;');
    expect(xml).toContain('it&apos;s');
  });

  it('validTo is one year after validFrom when set correctly', () => {
    const xml = svc.generateEDohoda({
      patientRc: '[REDACTED]',
      insurerCode: '27',
      doctorCode: 'pavlovcin',
      hospitalIco: '52379571',
      validFrom: '2026-06-21',
      validTo: '2027-06-21',
    });

    expect(xml).toContain('<platnostOd>2026-06-21</platnostOd>');
    expect(xml).toContain('<platnostDo>2027-06-21</platnostDo>');
  });
});

// ── OnboardingService.review — unit tests with mocked deps ────────────────────

function buildMocks() {
  const app = {
    id: 'app-uuid-1',
    physicianId: 'borscova',
    patientName: 'Jana Testová',
    patientRcHash: '$2b$12$fakehash',
    patientRcEncrypted: 'enc::850101/0008',
    insurerCode: '25',
    phone: '+421904111222',
    email: null,
    status: 'SUBMITTED' as const,
    reviewNote: null,
    reviewedById: null,
    ncziXmlPayload: null,
    signToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const prisma = {
    onboardingApplication: {
      findMany: jest.fn().mockResolvedValue([app]),
      findUniqueOrThrow: jest.fn().mockResolvedValue(app),
      create: jest.fn().mockResolvedValue({ id: 'new-uuid' }),
      update: jest.fn().mockResolvedValue({ ...app, status: 'ACCEPTED' }),
    },
  };

  const ncziXml = new NcziXmlService();

  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  const his = { publish: jest.fn().mockResolvedValue(undefined) };

  const sms = { sendRaw: jest.fn().mockResolvedValue(undefined) };

  const cfg = { get: jest.fn((key: string) => {
    if (key === 'HOSPITAL_ICO') return '52379571';
    if (key === 'APP_BASE_URL') return 'https://nemocnicasnina.sk';
    return undefined;
  }) };

  const rcCrypto = {
    encrypt: jest.fn((s: string) => `enc::${s}`),
    decrypt: jest.fn((c: string) => c.replace(/^enc::/, '')),
  };

  const service = new OnboardingService(
    prisma as never,
    ncziXml,
    audit as never,
    his as never,
    sms as never,
    cfg as never,
    rcCrypto as never,
  );

  return { service, prisma, audit, his, sms, app, rcCrypto };
}

describe('OnboardingService.review — accept flow', () => {
  it('updates status to ACCEPTED and stores ncziXmlPayload + signToken', async () => {
    const { service, prisma } = buildMocks();

    const result = await service.review('app-uuid-1', 'accept', 'clinician@ns.sk', 'CLINICIAN', '', '127.0.0.1');

    expect(result.status).toBe('ACCEPTED');
    expect(result.edohodaXml).toBeDefined();
    expect(result.edohodaXml).toContain('<eDohoda');

    const updateCall = prisma.onboardingApplication.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('ACCEPTED');
    expect(updateCall.data.ncziXmlPayload).toContain('<eDohoda');
    expect(updateCall.data.signToken).toBeDefined();
    expect(updateCall.data.signToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('publishes onboarding.accepted to RabbitMQ with correct payload', async () => {
    const { service, his } = buildMocks();

    await service.review('app-uuid-1', 'accept', 'clinician@ns.sk', 'CLINICIAN', '', '127.0.0.1');

    expect(his.publish).toHaveBeenCalledTimes(1);
    const event = his.publish.mock.calls[0][0];
    expect(event.type).toBe('onboarding.accepted');
    expect(event.idempotencyKey).toBe('app-uuid-1');
    expect(event.payload.physicianId).toBe('borscova');
    expect(event.payload.ncziXmlPayload).toContain('<eDohoda');
  });

  it('writes audit_log entry on accept', async () => {
    const { service, audit } = buildMocks();

    await service.review('app-uuid-1', 'accept', 'clinician@ns.sk', 'CLINICIAN', 'All ok', '10.0.0.1');

    expect(audit.log).toHaveBeenCalledTimes(1);
    const logCall = audit.log.mock.calls[0][0];
    expect(logCall.action).toBe('onboarding_accept');
    expect(logCall.resource).toBe('onboarding_application');
    expect(logCall.resourceId).toBe('app-uuid-1');
    expect(logCall.actorEmail).toBe('clinician@ns.sk');
  });

  it('sends SMS to patient with signing link on accept', async () => {
    const { service, sms } = buildMocks();

    await service.review('app-uuid-1', 'accept', 'clinician@ns.sk', 'CLINICIAN', '', '127.0.0.1');

    expect(sms.sendRaw).toHaveBeenCalledTimes(1);
    const [phone, message] = sms.sendRaw.mock.calls[0];
    expect(phone).toBe('+421904111222');
    expect(message).toContain('schválená');
    expect(message).toContain('/sk/registracia/podpis?token=');
  });

  it('XML contains hospital ICO from config', async () => {
    const { service } = buildMocks();

    const result = await service.review('app-uuid-1', 'accept', 'clinician@ns.sk', 'CLINICIAN', '', '127.0.0.1');

    expect(result.edohodaXml).toContain('<ico>52379571</ico>');
  });

  it('XML validTo is one year after validFrom', async () => {
    const { service } = buildMocks();

    const result = await service.review('app-uuid-1', 'accept', 'clinician@ns.sk', 'CLINICIAN', '', '127.0.0.1');

    const fromMatch = result.edohodaXml!.match(/<platnostOd>(\d{4}-\d{2}-\d{2})<\/platnostOd>/);
    const toMatch = result.edohodaXml!.match(/<platnostDo>(\d{4}-\d{2}-\d{2})<\/platnostDo>/);
    expect(fromMatch).not.toBeNull();
    expect(toMatch).not.toBeNull();

    const from = new Date(fromMatch![1] as string);
    const to = new Date(toMatch![1] as string);
    expect(to.getFullYear() - from.getFullYear()).toBe(1);
  });
});

describe('OnboardingService.review — reject flow', () => {
  it('updates status to REJECTED with reason; does not generate XML', async () => {
    const { service, prisma } = buildMocks();

    const result = await service.review('app-uuid-1', 'reject', 'clinician@ns.sk', 'CLINICIAN', 'Duplicate application', '127.0.0.1');

    expect(result.status).toBe('REJECTED');
    expect(result).not.toHaveProperty('edohodaXml');

    const updateCall = prisma.onboardingApplication.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('REJECTED');
    expect(updateCall.data.reviewNote).toBe('Duplicate application');
    expect(updateCall.data.ncziXmlPayload).toBeUndefined();
  });

  it('does NOT publish to RabbitMQ on reject', async () => {
    const { service, his } = buildMocks();

    await service.review('app-uuid-1', 'reject', 'clinician@ns.sk', 'CLINICIAN', 'reason', '127.0.0.1');

    expect(his.publish).not.toHaveBeenCalled();
  });

  it('writes audit_log entry on reject', async () => {
    const { service, audit } = buildMocks();

    await service.review('app-uuid-1', 'reject', 'clinician@ns.sk', 'CLINICIAN', 'reason', '10.0.0.1');

    expect(audit.log).toHaveBeenCalledTimes(1);
    const logCall = audit.log.mock.calls[0][0];
    expect(logCall.action).toBe('onboarding_reject');
  });

  it('sends rejection SMS to patient with reason', async () => {
    const { service, sms } = buildMocks();

    await service.review('app-uuid-1', 'reject', 'clinician@ns.sk', 'CLINICIAN', 'Incomplete docs', '127.0.0.1');

    expect(sms.sendRaw).toHaveBeenCalledTimes(1);
    const [phone, message] = sms.sendRaw.mock.calls[0];
    expect(phone).toBe('+421904111222');
    expect(message).toContain('zamietnutá');
    expect(message).toContain('Incomplete docs');
  });
});

describe('OnboardingService.review — RBAC', () => {
  it('throws ForbiddenException when role is EDITOR', async () => {
    const { service } = buildMocks();

    await expect(
      service.review('app-uuid-1', 'accept', 'editor@ns.sk', 'EDITOR', '', '127.0.0.1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows CLINICIAN role', async () => {
    const { service } = buildMocks();

    await expect(
      service.review('app-uuid-1', 'accept', 'clinician@ns.sk', 'CLINICIAN', '', '127.0.0.1'),
    ).resolves.toBeDefined();
  });

  it('allows ADMIN role', async () => {
    const { service } = buildMocks();

    await expect(
      service.review('app-uuid-1', 'accept', 'admin@ns.sk', 'ADMIN', '', '127.0.0.1'),
    ).resolves.toBeDefined();
  });
});

describe('OnboardingService.review — already reviewed guard', () => {
  it('throws BadRequestException if application already ACCEPTED', async () => {
    const { service, prisma, app } = buildMocks();
    prisma.onboardingApplication.findUniqueOrThrow.mockResolvedValue({
      ...app,
      status: 'ACCEPTED',
    });

    await expect(
      service.review('app-uuid-1', 'accept', 'clinician@ns.sk', 'CLINICIAN', '', '127.0.0.1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException if application already REJECTED', async () => {
    const { service, prisma, app } = buildMocks();
    prisma.onboardingApplication.findUniqueOrThrow.mockResolvedValue({
      ...app,
      status: 'REJECTED',
    });

    await expect(
      service.review('app-uuid-1', 'reject', 'clinician@ns.sk', 'CLINICIAN', '', '127.0.0.1'),
    ).rejects.toThrow(BadRequestException);
  });
});

// ── patientRcEncrypted (NCZI / GDPR reversible RC) ───────────────────────────

describe('OnboardingService — patientRcEncrypted', () => {
  it('apply() stores BOTH the bcrypt hash and the AES ciphertext, neither equal', async () => {
    const { service, prisma, rcCrypto } = buildMocks();
    await service.apply({
      physicianId: 'borscova', patientName: 'Jana Testová',
      patientRc: '8503150007', insurerCode: '25', phone: '+421904111222',
    });
    const data = prisma.onboardingApplication.create.mock.calls[0][0].data;
    expect(rcCrypto.encrypt).toHaveBeenCalledWith('8503150007');
    expect(data.patientRcHash).toBeTruthy();
    expect(data.patientRcEncrypted).toBe('enc::8503150007');
    expect(data.patientRcHash).not.toBe(data.patientRcEncrypted); // hash ≠ ciphertext
    expect(data.patientRcHash).not.toContain('8503150007');       // bcrypt hides plaintext
  });

  it('decryptRcForNczi throws a descriptive error for a pre-fix record (never "[REDACTED]")', () => {
    const { service } = buildMocks();
    expect(() => service.decryptRcForNczi({ id: 'app-old', patientRcEncrypted: null }))
      .toThrow(/manually|recoverable/i);
    // ensure the old silent-redaction behaviour is gone
    expect(() => service.decryptRcForNczi({ id: 'app-old', patientRcEncrypted: null }))
      .not.toThrow(/\[REDACTED\]/);
  });

  it('accept generates NCZI XML with the decrypted RC, not a placeholder', async () => {
    const { service } = buildMocks();
    const result = await service.review('app-uuid-1', 'accept', 'clinician@ns.sk', 'CLINICIAN', '', '127.0.0.1');
    expect(result.edohodaXml).toContain('850101/0008'); // decrypted from the fixture ciphertext
    expect(result.edohodaXml).not.toContain('[REDACTED]');
  });
});
