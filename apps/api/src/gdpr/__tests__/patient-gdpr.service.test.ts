import { ForbiddenException } from '@nestjs/common';

// PatientGdprService → StaffAuthService → otplib (ESM). Mock otplib.
jest.mock('otplib', () => ({ authenticator: { verify: jest.fn(), generateSecret: jest.fn(), keyuri: jest.fn() } }));
import { PatientGdprService } from '../patient-gdpr.service';

function make(over: { verifyTotp?: boolean } = {}) {
  const audit = { writeAuditEntry: jest.fn().mockResolvedValue(undefined) } as any;
  const storage = { putEncryptedJson: jest.fn().mockResolvedValue({ downloadUrl: 'u', expiresAt: new Date(), id: 'i', token: 't' }) } as any;
  const staffAuth = { verifyTotpForStaff: jest.fn().mockResolvedValue(over.verifyTotp ?? true) } as any;
  const prisma = {} as any;
  return { svc: new PatientGdprService(prisma, audit, storage, staffAuth), staffAuth };
}

describe('PatientGdprService.erasePatient — access control', () => {
  const ADMIN = { staffId: 'a1', email: 'a@x.sk', role: 'administrator' };
  const SUPER = { staffId: 's1', email: 's@x.sk', role: 'super_admin' };

  it('refuses erasure for a non-super_admin (administrator) before touching data', async () => {
    const { svc } = make();
    await expect(svc.erasePatient('PT-1', 'reason', 'R1', '000000', ADMIN)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses erasure when MFA re-verification fails', async () => {
    const { svc, staffAuth } = make({ verifyTotp: false });
    await expect(svc.erasePatient('PT-1', 'reason', 'R1', '000000', SUPER)).rejects.toBeInstanceOf(ForbiddenException);
    expect(staffAuth.verifyTotpForStaff).toHaveBeenCalledWith('s1', '000000');
  });
});
