/**
 * SPEC 4 — Admin CMS (login with MFA, content CRUD).
 *
 * Uses the test-clinician seeded in global-setup.ts with TOTP secret JBSWY3DPEHPK3PXP.
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
  await page.click('button[type="submit"]');
  await expect(page.locator('[role="alert"], .error, text=Neplatné')).toBeVisible({ timeout: 5_000 });
});

test('A3: valid login + TOTP → reaches admin dashboard', async ({ page }) => {
  await adminLogin(page);
  await expect(page.locator('text=Departments, text=Oddelenia, text=Clinics, nav, [data-sidebar]')).toBeVisible({ timeout: 8_000 });
});

test('A4: admin sidebar shows all collections', async ({ page }) => {
  await adminLogin(page);
  const sidebar = page.locator('[data-sidebar], nav, aside');
  await expect(sidebar.locator('text=departments, text=Oddelenia, text=Departments').first()).toBeVisible();
  await expect(sidebar.locator('text=clinics, text=Ambulancie, text=Clinics').first()).toBeVisible();
});

test('A5: admin list view renders rows for departments', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/departments');
  await expect(page.locator('table tr, [data-row]').first()).toBeVisible({ timeout: 8_000 });
});

test('A6: GDPR admin page is accessible and renders Art. 15/17 forms', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/gdpr');
  await expect(page.locator('text=GDPR, text=Čl. 15, text=Art. 15')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('text=Čl. 17, text=Art. 17, text=erasure')).toBeVisible();
  await expect(page.locator('[aria-label*="Rodné číslo"], input[type="password"]')).toBeVisible();
});

test('A7: DSAR export button is disabled without RC entered', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin/gdpr');
  const exportBtn = page.locator('button:has-text("Export"), button:has-text("Exportovať")');
  await expect(exportBtn).toBeDisabled();
});

test('A8: unauthenticated admin route redirects to login', async ({ page }) => {
  await page.goto('/admin/departments');
  await page.waitForURL(/admin\/login/, { timeout: 5_000 });
  await expect(page.locator('input[type="email"]')).toBeVisible();
});
