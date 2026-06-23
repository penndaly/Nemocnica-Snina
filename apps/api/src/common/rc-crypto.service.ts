/**
 * AES-256-GCM encryption for the patient rodné číslo (RC).
 *
 * The RC is also bcrypt-hashed (irreversible identity check); this encrypts it
 * reversibly so the NCZI eDohoda XML and a GDPR Art. 15 export can recover the
 * plaintext. Key: RC_ENCRYPTION_KEY (32-byte hex, config-validated). Mirrors the
 * StaffTotpCryptoService format:  base64( iv(12) | authTag(16) | ciphertext ).
 * Plaintext RC is never logged.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export class RcCryptoError extends Error {
  constructor(message = 'RC decryption failed') {
    super(message);
    this.name = 'RcCryptoError';
  }
}

const IV_LEN = 12;
const TAG_LEN = 16;

@Injectable()
export class RcCryptoService {
  private readonly key: Buffer;

  constructor(cfg: ConfigService) {
    const hex = cfg.get<string>('RC_ENCRYPTION_KEY') ?? '';
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error('RC_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars). Generate: openssl rand -hex 32');
    }
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const raw = Buffer.from(ciphertext, 'base64');
    if (raw.length < IV_LEN + TAG_LEN) throw new RcCryptoError();
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = raw.subarray(IV_LEN + TAG_LEN);
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch {
      throw new RcCryptoError();
    }
  }
}
