# Sprint TS-M1 — TypeScript module system migration: node10 → node16
## Nemocnica Snina · Platform / Infra

**Branch:** `feature/ts-node16-migration` (off main, after feature/wearables-wl9 merges)
**Estimated scope:** 1 focused session — ~21 import-site rewrites + tsconfig change + test run
**Risk:** Medium (touches every test file that uses `import * as`; verified by full test suite)

---

## Why this exists

`apps/api/tsconfig.json` currently uses `moduleResolution: "node10"` (also known as `"node"`).
TypeScript 5.9.3 emits a forward-looking deprecation notice:

```
Option 'moduleResolution: node10' will stop functioning in TypeScript 7.0.
Migrate to 'moduleResolution: node16' or 'bundler'.
```

This is not a build error on TS 5.x — it is a warning with a hard deadline. If ignored, the
next major TS upgrade breaks the build with no obvious cause.

### Why a simple tsconfig tweak cannot fix this

| Attempted fix | Result |
|---|---|
| `"ignoreDeprecations": "6.0"` | TS 5.9.3 rejects it — error TS5103: Invalid value. Breaks nest build and pnpm typecheck. |
| `"ignoreDeprecations": "5.0"` | Accepted by TS 5.9.3 compiler but rejected by the editor's TS 7 language service. No single value satisfies both. |
| `moduleResolution: "bundler"` | Requires `module: "esnext"` or similar — incompatible with NestJS CommonJS output. |
| `module: "node16"` + `moduleResolution: "node16"` (tested) | Introduces 21 errors — CJS default-import semantics break for `import * as X` sites. |

### The correct fix

The 21 errors from the `node16` test are a symptom, not a blocker. They arise because
`node16` enforces ESM semantics: a `import * as X from 'Y'` where `Y` is a CJS module with
a `module.exports = fn` shape now requires `import X from 'Y'` (a synthetic default import).
With `esModuleInterop: true` in place, the compiler can provide that synthetic default and the
call sites become straightforward rewrites.

**Target tsconfig:**
```json
{
  "compilerOptions": {
    "module": "node16",
    "moduleResolution": "node16",
    "esModuleInterop": true
  }
}
```

`nest build` emits CommonJS via ts-jest / tsc regardless of the `module` setting here —
NestJS does not require `module: "CommonJS"` explicitly; it requires CommonJS *output*, which
`node16` + ts-jest still produces.

---

## Paste this into Claude Code before starting

```
Read the following files in full before writing any code:

1. apps/api/tsconfig.json — current compilerOptions; note exactOptionalPropertyTypes, noEmitOnError
2. apps/api/jest.config.js (or jest.config.ts) — ts-jest transform settings; note moduleNameMapper
3. Run: cd apps/api && tsc --noEmit 2>&1 | head -80
   Capture the exact list of errors produced by adding module:node16+moduleResolution:node16
   to the current tsconfig (do this before any code changes — this is your task list).
4. Run: cd apps/api && grep -rn "import \* as" src/ --include="*.ts" | sort
   This is every candidate import site.

Then:
A. Add module: "node16", moduleResolution: "node16", esModuleInterop: true to tsconfig.json.
B. Re-run tsc --noEmit — work through every error exactly as reported. Do not guess.
C. For each import site that errors, apply the appropriate rewrite (see patterns below).
D. After all errors clear: pnpm test (expect 308 passed, 4 infra-gated unchanged).
E. nest build — must be clean.
F. git commit -m "chore(tsconfig): migrate moduleResolution node10 → node16; esModuleInterop; fix 21 import sites"

Stop after F. Do not refactor unrelated code. Do not change any test logic.
```

---

## Expected import-site rewrites

### Pattern 1 — CJS module with a callable/constructable default export

```typescript
// Before (node10 — namespace import):
import * as supertest from 'supertest';
// Used as: supertest(app.getHttpServer())

// After (node16 + esModuleInterop — synthetic default):
import supertest from 'supertest';
// Usage unchanged: supertest(app.getHttpServer())
```

