// Proves the production build guardrail actually fires — IMG_1_PLACEHOLDER_
// PHOTOGRAPHY.md §1 / §7a. Run with: node --test scripts/__tests__/check-no-placeholder-media.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'check-no-placeholder-media.mjs');

function writeFixture(entries) {
  const dir = mkdtempSync(join(tmpdir(), 'media-check-'));
  const path = join(dir, 'index.json');
  writeFileSync(path, JSON.stringify(entries));
  return { dir, path };
}

function run(indexPath, nodeEnv) {
  try {
    execFileSync('node', [SCRIPT], {
      env: { ...process.env, MEDIA_INDEX_PATH: indexPath, NODE_ENV: nodeEnv ?? '' },
      stdio: 'pipe',
    });
    return { code: 0, stderr: '' };
  } catch (err) {
    return { code: err.status, stderr: err.stderr.toString() };
  }
}

test('production build fails and names every offending slot when placeholder:true entries exist', () => {
  const { dir, path } = writeFixture({
    'home-campus': { placeholder: true, src: 'x.jpg', webp: 'x.webp', avif: 'x.avif', alt: { sk: 'a', en: 'b' } },
    'about-hero': { placeholder: true, src: 'y.jpg', webp: 'y.webp', avif: 'y.avif', alt: { sk: 'a', en: 'b' } },
    'dept-fro': { src: 'z.jpg', webp: 'z.webp', avif: 'z.avif', alt: { sk: 'a', en: 'b' } }, // real photo, no placeholder flag
  });
  const { code, stderr } = run(path, 'production');
  rmSync(dir, { recursive: true, force: true });

  assert.equal(code, 1, 'build guardrail must exit non-zero when placeholders are present in production');
  assert.match(stderr, /home-campus/, 'must name the first offending slot');
  assert.match(stderr, /about-hero/, 'must name the second offending slot');
  assert.doesNotMatch(stderr, /dept-fro/, 'must not flag a real (non-placeholder) entry');
});

test('does not block a build with no placeholder entries', () => {
  const { dir, path } = writeFixture({
    'home-campus': { src: 'x.jpg', webp: 'x.webp', avif: 'x.avif', alt: { sk: 'a', en: 'b' } },
  });
  const { code } = run(path, 'production');
  rmSync(dir, { recursive: true, force: true });
  assert.equal(code, 0);
});

test('does not block a non-production build even with placeholder entries', () => {
  const { dir, path } = writeFixture({
    'home-campus': { placeholder: true, src: 'x.jpg', webp: 'x.webp', avif: 'x.avif', alt: { sk: 'a', en: 'b' } },
  });
  const { code } = run(path, 'development');
  rmSync(dir, { recursive: true, force: true });
  assert.equal(code, 0);
});
