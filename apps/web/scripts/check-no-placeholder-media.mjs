#!/usr/bin/env node
/**
 * Production build preflight — IMG_1_PLACEHOLDER_PHOTOGRAPHY.md §1:
 * "The production config validator rejects any media asset flagged
 * placeholder: true when NODE_ENV=production — build fails, loudly, naming
 * each offending slot."
 *
 * `next build` sets NODE_ENV=production itself, so this only blocks real
 * production builds — `next dev` and a plain `node ... build` invocation
 * with NODE_ENV unset/development pass through untouched. Wired as the
 * first step of apps/web's own "build" script (not a next.config.ts hook)
 * so it fails fast, before spending time on the actual Next.js compile.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Overridable for the unit test in __tests__/check-no-placeholder-media.test.mjs —
// production callers never set this, so it defaults to the real manifest.
const INDEX_PATH = process.env.MEDIA_INDEX_PATH ?? join(__dirname, '..', '..', '..', 'design_handoff_nemocnica_snina', 'assets', 'img', 'index.json');

if (process.env.NODE_ENV !== 'production') {
  process.exit(0);
}

if (!existsSync(INDEX_PATH)) {
  // No media manifest at all is a content-pipeline gap, not this guard's job.
  process.exit(0);
}

const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
const offending = Object.entries(index)
  .filter(([, entry]) => entry.placeholder === true)
  .map(([slotId]) => slotId);

if (offending.length > 0) {
  console.error('\n✖ Production build blocked: placeholder media in assets/img/index.json\n');
  console.error('The following slots are still flagged "placeholder": true and must be');
  console.error('replaced with real hospital photography before a production build:\n');
  for (const slotId of offending) console.error(`  - ${slotId}`);
  console.error('\nSee IMG_1_PLACEHOLDER_PHOTOGRAPHY.md §6 for the swap-in procedure.\n');
  process.exit(1);
}

process.exit(0);
