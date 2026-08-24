/**
 * SPEC 4 — Admin CMS (login with MFA, content CRUD).
 *
 * Uses the test-clinician seeded in global-setup.ts with TOTP secret
 * JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP (32 base32 chars / 20 bytes — otplib v13's
 * default guardrails reject secrets under 16 bytes, so the classic 10-byte
 * "JBSWY3DPEHPK3PXP" example secret no longer works; doubled to clear the
 * minimum while keeping a recognisable/memorable literal).
 */
import { test, expect } from '@playwright/test';
import { adminLogin } from './helpers/auth';

test('A1: admin login page renders', async ({ page }) => {
  await page.goto('/admin/login');
  await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('A2: invalid password shows error', async ({ page }) => {
  await page.goto('/admin/login');
  await page.fill('input[type="email"]', 'nobody@example.com');
  await page.fill('input[type="password"]', 'wrongpass');
  // The TOTP field is `required` in the DOM from the start (single-form UI —
  // see helpers/auth.ts), so it must be filled or the browser blocks
  // submission via native HTML5 validation and handleSubmit() never runs.
  // Any value works: the password step rejects the request before MFA is checked.
  await page.fill('input[inputmode="numeric"]', '000000');
  await page.click('button[type="submit"]');
  // `text=` is its own selector engine and can't be comma-combined with a
  // plain CSS selector in one locator string (Playwright parses the whole
  // thing as CSS once the string starts with `[role="alert"]`, and chokes on
  // the embedded `text=`). getByRole covers the app's actual markup
  // (`role="alert"` on the error banner) without needing to match its exact
  // (untranslated) message text.
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
});

test('A3: valid login + TOTP → reaches admin dashboard', async ({ page }) => {
  await adminLogin(page);
  // A leading `text=` makes Playwright treat the WHOLE comma-joined string as
  // one literal text search (not per-clause "OR" alternation) — the original
  // 4-way locator matched zero elements even though "Oddelenia" alone does
  // (verified empirically). The real admin shell sidebar is an `<aside>`
  // (apps/web/src/components/admin/AdminSidebar.tsx), not `nav`/`[data-sidebar]`.
  await expect(page.locator('aside')).toBeVisible({ timeout: 8_000 });
});

test('A4: admin sidebar shows all collections', async ({ page }) => {
  await adminLogin(page);
  // Real sidebar labels are Slovak-only (admin-schemas.ts: departments.label.sk
  // = 'Oddelenia', clinics.label.sk = 'Ambulancie' — AdminSidebar always
  // renders `schema.label.sk`, regardless of the Playwright project's browser
  // locale). Same leading-`text=` comma bug as A3 meant the original locator
  // never matched anything, in any of the sk/en/mobile projects.
  const sidebar = page.locator('aside');
  await expect(sidebar.getByText('Oddelenia').first()).toBeVisible();
  await expect(sidebar.getByText('Ambulancie').first()).toBeVisible();
});

test('A5: admin list view renders rows for departments', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/departments');
  // apps/web/src/app/admin/[collection]/page.tsx renders plain `<div>` rows
  // (flex layout via inline styles), never a `<table>`/`<tr>` or `[data-row]`
  // attribute — those never existed on this page. Each row's edit link has a
  // stable, real aria-label ("Upraviť <title>"); use that as the row anchor.
  await expect(page.locator('a[aria-label^="Upraviť"]').first()).toBeVisible({ timeout: 8_000 });
});

test('A6: GDPR admin page is accessible and renders Art. 15/17 forms', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/gdpr');
  // apps/web/src/app/admin/gdpr/page.tsx renders "Art. 15"/"Art. 17" literally
  // (no "Čl." Slovak variant), and is wired to the newer patient-token GDPR
  // flow (/api/gdpr/patient/export|erasure) — there is no rodné číslo (RC)
  // field or `input[type=password]` on this page; the sensitive-field
  // equivalent is the "Patient token" input (aria-label="Patient token").
  // Plain getByText('GDPR') is a strict-mode violation: it also matches the
  // AdminSidebar nav link "GDPR — DSAR / Výmaz", present on every admin page
  // (not specific to this one) — scope to the page's own heading instead.
  await expect(page.getByRole('heading', { name: /GDPR/ })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Art. 15')).toBeVisible();
  await expect(page.getByText('Art. 17')).toBeVisible();
  await expect(page.locator('[aria-label="Patient token"]')).toBeVisible();
});

test('A7: DSAR export button is disabled without RC entered', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/gdpr');
  // The page has THREE buttons containing "export"/"Export" case-insensitively
  // — the "Export (Art. 15)" mode toggle, the "Vymazanie (Art. 17)" toggle
  // (does not match), and the actual submit button ("Vytvoriť export" in the
  // default 'export' mode) — `:has-text("Export")` matched 2 of them, which
  // Playwright's strict mode rejects. Only the submit button's `disabled`
  // reflects form completeness (patientToken + requestRef); target it by its
  // exact accessible name instead.
  const exportBtn = page.getByRole('button', { name: 'Vytvoriť export', exact: true });
  await expect(exportBtn).toBeDisabled();
});

test('A8: unauthenticated admin route redirects to login', async ({ page }) => {
  await page.goto('/admin/departments');
  await page.waitForURL(/admin\/login/, { timeout: 5_000 });
  await expect(page.locator('input[type="email"]')).toBeVisible();
});
