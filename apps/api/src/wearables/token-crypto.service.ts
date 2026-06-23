/**
 * AES-256-GCM encryption for OAuth access/refresh tokens.
 *
 * Non-negotiable: no raw platform OAuth tokens in logs or DB plaintext.
 * The key comes from WEARABLES_TOKEN_KEY (32-byte hex, config-validated).
 *
 * Ciphertext format (base64):  iv(12) | authTag(16) | ciphertext
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** Raised on any decryption failure. Never carries plaintext. */
export class WearablesTokenError extends Error {
  constructor(message = 'Token decryption failed') {
    super(message);
    this.name = 'WearablesTokenError';
  }
}

const IV_LEN = 12;
const TAG_LEN = 16;

@Injectable()
export class TokenCryptoService {
  private readonly key: Buffer;

  constructor(cfg: ConfigService) {
    const hex = cfg.get<string>('WEARABLES_TOKEN_KEY') ?? '';
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error(
        'WEARABLES_TOKEN_KEY must be a 32-byte hex string (64 hex chars). Generate: openssl rand -hex 32',
      );
    }
    this.key = Buffer.from(hex, 'hex');
  }

  encryptToken(plaintext: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decryptToken(ciphertext: string): string {
    let raw: Buffer;
    try {
      raw = Buffer.from(ciphertext, 'base64');
    } catch {
      throw new WearablesTokenError();
    }
    if (raw.length < IV_LEN + TAG_LEN) throw new WearablesTokenError();

    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = raw.subarray(IV_LEN + TAG_LEN);

    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch {
      // Swallow the underlying error — it can leak key/plaintext details.
      throw new WearablesTokenError();
    }
  }
}
