#!/usr/bin/env node
/**
 * Media manifest gate — MEDIA-1 (runs in CI lint: `pnpm --filter=@ns/web check:media`).
 *
 * Fails, listing every problem, when:
 *   1. src/lib/media-manifest.json does not parse;
 *   2. an entry's webp file is missing from public/img/;
 *   3. an entry lacks sk or en alt text;
 *   4. a webp exceeds its budget (hero ids 400 KB, in-page 250 KB);
 *   5. a `doc-*` entry exists (physician portraits are real-photo-only);
 *   6. a PageHero `slot="…"` in src/app has no photo — neither its own
 *      manifest entry nor an alias in src/lib/media.ts SLOT_ALIASES — so a
 *      new route cannot ship with an art-only hero by accident.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const IMG = join(WEB, 'public', 'img');
const MANIFEST = join(WEB, 'src', 'lib', 'media-manifest.json');
const MEDIA_TS = join(WEB, 'src', 'lib', 'media.ts');
const HERO_BUDGET_KB = 400, INPAGE_BUDGET_KB = 250;
const errors = [];

let manifest;
try { manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')); }
catch (e) { console.error(`check-media: manifest does not parse: ${e.message}`); process.exit(1); }

for (const [slot, e] of Object.entries(manifest)) {
  if (slot.startsWith('doc-')) { errors.push(`${slot}: doc-* must never be a placeholder (real photos only)`); continue; }
  const file = join(IMG, e.webp ?? '');
  if (!e.webp || !existsSync(file)) { errors.push(`${slot}: public/img/${e.webp ?? '?'} missing`); continue; }
  if (!e.alt?.sk?.trim() || !e.alt?.en?.trim()) errors.push(`${slot}: alt sk+en required`);
  const kb = statSync(file).size / 1024;
  const budget = /-hero$|^home-campus$/.test(slot) ? HERO_BUDGET_KB : INPAGE_BUDGET_KB;
  if (kb > budget) errors.push(`${slot}: ${e.webp} is ${kb.toFixed(0)} KB (> ${budget} KB)`);
}

// Aliases declared in media.ts
const aliasSrc = readFileSync(MEDIA_TS, 'utf8');
const aliases = new Map([...aliasSrc.matchAll(/'([a-z0-9-]+)':\s*'([a-z0-9-]+)'/g)].map((m) => [m[1], m[2]]));
for (const [from, to] of aliases) if (!manifest[to]) errors.push(`alias ${from} → ${to}: target has no manifest entry`);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(n)) out.push(p);
  }
  return out;
}
const slots = new Set();
for (const f of walk(join(WEB, 'src', 'app'))) for (const m of readFileSync(f, 'utf8').matchAll(/slot=["']([a-z0-9-]+)["']|heroProps\(["']([a-z0-9-]+)["']|staticHeroProps\(["']([a-z0-9-]+)["']/g)) slots.add(m[1] ?? m[2] ?? m[3]);
for (const s of slots) {
  const key = /^dept-([a-z0-9-]+)-hero$/.test(s) ? s.replace(/-hero$/, '') : (aliases.get(s) ?? s);
  if (!manifest[key]) errors.push(`hero slot "${s}" has no photo (no manifest entry "${key}" and no alias)`);
}

if (errors.length) { console.error(`check-media: ${errors.length} problem(s)\n  ` + errors.join('\n  ')); process.exit(1); }
console.log(`check-media: ${Object.keys(manifest).length} manifest entries, ${aliases.size} aliases, ${slots.size} hero slots in src/app — all resolve`);
