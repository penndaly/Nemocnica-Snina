import { ConfigService } from '@nestjs/config';
import { RcCryptoService, RcCryptoError } from '../rc-crypto.service';

const cfg = { get: (k: string) => (k === 'RC_ENCRYPTION_KEY' ? 'a'.repeat(64) : undefined) } as unknown as ConfigService;

describe('RcCryptoService (AES-256-GCM, reversible RC storage)', () => {
  const svc = new RcCryptoService(cfg);

  it('round-trips a rodné číslo', () => {
    const rc = '850315/0007';
    const enc = svc.encrypt(rc);
    expect(enc).not.toContain(rc);          // ciphertext, not plaintext
    expect(svc.decrypt(enc)).toBe(rc);
  });

  it('uses a fresh IV each time', () => {
    expect(svc.encrypt('850315/0007')).not.toBe(svc.encrypt('850315/0007'));
  });

  it('throws RcCryptoError on tampered ciphertext', () => {
    const enc = svc.encrypt('850315/0007');
    const buf = Buffer.from(enc, 'base64');
    buf[buf.length - 1] ^= 0xff;
    expect(() => svc.decrypt(buf.toString('base64'))).toThrow(RcCryptoError);
  });

  it('rejects a malformed key at construction', () => {
    expect(() => new RcCryptoService({ get: () => 'short' } as unknown as ConfigService)).toThrow();
  });
});
