import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { StorageService } from '../storage.service';

function svc() {
  const cfg = {
    get: (k: string) => ({
      GDPR_STORAGE_PROVIDER: 'local',
      GDPR_EXPORT_KEY: 'a'.repeat(64),
      GDPR_EXPORT_URL_TTL_SECONDS: 300,
      GDPR_EXPORT_RETENTION_HOURS: 1,
      API_BASE_URL: 'http://localhost:4000',
    } as Record<string, unknown>)[k],
  } as unknown as ConfigService;
  return new StorageService(cfg);
}

describe('StorageService (encrypted, signed, single-use)', () => {
  it('round-trips an encrypted JSON payload via a signed token', async () => {
    const s = svc();
    const signed = await s.putEncryptedJson({ hello: 'world', n: 42 }, { filename: 'x.json', downloadPath: '/api/gdpr/download' });
    expect(signed.downloadUrl).toContain('/api/gdpr/download?id=');
    const { data, filename } = await s.downloadAndConsume(signed.id, signed.token);
    expect(filename).toBe('x.json');
    expect(JSON.parse(data.toString('utf8'))).toEqual({ hello: 'world', n: 42 });
  });

  it('rejects a tampered token', async () => {
    const s = svc();
    const signed = await s.putEncryptedJson({ a: 1 }, { filename: 'x.json', downloadPath: '/d' });
    await expect(s.downloadAndConsume(signed.id, signed.token + 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes the object after a successful download (single-use)', async () => {
    const s = svc();
    const signed = await s.putEncryptedJson({ a: 1 }, { filename: 'x.json', downloadPath: '/d' });
    await s.downloadAndConsume(signed.id, signed.token);
    await expect(s.downloadAndConsume(signed.id, signed.token)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('encrypts at rest (ciphertext differs across calls for the same payload)', async () => {
    const s = svc();
    const a = await s.putEncryptedJson({ same: true }, { filename: 'a', downloadPath: '/d' });
    const b = await s.putEncryptedJson({ same: true }, { filename: 'b', downloadPath: '/d' });
    expect(a.token).not.toBe(b.token);
    expect(a.id).not.toBe(b.id);
  });
});
