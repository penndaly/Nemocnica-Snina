# Sprint TS-M1-RELAND — Re-land the node16 migration on its own branch
## Nemocnica Snina · Platform / Infra · **URGENT — single copy at risk**

**Branch (new):** `feature/ts-node16-migration` off `main`
**Source of the work:** commits `d749ffe` + `acd31d8`, currently living **only** in local branch `backup-a4-orig`
**Estimated scope:** ~20 minutes — cherry-pick 2 commits, verify, push, PR
**Risk:** Low (the work was already verified clean once) — but the commits exist in exactly one place, so **lock the backup first**.

---

## Why this exists (read before touching anything)

The TS-M1 node16 migration (`moduleResolution: node10 → node16` + `esModuleInterop` + supertest import rewrites + rootDir/baseUrl TS-7 deprecation cleanup) was originally committed on the A4 branch. When that branch was rebased clean for the A4 PR, the two tsconfig commits were intentionally dropped — correct for the A4 PR, but it left the migration **homeless**:

- The migration was **never on `main`** (main is only the wl9 ff-merge).
- The dropped commits now survive in **exactly one place**: the local branch `backup-a4-orig` (at the old `acd31d8`).

If `backup-a4-orig` is deleted or garbage-collected before this re-land, the migration is gone and the TS 7 `moduleResolution` deprecation deadline silently returns. **Step 0 is to make that branch un-loseable.**

The two commits:
| Commit | What it does |
|---|---|
| `d749ffe` | node10 → node16, `esModuleInterop: true`, rewrite 2 supertest namespace imports (`import * as request` → `import request`) |
| `acd31d8` | Add `rootDir: "./src"` (apps/api) + `rootDir: "src"` (packages/types); drop deprecated `baseUrl` + unused `@/*` path alias — clears all 3 TS 7 PROBLEMS-panel deprecations |

---

## Paste this into Claude Code

```
This is a recovery + re-land task. The work already exists and was verified clean in a
prior session — your job is to move it to its proper home WITHOUT losing it. Go carefully
and in order; do not delete anything until the final step explicitly says so.

STEP 0 — Lock the backup before doing anything else.
  git tag -a ts-m1-backup acd31d8 -m "TS-M1 migration safety copy — do not delete"
  git config branch.backup-a4-orig.description "PROTECTED: only copy of TS-M1 migration until feature/ts-node16-migration merges. Do not delete."
  Confirm the tag exists:  git tag -l ts-m1-backup   (must print the tag)
  Confirm both commits are reachable:  git branch --contains d749ffe ; git branch --contains acd31d8
  Report what you found before continuing. If either commit is NOT reachable from
  backup-a4-orig or the new tag, STOP and report — do not proceed.

STEP 1 — Create the migration branch off the current main.
  git fetch origin
  git checkout -b feature/ts-node16-migration origin/main

STEP 2 — Cherry-pick the two commits in order.
  git cherry-pick d749ffe acd31d8
  If a conflict surfaces in tsconfig.json (main may differ from the original base):
    - resolve so the FINAL state has, in apps/api/tsconfig.json:
        module: "node16", moduleResolution: "node16", esModuleInterop: true,
        rootDir: "./src", and NO baseUrl / NO "@/*" paths entry
    - keep exactOptionalPropertyTypes: false and noEmitOnError: false (CLAUDE.md fixes)
    - in packages/types/tsconfig.json: rootDir: "src"
    - git add the file, git cherry-pick --continue

STEP 3 — Verify (all must pass):
  cd apps/api && tsc --noEmit          → exit 0, no errors, NO deprecation warning
  cd apps/api && pnpm test             → infra-gated set unchanged, zero NEW failures
  nest build                            → exit 0
  cd packages/types && tsc --noEmit    → exit 0
  Confirm apps/web tsconfig is untouched.

STEP 4 — Push and open the PR.
  git push -u origin feature/ts-node16-migration
  PR title:  chore(tsconfig): migrate moduleResolution node10 → node16 (TS 7 deadline)
  PR body:   summarize the two commits; note this clears the TS 7 deprecation deadline
             and the 3 PROBLEMS-panel entries; link this sprint doc.

STEP 5 — DO NOT delete backup-a4-orig or the ts-m1-backup tag yet.
  Report that the PR is open. The human deletes the backup only AFTER the PR merges to main.

Report after each step. Stop on any unexpected state.
```

---

## Why a separate branch (not back onto A4)

- A4's PR is a clean 3-commit feature branch under review — re-adding tsconfig commits muddies that diff again.
- The migration is infra, not feature work; it deserves its own small, fast-to-review PR.
- Cherry-pick onto fresh `main` guarantees the migration sits on top of the validated wl9 merge with no A4 entanglement — if A4 needs changes in review, the migration is unaffected, and vice versa.

---

## On the recurring tsconfig "flapping"

An external process (the parallel instance / an IDE save-hook) kept re-applying the node16/rootDir edits to the working tree, because the **committed** tsconfig on main still has the old deprecated config — so the tooling sees the deprecations and "helpfully" re-fixes them. **Once this PR merges to main, the deprecations are gone and nothing has a reason to re-add them.** That stops the flapping at its source. No separate fix needed — landing this sprint *is* the fix.

---

## Done when

- [ ] `ts-m1-backup` tag created at `acd31d8`; `backup-a4-orig` has a PROTECTED description
- [ ] Both commits confirmed reachable before any branch work
- [ ] `feature/ts-node16-migration` created off `origin/main`, both commits cherry-picked
- [ ] `tsc --noEmit` clean (apps/api + packages/types), no deprecation warning
- [ ] `pnpm test` — zero new failures vs baseline; `nest build` clean; apps/web untouched
- [ ] Branch pushed; PR open with the two-commit summary
- [ ] `backup-a4-orig` + `ts-m1-backup` tag **retained** (deleted by human only post-merge)