Applies to: `supertest` (all `.test.ts` e2e/integration files)

### Pattern 2 — Module with named exports only (no change needed)

```typescript
// These are fine as-is under node16 — namespace import of a module
// that only has named exports is valid ESM:
import * as bcrypt from 'bcrypt';      // if bcrypt has named exports — check tsc output
import * as crypto from 'crypto';      // Node built-in, always fine
```

Only rewrite if tsc reports an error on the specific line. Do not preemptively rewrite.

### Pattern 3 — otplib (already patched in auth.service.ts)

```typescript
// Current state (from CLAUDE.md local fix):
import * as otplib from 'otplib';
// Used as: (otplib as any).authenticator.verify(...)

// Under node16 + esModuleInterop, otplib ships a CJS wrapper with a
// default export. If tsc errors on this line, rewrite to:
import otplib from 'otplib';
// Usage: otplib.authenticator.verify(token, secret)  ← can drop the `as any`
```

Dropping `as any` is a bonus cleanup if the type signature is now correct —
only do it if types resolve cleanly (tsc will tell you).

### Pattern 4 — Type-only namespace imports

```typescript
// If a namespace import is used only for types:
import * as Supertest from 'supertest';
// type Response = Supertest.Response

// Rewrite to:
import type { Response } from 'supertest';
// or keep namespace import with `import type * as Supertest`
```

---

## tsconfig changes in full

```json
// apps/api/tsconfig.json  — change only these keys:
{
  "compilerOptions": {
    "module": "node16",              // was: "CommonJS" (implicit via absence or explicit)
    "moduleResolution": "node16",   // was: "node10" or "node"
    "esModuleInterop": true,        // add — required for synthetic default imports from CJS
    // Keep everything else unchanged:
    "exactOptionalPropertyTypes": false,   // from CLAUDE.md local fix — keep
    "noEmitOnError": false,                // from CLAUDE.md local fix — keep
    "strict": true,
    "target": "ES2021"
    // etc.
  }
}
```

If `esModuleInterop` was already present and `true`, no change needed for that line.

---

## apps/web tsconfig — no change

The web tier (`apps/web`) runs under Next.js which manages its own tsconfig and already uses
`moduleResolution: "bundler"`. Do not touch it. This sprint is `apps/api` only.

---

## ts-jest compatibility note

`ts-jest` (the transformer used in `apps/api/jest.config.*`) supports `module: "node16"` from
v29.1+. Verify the installed version:

```bash
cat apps/api/node_modules/ts-jest/package.json | grep '"version"'
```

If it is < 29.1, update before making the tsconfig change:

```bash
cd apps/api && pnpm add -D ts-jest@^29.2
```

If ≥ 29.1, no action needed — tests will pass as-is.

---

## Non-negotiables

- `tsc --noEmit` must be clean (zero errors) after the change.
- `pnpm test` must report 308 passed; the 4 infra-gated suites must remain the only failures.
- `nest build` must be clean.
- No test logic, business logic, or imports outside the erroring sites may be changed.
- Do not add `// @ts-ignore` or `as any` to silence errors — fix the import site properly.
- If any error cannot be resolved with an import rewrite (e.g. a genuine type incompatibility
  surfaced by stricter resolution), stop and report it before proceeding.

---

## Done when

- [ ] `apps/api/tsconfig.json` uses `module: "node16"`, `moduleResolution: "node16"`, `esModuleInterop: true`
- [ ] `cd apps/api && tsc --noEmit` exits 0 with no errors and no deprecation warnings
- [ ] `cd apps/api && pnpm test` — 308 passed; 4 infra-gated suites unchanged
- [ ] `nest build` exits 0
- [ ] `apps/web` tsconfig untouched; `cd apps/web && pnpm typecheck` baseline unchanged (same pre-existing noise)
- [ ] Single commit: `chore(tsconfig): migrate moduleResolution node10 → node16; esModuleInterop; fix N import sites`
- [ ] Commit message lists which files were changed (e.g. "auth.service.ts: otplib → default import; *.test.ts: supertest → default import")
