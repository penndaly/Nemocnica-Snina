/**
 * AES-256-GCM encryption for staff TOTP secrets.
 *
 * Non-negotiable: TOTP secrets are never stored in plaintext. The key comes
 * from STAFF_TOTP_KEY (32-byte hex, config-validated). Mirrors the wearables
 * TokenCryptoService format:  base64( iv(12) | authTag(16) | ciphertext ).
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** Raised on any decryption failure. Never carries plaintext. */
export class StaffTotpCryptoError extends Error {
  constructor(message = 'TOTP secret decryption failed') {
    super(message);
    this.name = 'StaffTotpCryptoError';
  }
}

const IV_LEN = 12;
const TAG_LEN = 16;

@Injectable()
export class StaffTotpCryptoService {
  private readonly key: Buffer;

  constructor(cfg: ConfigService) {
    const hex = cfg.get<string>('STAFF_TOTP_KEY') ?? '';
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error(
        'STAFF_TOTP_KEY must be a 32-byte hex string (64 hex chars). Generate: openssl rand -hex 32',
      );
    }
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const raw = Buffer.from(ciphertext, 'base64');
    if (raw.length < IV_LEN + TAG_LEN) throw new StaffTotpCryptoError();

    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = raw.subarray(IV_LEN + TAG_LEN);

    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch {
      throw new StaffTotpCryptoError();
    }
  }
}
