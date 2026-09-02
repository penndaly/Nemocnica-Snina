# Sprint CI-LINT-1 — Author a flat ESLint config for the monorepo
## Nemocnica Snina · Platform / Infra · CI

**Branch (new):** `feature/ci-eslint-flat-config` off `main`
**Estimated scope:** 1 focused session
**Risk:** Medium — first lint run will surface real violations across the codebase; the sprint's job is to land a config that passes, not to mass-rewrite source under time pressure.
**Prereq:** none code-wise, but **get the team's lint-strictness intent first** (see "Decide before starting"). Lane confirmed: **A (recommended baseline)**.
**Contains a prerequisite fix:** Step 0 commits the gitignored `pnpm-lock.yaml` — without it, the new eslint deps can't install under CI's `--frozen-lockfile` and every job stays broken.

---

## Why this exists

The CI **Lint** job has never passed. The repo has **no ESLint config at all** — no `eslint.config.js`, no `.eslintrc*` anywhere in the workspace. Under ESLint 9, `eslint .` errors immediately with "couldn't find eslint.config file" on every package. This predates all wearables/admin work.

The pnpm-setup fix (reading the version from `package.json`) unblocked the **Typecheck** (4/4 green) and **Test** jobs. Lint is the last red job — currently made **non-blocking** (`continue-on-error: true`) as a deliberate stopgap. This sprint replaces the stopgap with a real config.

This was **not** done unprompted because authoring a lint config is opinionated — it encodes rules that change how every contributor writes code. That's a team decision, not an agent default.

---

## Decide before starting (human input required)

The sprint needs one decision up front — **how strict?** Pick the lane:

| Lane | What it means | Good when |
|---|---|---|
| **A — Recommended baseline** | `@eslint/js` recommended + `typescript-eslint` recommended (non-type-checked) + react-hooks + a small set of repo conventions. Warnings for style, errors for real bugs. | Default choice — catches real problems without drowning the team in churn. |
| **B — Strict** | Lane A + `typescript-eslint` **type-checked** rules (needs `parserOptions.project`), import-order enforcement, no-floating-promises as error. | Team wants the linter to be a quality gate, accepts a larger initial cleanup. |
| **C — Minimal** | `@eslint/js` recommended only, TS plugin parsing but few rules. Just enough to make the job pass and catch syntax-level issues. | Team wants CI green now, will tighten later. |

Default to **Lane A** if no answer. The rest of this doc assumes A and notes where B/C differ.

---

## Step 0 — Commit the lockfile (prerequisite — do this FIRST)

CI runs `pnpm install --frozen-lockfile`, which requires a committed `pnpm-lock.yaml` that
exactly matches the dependency tree. But `pnpm-lock.yaml` is currently **gitignored** — so CI
install fails at the setup step for **every** job, and the new eslint deps this sprint adds
would never be reproducibly installable. This must be fixed before the eslint config lands,
and the lockfile commit must already contain the new eslint deps.

**Order matters:** un-ignore → install (adding the eslint deps) → commit the lockfile with the
`.gitignore` change together. Do NOT commit the lockfile first and add deps later — that
re-staleness would break `--frozen-lockfile` again.

```
Step 0 — lockfile (run before the eslint config work below):

0a. Remove the pnpm-lock.yaml line from .gitignore (check root .gitignore; there may also be
    per-package .gitignore entries — remove all of them). Confirm: git check-ignore pnpm-lock.yaml
    must print NOTHING after the edit.
0b. Install the new eslint deps at the workspace root WITH pnpm so the lockfile regenerates
    to include them (this is the same dep set as step B below — do it now so it lands in the
    committed lockfile):
      pnpm add -Dw typescript-eslint eslint-plugin-react-hooks @next/eslint-plugin-next globals
    (-w targets the workspace root. Use pnpm, never npm/yarn.)
0c. Sanity-check the lockfile is now tracked and complete:
      git status --short pnpm-lock.yaml     → should show it staged/modified, not ignored
      pnpm install --frozen-lockfile         → must exit 0 (proves the lockfile matches)
0d. Commit the lockfile + .gitignore change as its OWN commit, separate from the eslint config:
      git add .gitignore pnpm-lock.yaml package.json
      git commit -m "chore(ci): commit pnpm-lock.yaml; enable frozen-lockfile installs"

Do NOT change ci.yml's install steps to --no-frozen-lockfile. Frozen is correct and required
(reproducible installs — CLAUDE.md / Decree 179/2020 audit posture). The fix is committing the
lockfile, not loosening CI.

Report the lockfile size and that --frozen-lockfile passed, then continue to the eslint work.
```

If `pnpm add -Dw` in 0b reports the deps are already present (a prior partial run), just run
`pnpm install` to refresh the lockfile and continue — the goal is a committed lockfile that
includes them.

---

