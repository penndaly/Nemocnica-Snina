import * as bcrypt from 'bcryptjs';
import { GdprService } from '../gdpr.service';

const RC = '850315/0007';

async function build(onboardingApps: Array<Record<string, unknown>>) {
  const hash = await bcrypt.hash(RC, 4);
  const booking = {
    findMany: jest.fn()
      .mockResolvedValueOnce([{ patientRcHash: hash }]) // findRcHash (distinct hashes)
      .mockResolvedValueOnce([]),                        // main bookings query
  };
  const prisma = {
    booking,
    onboardingApplication: { findMany: jest.fn().mockResolvedValue(onboardingApps) },
    smsOtp: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;
  const rcCrypto = { encrypt: jest.fn(), decrypt: jest.fn((c: string) => (c === 'CIPHER' ? RC : 'WRONG')) } as any;
  return { svc: new GdprService(prisma, audit, rcCrypto), rcCrypto };
}

describe('GdprService.exportSubjectData — decrypted RC (Art. 15)', () => {
  it('includes the decrypted RC for an application with ciphertext', async () => {
    const { svc, rcCrypto } = await build([
      { id: 'a1', physicianId: 'borscova', patientName: 'Jana', insurerCode: '25', phone: '+421', email: null, status: 'SUBMITTED', createdAt: new Date(), patientRcEncrypted: 'CIPHER' },
    ]);
    const out = await svc.exportSubjectData(RC, 'admin@ns.sk', 'super_admin', '127.0.0.1');
    const app = out.onboardingApplications[0] as Record<string, unknown>;
    expect(rcCrypto.decrypt).toHaveBeenCalledWith('CIPHER');
    expect(app.rc).toBe(RC);
    expect(app).not.toHaveProperty('patientRcEncrypted'); // ciphertext never emitted raw
  });

  it('includes an explanatory note for a pre-fix application (no ciphertext)', async () => {
    const { svc } = await build([
      { id: 'a2', physicianId: 'borscova', patientName: 'Old', insurerCode: '25', phone: '+421', email: null, status: 'ACCEPTED', createdAt: new Date(), patientRcEncrypted: null },
    ]);
    const out = await svc.exportSubjectData(RC, 'admin@ns.sk', 'super_admin', '127.0.0.1');
    const app = out.onboardingApplications[0] as Record<string, unknown>;
    expect(String(app.rc)).toMatch(/Not retained|hospital data controller/i);
  });
});
