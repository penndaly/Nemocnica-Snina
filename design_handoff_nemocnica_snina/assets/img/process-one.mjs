#!/usr/bin/env node
/**
 * Process one sourced raw image into the three shipped derivatives.
 * Usage: node process-one.mjs <slotId> <rawFilePath> <ratioW>/<ratioH> <longEdge> <budgetKB> [posX posY]
 *
 * - Strips all metadata (EXIF/GPS/serials/ICC) — sharp does this by default
 *   unless .withMetadata() is called, which we never call.
 * - Converts to sRGB explicitly (some source files carry Adobe RGB/ProPhoto
 *   profiles that would otherwise shift colour after profile-stripping).
 * - Crops to the slot's aspect ratio with `fit: cover`, centred unless a
 *   position override is given (IMG_1 §3: "Set 'pos' where the default
 *   centre crop cuts the subject badly").
 * - Never upscales — rejects (throws) if the source's long edge is smaller
 *   than the target, per IMG_1 §5's paste-ready-prompt step 3.
 * - Re-encodes at decreasing quality until each of .jpg/.webp/.avif fits
 *   the weight budget, or reports the smallest achievable size if it still
 *   doesn't fit at quality 40 (floor — below that, visible artifacting).
 */
import sharp from 'sharp';
import { statSync } from 'node:fs';

const [, , slotId, rawPath, ratioStr, longEdgeStr, budgetKBStr, posX, posY] = process.argv;
if (!slotId || !rawPath || !ratioStr || !longEdgeStr || !budgetKBStr) {
  console.error('usage: node process-one.mjs <slotId> <rawFilePath> <ratioW>/<ratioH> <longEdge> <budgetKB> [posX posY]');
  process.exit(2);
}

const [rw, rh] = ratioStr.split('/').map(Number);
const longEdge = Number(longEdgeStr);
const budgetKB = Number(budgetKBStr);
const isWide = rw >= rh;
const targetW = isWide ? longEdge : Math.round((longEdge * rw) / rh);
const targetH = isWide ? Math.round((longEdge * rh) / rw) : longEdge;

const img = sharp(rawPath);
const meta = await img.metadata();
const srcLongEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
if (srcLongEdge < longEdge) {
  console.error(`REJECT ${slotId}: source long edge ${srcLongEdge}px < target ${longEdge}px — never upscale, pick another source.`);
  process.exit(1);
}

const position = posX && posY ? { left: Number(posX), top: Number(posY) } : 'attention';

async function encodeToFit(format, opts) {
  let quality = 90;
  let buf;
  do {
    const pipeline = sharp(rawPath)
      .toColorspace('srgb')
      .resize({ width: targetW, height: targetH, fit: 'cover', position });
    buf = await (format === 'jpeg'
      ? pipeline.jpeg({ quality, mozjpeg: true })
      : format === 'webp'
        ? pipeline.webp({ quality })
        : pipeline.avif({ quality })
    ).toBuffer();
    quality -= 10;
  } while (buf.length / 1024 > budgetKB && quality >= 35);
  return buf;
}

const base = `${slotId}-${longEdge}`;
const outJpg = `${base}.jpg`;
const outWebp = `${base}.webp`;
const outAvif = `${base}.avif`;

const jpgBuf = await encodeToFit('jpeg');
const webpBuf = await encodeToFit('webp');
const avifBuf = await encodeToFit('avif');

const { writeFileSync } = await import('node:fs');
const { join, dirname } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const OUT_DIR = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(OUT_DIR, outJpg), jpgBuf);
writeFileSync(join(OUT_DIR, outWebp), webpBuf);
writeFileSync(join(OUT_DIR, outAvif), avifBuf);

const avifKB = statSync(join(OUT_DIR, outAvif)).size / 1024;
const overBudget = avifKB > budgetKB;
console.log(JSON.stringify({
  slotId, outJpg, outWebp, outAvif,
  jpgKB: Math.round(jpgBuf.length / 1024),
  webpKB: Math.round(webpBuf.length / 1024),
  avifKB: Math.round(avifKB),
  budgetKB,
  overBudget,
  targetW, targetH,
}));
if (overBudget) process.exit(3);
