import { sniffMediaType } from '../strapi-cms.service';

const pad = (head: number[]) => Buffer.from([...head, ...new Array(16).fill(0)]);

describe('sniffMediaType — content-based media validation (QA)', () => {
  it('detects PDF / PNG / JPEG / WebP by magic bytes', () => {
    expect(sniffMediaType(pad([0x25, 0x50, 0x44, 0x46]))).toBe('application/pdf'); // %PDF
    expect(sniffMediaType(pad([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png');
    expect(sniffMediaType(pad([0xff, 0xd8, 0xff]))).toBe('image/jpeg');
    expect(sniffMediaType(Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0])))
      .toBe('image/webp');
  });

  it('rejects a binary masquerading as an allowed type (claimed type ignored)', () => {
    // An ELF/arbitrary blob — would have passed the old mimetype-only check if
    // the client labeled it image/png.
    expect(sniffMediaType(pad([0x7f, 0x45, 0x4c, 0x46]))).toBeNull();
    expect(sniffMediaType(Buffer.from('not a real image'))).toBeNull();
  });

  it('rejects too-short buffers', () => {
    expect(sniffMediaType(Buffer.from([0x25, 0x50]))).toBeNull();
  });
});
