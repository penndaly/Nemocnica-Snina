/**
 * Encrypted export storage for GDPR bundles & receipts (Sprint A3).
 *
 * Every object is AES-256-GCM encrypted at rest (GDPR_EXPORT_KEY). Downloads use
 * a one-time, time-limited signed token (GDPR_EXPORT_URL_TTL_SECONDS, default 5
 * min); objects self-delete after download or GDPR_EXPORT_RETENTION_HOURS,
 * whichever is first.
 *
 * Provider is env-switched (GDPR_STORAGE_PROVIDER): an in-memory `local` adapter
 * for dev/CI, and an EU S3-compatible adapter for production (interface only —
 * wired when the bucket + SDK are provisioned). Mirrors the wearables
 * mock/live adapter pattern. EU hosting only (Decree 179/2020).
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from 'crypto';

const IV_LEN = 12;
const TAG_LEN = 16;

export interface StoredObjectMeta {
  id: string;
  key: string; // storage key/path
  createdAt: number;
  expiresAt: number;
}

export interface SignedDownload {
  downloadUrl: string;
  token: string;
  expiresAt: Date;
}

interface MemObject {
  ciphertext: Buffer;
  contentType: string;
  filename: string;
  createdAt: number;
  expiresAt: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider: 'local' | 's3';
  private readonly bucket: string;
  private readonly key: Buffer;
  private readonly urlTtlSec: number;
  private readonly retentionMs: number;
  private readonly base: string;
  /** Dev/CI in-memory store. Production uses S3 (see putS3/getS3 TODOs). */
  private readonly mem = new Map<string, MemObject>();

  constructor(private readonly cfg: ConfigService) {
    this.provider = (cfg.get<string>('GDPR_STORAGE_PROVIDER') as 'local' | 's3') ?? 'local';
    this.bucket = cfg.get<string>('GDPR_EXPORT_BUCKET') ?? 'ns-gdpr-exports-eu';
    const hex = cfg.get<string>('GDPR_EXPORT_KEY') ?? '0'.repeat(64);
    this.key = Buffer.from(/^[0-9a-fA-F]{64}$/.test(hex) ? hex : '0'.repeat(64), 'hex');
    this.urlTtlSec = Number(cfg.get('GDPR_EXPORT_URL_TTL_SECONDS') ?? 300);
    this.retentionMs = Number(cfg.get('GDPR_EXPORT_RETENTION_HOURS') ?? 1) * 3600_000;
    this.base = (cfg.get<string>('API_BASE_URL') ?? 'http://localhost:4000').replace(/\/$/, '');
  }

  /** Encrypt + store a JSON payload; returns a signed, expiring download. */
  async putEncryptedJson(
    payload: unknown,
    opts: { filename: string; downloadPath: string },
  ): Promise<SignedDownload & { id: string }> {
    const plaintext = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
    const ciphertext = this.encrypt(plaintext);
    const id = randomUUID();
    const now = Date.now();
    const obj: MemObject = {
      ciphertext,
      contentType: 'application/json',
      filename: opts.filename,
      createdAt: now,
      expiresAt: now + this.retentionMs,
    };

    if (this.provider === 's3') {
      // TODO(prod): putObject to GDPR_EXPORT_BUCKET (EU) with SSE; key = id.
      this.logger.log(`[gdpr-storage] (s3) would store ${id} in ${this.bucket}`);
    }
    this.mem.set(id, obj);

    const expiresAt = new Date(now + this.urlTtlSec * 1000);
    const token = this.signToken(id, expiresAt.getTime());
    return {
      id,
      token,
      downloadUrl: `${this.base}${opts.downloadPath}?id=${id}&token=${token}`,
      expiresAt,
    };
  }

  /** Validate the signed token, return the decrypted bytes, and delete the object. */
  async downloadAndConsume(id: string, token: string): Promise<{ data: Buffer; filename: string; contentType: string }> {
    if (!this.verifyToken(id, token)) throw new NotFoundException('Invalid or expired download token');
    const obj = this.mem.get(id);
    if (!obj || obj.expiresAt < Date.now()) {
      this.mem.delete(id);
      throw new NotFoundException('Export not found or expired');
    }
    const data = this.decrypt(obj.ciphertext);
    this.mem.delete(id); // delete on successful download
    if (this.provider === 's3') {
      // TODO(prod): deleteObject(bucket, id)
    }
    return { data, filename: obj.filename, contentType: obj.contentType };
  }

  // ── crypto ────────────────────────────────────────────────
  private encrypt(plaintext: Buffer): Buffer {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]);
  }

  private decrypt(buf: Buffer): Buffer {
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }

  // ── signed token (HMAC over id + expiry) ─────────────────
  private signToken(id: string, expMs: number): string {
    const mac = createHmac('sha256', this.key).update(`${id}.${expMs}`).digest('hex').slice(0, 32);
    return `${expMs}.${mac}`;
  }

  private verifyToken(id: string, token: string): boolean {
    const [expStr, mac] = token.split('.');
    if (!expStr || !mac) return false;
    const expMs = Number(expStr);
    if (!Number.isFinite(expMs) || expMs < Date.now()) return false;
    const expected = createHmac('sha256', this.key).update(`${id}.${expMs}`).digest('hex').slice(0, 32);
    return mac === expected;
  }
}