## Paste this into Claude Code (eslint config — runs AFTER Step 0)

```
Author a flat ESLint 9 config (eslint.config.js / eslint.config.mjs) for this pnpm monorepo.
Target lint lane: A (recommended baseline) — confirmed.
PREREQUISITE: Step 0 (commit pnpm-lock.yaml) must already be done on this branch.

Read first:
1. The repo root package.json + each package's package.json — find the eslint version,
   any lint scripts, and what plugins are already installed (devDependencies).
2. turbo.json (or the CI workflow) — how the lint task is invoked across packages.
3. apps/web — it's Next.js; it has its own lint expectations (next/core-web-vitals).
4. packages/ui, packages/types, apps/api — note each is TS; apps/web is TS + React.
5. .github/workflows/ci.yml — the Lint job; note it's currently continue-on-error.

Then:
A. Add a single flat config at the repo root: eslint.config.mjs (ESM flat config).
   - Use @eslint/js recommended as the base.
   - Use typescript-eslint (the unified package) recommended config for **/*.ts, **/*.tsx.
   - For apps/web: add eslint-plugin-react-hooks + the Next.js flat preset
     (eslint-config-next / @next/eslint-plugin-next) scoped to apps/web/**.
   - Add an ignores block: dist, .next, node_modules, build, coverage, *.config.js,
     prisma/migrations, and any generated files.
   - Scope type-checked rules OFF in Lane A (do NOT set parserOptions.project — keeps it fast
     and avoids the project-service overhead). Lane B would turn these on.
B. The plugins (typescript-eslint, eslint-plugin-react-hooks, @next/eslint-plugin-next,
   globals) were already installed in Step 0b and are in the committed lockfile. If any are
   still missing, add with pnpm at the workspace root (-Dw). Use pnpm, never npm/yarn.
C. Run: pnpm eslint . 2>&1 | tee /tmp/lint.txt ; tail -40 /tmp/lint.txt
   Report the violation count by rule. DO NOT mass-autofix blindly.
D. Triage the violations:
   - Apply eslint --fix ONLY for trivially safe, mechanical rules (quotes, semi, import order,
     no-extra-semi, prefer-const). Run tests after.
   - For anything that changes behavior or is noisy (no-explicit-any, no-unused-vars on
     intentional cases), DOWNGRADE the rule to "warn" in the config rather than rewriting
     source en masse. Note each downgrade with a comment + a // TODO to revisit.
   - The goal: pnpm eslint . exits 0 (errors = 0; warnings allowed).
E. Re-enable the CI Lint job: remove continue-on-error: true from the Lint job in ci.yml.
F. Verify the full CI lane locally as far as possible: turbo run lint = pass; turbo run
   typecheck still 4/4; pnpm test unchanged.
G. Commit: chore(ci): add flat ESLint 9 config; re-enable Lint job

Stop after G. Report the rule downgrades you made so the team can decide whether to
promote any back to "error" later. Do not change source logic to satisfy a rule —
downgrade the rule and flag it instead.
```

---

## Guardrails

- **Use `pnpm`** for every install — never `npm install` or `yarn` (CLAUDE.md non-negotiable).
- **Don't rewrite source to please the linter.** If a rule is noisy, downgrade it to `warn` with a TODO. A config that passes by relaxing rules is fine and reversible; a config that passes by churning 200 files is risky and hard to review.
- **`eslint --fix` only on mechanical rules**, and run `pnpm test` immediately after — autofix can rarely change semantics (e.g. `prefer-const` on a reassigned-via-closure var).
- **apps/web is special** — Next.js has its own lint preset; scope it to `apps/web/**` so its rules don't leak into apps/api or packages.
- **Don't touch tsconfig** — that's the separate TS-M1 sprint. Lint config only.
- **Keep type-checked rules off (Lane A).** They require `parserOptions.project` wiring across every package and slow CI substantially — only turn on if the team picks Lane B.

---

## Done when

- [ ] **Step 0:** `pnpm-lock.yaml` un-ignored (`git check-ignore` prints nothing) and committed with the eslint deps; `pnpm install --frozen-lockfile` exits 0; committed as its own commit
- [ ] Lane confirmed with the team — **A (confirmed)**
- [ ] Single root `eslint.config.mjs` (flat config) covers api, web, ui, types with correct per-package scoping
- [ ] Missing plugins installed via pnpm at the workspace root
- [ ] `pnpm eslint .` exits 0 (zero errors; warnings permitted and listed)
- [ ] Any rule downgrades documented in-config with TODO + reported to the team
- [ ] `continue-on-error: true` removed from the CI Lint job
- [ ] `turbo run lint` passes; `turbo run typecheck` still 4/4; `pnpm test` unchanged
- [ ] Single commit: `chore(ci): add flat ESLint 9 config; re-enable Lint job`
