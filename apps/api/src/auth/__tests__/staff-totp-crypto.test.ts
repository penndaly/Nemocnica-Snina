import { ConfigService } from '@nestjs/config';
import { StaffTotpCryptoService, StaffTotpCryptoError } from '../staff-totp-crypto.service';

const KEY = 'a'.repeat(64); // 32-byte hex
const cfg = { get: (k: string) => (k === 'STAFF_TOTP_KEY' ? KEY : undefined) } as unknown as ConfigService;

describe('StaffTotpCryptoService (AES-256-GCM)', () => {
  const svc = new StaffTotpCryptoService(cfg);

  it('round-trips a TOTP secret', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const enc = svc.encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(svc.decrypt(enc)).toBe(secret);
  });

  it('produces a fresh IV each time (ciphertext differs)', () => {
    expect(svc.encrypt('same')).not.toBe(svc.encrypt('same'));
  });

  it('throws StaffTotpCryptoError on tampered ciphertext', () => {
    const enc = svc.encrypt('secret');
    const tampered = Buffer.from(enc, 'base64');
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => svc.decrypt(tampered.toString('base64'))).toThrow(StaffTotpCryptoError);
  });

  it('rejects a malformed key at construction', () => {
    const bad = { get: () => 'tooshort' } as unknown as ConfigService;
    expect(() => new StaffTotpCryptoService(bad)).toThrow();
  });
});
