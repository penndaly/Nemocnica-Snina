#!/usr/bin/env node
/**
 * Class-coverage audit — Sprint UI-2a.
 *
 * Every class name referenced from a `className=` in apps/web/src must be
 * defined somewhere: packages/ui/src/globals.css (the app's only stylesheet),
 * or the explicit allowlist below. A class that resolves to no rule renders
 * its children unstyled and still passes every content-presence check and
 * the no-horizontal-scroll ladder (stacking *reduces* width) — that is how
 * Sprint ROUTE-1b shipped `/pre-pacientov` with `.grid-2`, `.wait-row`,
 * `.quote-card`, `.section` and `.table-wrap` all inert. See
 * docs/03-AUDIT.md "Class-coverage audit".
 *
 * Static and cheap: runs in CI's lint job (`pnpm --filter=@ns/web audit:classes`).
 * It complements, not replaces, e2e/styled.spec.ts — this catches "defined
 * nowhere", the spec catches "defined but not applied".
 *
 * Usage: node scripts/audit-classes.mjs   (exit 1 on any unknown class)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_SRC = join(HERE, '..', 'src');
const STYLESHEETS = [join(HERE, '..', '..', '..', 'packages', 'ui', 'src', 'globals.css')];

/**
 * Classes that legitimately have no rule in globals.css.
 *
 * - Tailwind utilities: globals.css has `@tailwind utilities`, and
 *   apps/web/tailwind.config.ts's `content` covers src/**, so these are
 *   emitted at build time (verified by computed style, 2026-09-12). The app's
 *   convention is globals.css classes, not Tailwind — so new Tailwind
 *   utilities are deliberately NOT auto-allowed. Add them here, by name, with
 *   a reason, or use the globals.css equivalent (`.mt-*`/`.mb-*`, `.grid`).
 * - Hook-only classes: referenced by markup that carries its own inline
 *   styles; the class is a selector hook for tests/analytics, not a style.
 */
const ALLOWLIST = new Set([
  // Tailwind utilities in use (objednanie/zrusit, admin/login)
  'flex', 'items-center', 'justify-center', 'gap-3', 'py-16', 'mb-6', 'mt-6', 'animate-spin',
  // Hook-only (inline-styled in SiteHeader.tsx / UtilityBar.tsx)
  'site-header', 'utility-bar',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const defined = new Set();
for (const sheet of STYLESHEETS) {
  for (const m of readFileSync(sheet, 'utf8').matchAll(/\.([a-zA-Z_][\w-]*)/g)) defined.add(m[1]);
}

const IDENT = /^[a-zA-Z_][\w-]*$/;
const used = new Map(); // class -> Set<file:line>
function record(cls, file, line) {
  if (!IDENT.test(cls)) return;
  if (!used.has(cls)) used.set(cls, new Set());
  used.get(cls).add(`${file}:${line}`);
}

for (const file of walk(WEB_SRC)) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(join(HERE, '..'), file);
  // Static: className="a b"
  for (const m of src.matchAll(/className="([^"]*)"/g)) {
    const line = src.slice(0, m.index).split('\n').length;
    for (const c of m[1].split(/\s+/)) record(c, rel, line);
  }
  // Dynamic: className={...} — take every string literal inside (quote
  // types paired, so a template literal's `${…}` never bleeds into a
  // neighbouring '…'), and recurse into `${…}` so ternary branches like
  // `${x ? 'btn-primary' : 'btn-ghost'}` are scanned too. Object keys and
  // variable names never sit inside a string literal, so they can't leak.
  for (const m of src.matchAll(/className=\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
    const line = src.slice(0, m.index).split('\n').length;
    for (const c of classTokensIn(m[1])) record(c, rel, line);
  }
}

function classTokensIn(expr, out = []) {
  for (const lit of expr.matchAll(/(['"`])((?:(?!\1).)*)\1/g)) {
    let body = lit[2];
    if (lit[1] === '`') {
      body = body.replace(/\$\{([^}]*)\}/g, (_, inner) => {
        classTokensIn(inner, out);
        return ' ';
      });
    }
    for (const c of body.split(/\s+/)) if (c) out.push(c);
  }
  return out;
}

// Ternary branch literals like `e.action === 'granted' ? 'badge' : …` leak
// comparison operands ('granted') into the scan. Filter: a class is only
// reported if NONE of its occurrences is a comparison operand — cheap
// heuristic: the literal is immediately preceded by `=== ` or `== `.
function isComparisonOperand(cls) {
  for (const loc of used.get(cls)) {
    const [rel, line] = loc.split(':');
    const text = readFileSync(join(HERE, '..', rel), 'utf8').split('\n')[Number(line) - 1] ?? '';
    if (!new RegExp(`===?\\s*['"\`]${cls}['"\`]`).test(text)) return false;
  }
  return true;
}

const unknown = [...used.keys()]
  .filter((c) => !defined.has(c) && !ALLOWLIST.has(c) && !isComparisonOperand(c))
  .sort();

console.log(`audit-classes: ${defined.size} classes defined, ${used.size} referenced, ${unknown.length} unknown`);
if (unknown.length) {
  for (const c of unknown) console.log(`  .${c.padEnd(24)} ${[...used.get(c)].slice(0, 3).join(', ')}`);
  console.log('\nEach class above is referenced by markup but defined in no stylesheet.');
  console.log('Port the rule into packages/ui/src/globals.css, or add it to ALLOWLIST with a reason.');
  process.exit(1);
}
