/**
 * TokenCryptoService — AES-256-GCM round-trip (Sprint W1, Part E).
 */
import { ConfigService } from '@nestjs/config';
import { TokenCryptoService, WearablesTokenError } from '../token-crypto.service';

const KEY = 'a'.repeat(64); // 32-byte hex

function makeService(key: string | undefined = KEY): TokenCryptoService {
  const cfg = { get: (_: string) => key } as unknown as ConfigService;
  return new TokenCryptoService(cfg);
}

describe('TokenCryptoService', () => {
  it('round-trips an OAuth token (encrypt → decrypt)', () => {
    const svc = makeService();
    const plaintext = 'ya29.a0AfH6SMexample-access-token';
    const enc = svc.encryptToken(plaintext);

    expect(enc).not.toContain(plaintext);          // ciphertext, not plaintext
    expect(svc.decryptToken(enc)).toBe(plaintext);
  });

  it('produces a different ciphertext each call (random IV)', () => {
    const svc = makeService();
    const a = svc.encryptToken('same');
    const b = svc.encryptToken('same');
    expect(a).not.toBe(b);
    expect(svc.decryptToken(a)).toBe('same');
    expect(svc.decryptToken(b)).toBe('same');
  });

  it('throws WearablesTokenError on corrupted ciphertext', () => {
    const svc = makeService();
    const enc = svc.encryptToken('secret');
    const corrupted = enc.slice(0, -4) + 'AAAA';
    expect(() => svc.decryptToken(corrupted)).toThrow(WearablesTokenError);
  });

  it('throws WearablesTokenError on too-short input', () => {
    const svc = makeService();
    expect(() => svc.decryptToken('AAAA')).toThrow(WearablesTokenError);
  });

  it('refuses to construct without a valid 32-byte hex key', () => {
    expect(() => makeService('not-hex')).toThrow('32-byte hex');
  });
});
