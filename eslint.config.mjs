// Flat ESLint 9 config for the Nemocnica Snina monorepo (Sprint CI-LINT-1).
// Lane A — recommended baseline: @eslint/js + typescript-eslint (non-type-checked)
// + react-hooks/Next for the web app. Errors for real bugs; pervasive-but-harmless
// patterns are downgraded to "warn" (CI passes on zero errors; warnings allowed).
//
// Type-checked rules are intentionally OFF (no parserOptions.project) — that's Lane B.
// Do NOT add tsconfig wiring here; the tsconfig migration is a separate sprint.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';

export default tseslint.config(
  // ── Global ignores ──────────────────────────────────────────────────────────
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/*.config.js',
      '**/*.config.cjs',
      '**/*.config.mjs',
      '**/next-env.d.ts',
      'apps/api/prisma/migrations/**',
      // Strapi app: CommonJS framework scaffolding with its own conventions —
      // not part of the api/web/ui/types lint scope (no lint script of its own).
      'apps/cms/**',
      // Design-handoff prototype: static HTML pages with cross-<script> browser
      // globals (DB, L, icon…). Not built/bundled — the design source of truth.
      'design_handoff_nemocnica_snina/**',
    ],
  },

  // ── Base (all JS/TS) ────────────────────────────────────────────────────────
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ── Repo conventions + runtime globals ──────────────────────────────────────
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // Lane A downgrades — pervasive in this codebase and not bugs. Kept as
      // "warn" so they surface without failing CI.
      // TODO(CI-LINT-2): the team may promote any of these back to "error".
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // CommonJS interop in a few TS files (lazy require to avoid cycles). Not a bug.
      '@typescript-eslint/no-require-imports': 'warn',
      // Code smell, not a correctness bug — kept visible without failing CI.
      'no-useless-assignment': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // ── Test + e2e files — jest/playwright globals, relaxed typing ───────────────
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}', '**/e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // ── Next.js web app — React hooks + Next rules, scoped to apps/web ───────────
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    rules: {
      // Classic react-hooks baseline. react-hooks v7 ships much stricter
      // React-Compiler diagnostics in recommended-latest (cascading-render,
      // create-component-in-render, …); enabling those is a separate decision —
      // TODO(CI-LINT-2): consider opting in once the team is ready.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // App Router project (app/, no pages/) — this rule scans for a pages dir and
      // emits a spurious console warning; not applicable here.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
);
