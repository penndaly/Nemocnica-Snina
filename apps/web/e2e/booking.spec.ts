/**
 * SPEC 1 — Booking wizard (happy path + rule rejections).
 *
 * The API server's clock is NOT mocked (global-setup.ts's TEST_NOW is never wired
 * into the NestJS process) — weekday/date fixtures come from helpers/booking.ts's
 * MONDAY/TUESDAY/WEDNESDAY/THURSDAY, computed relative to the real current date so
 * they never drift into the past. See the comment at the top of helpers/booking.ts.
 * All rule rejections must come from the SERVER (HTTP 400), not client-side UX.
 */
import { test, expect } from '@playwright/test';
import { VALID_RC, CLINIC_TRAUMA, CLINIC_ANGIOLOGY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, pastDate, projectSlotIndex } from './helpers/booking';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:3001';

// ── Happy path ─────────────────────────────────────────────

test('HP1: full booking wizard — urology Mon-Fri, confirms with booking ID', async ({ page }, testInfo) => {
  await page.goto('/sk/objednanie');

  // Step 1: select clinic
  await page.locator('[data-clinic-id="urologicka"], button:has-text("Urol")').first().click();

  // Step 2: select date (first available)
  await page.locator('[data-step="2"] button[data-date], .date-button').first().click();

  // Step 3: select time — project-indexed (see projectSlotIndex) so sk/en/mobile
  // each book a distinct seeded slot instead of racing the same one.
  await page.locator('[data-step="3"] button[data-time], .time-slot').nth(projectSlotIndex(testInfo)).click();

  // Step 4: fill details
  await page.fill('[name="patientName"], input[placeholder*="Meno"]', 'Test Pacient');
  await page.fill('[name="patientPhone"], input[type="tel"], input[placeholder*="Telefón"]', '+421900000000');
  await page.fill('[name="patientRc"], input[placeholder*="Rodné"]', VALID_RC);
  await page.locator('[name="gdprConsent"]').check();
  // Urology requires a referral (referral: true in seed-clinics.ts) — server rejects without it
  await page.locator('[name="referralConsent"]').check();

  // Step 4 -> Step 5: submit details (advances to the review screen, does
  // not book anything yet).
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-step="5"]', { timeout: 8_000 });

  // Step 5: confirm. This is a second, distinct click — the review screen's
  // "Potvrdiť objednávku" button (data-action="confirm") is what actually
  // POSTs /api/booking; the step-4 submit above only gets you to this
  // screen. Missing this click was the real bug — the test previously
  // clicked once, so it waited forever on a confirmation that no click had
  // ever asked for.
  await page.click('[data-action="confirm"]');

  // Confirmation card
  // NOTE: `text=A, text=B` is NOT a selector union — Playwright's text engine treats an
  // unquoted comma as part of the search string itself, so that locator matches nothing.
  // getByText() with a regex alternation is the correct way to OR two text matches.
  await expect(page.getByText(/Objednávka potvrdená|Booking confirmed/).first()).toBeVisible({ timeout: 15_000 });
});

test('HP2: deep-link ?clinic=urazova-chirurgia skips to step 2', async ({ page }) => {
  await page.goto('/sk/objednanie?clinic=urazova-chirurgia');
  // Should show date picker (step 2)
  await expect(page.locator('[data-step="2"], h2:has-text("Dátum")')).toBeVisible({ timeout: 5_000 });
});

// ── Server-side rule rejections (must return HTTP 400) ─────

async function postBooking(body: Record<string, unknown>) {
  const r = await fetch(`${API}/api/booking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() as { message?: string } };
}

const BASE = {
  patientName: 'API Test',
  patientPhone: '+421900000000',
  patientRc: VALID_RC,
  gdprConsent: true,
  referralConsent: false,
  hasReferral: false,
};

test('R1: angiology on Wednesday (not in bookingDays=[4,5]) → 400', async () => {
  // angiologicka requires a referral (referral: true in seed-clinics.ts) — must grant
  // referralConsent here so the referral gate doesn't mask the weekday rule under test.
  const { status, body } = await postBooking({ ...BASE, referralConsent: true, clinicId: CLINIC_ANGIOLOGY, date: WEDNESDAY, time: '13:20' });
  expect(status).toBe(400);
  expect(body.message).toMatch(/weekday|day|bookingDays/i);
});

test('R2: angiology on Thursday 09:00 (outside 13:00–14:00 window) → 400', async () => {
  // Same referral gate as R1 — grant consent so the window rule fires instead.
  const { status, body } = await postBooking({ ...BASE, referralConsent: true, clinicId: CLINIC_ANGIOLOGY, date: THURSDAY, time: '09:00' });
  expect(status).toBe(400);
  expect(body.message).toMatch(/window|13:00|bookingWindow/i);
});

test('R3: angiology Thu 13:20 without referral consent → 400', async () => {
  const { status, body } = await postBooking({ ...BASE, clinicId: CLINIC_ANGIOLOGY, date: THURSDAY, time: '13:20', referralConsent: false });
  expect(status).toBe(400);
  expect(body.message).toMatch(/referral/i);
});

test('R4: closed clinic (diabetologicka) → 400', async () => {
  // diabetologicka also requires a referral (referral: true in seed-clinics.ts) — the
  // referral gate runs before the bookable/closed check, so it must be granted here too.
  const { status, body } = await postBooking({ ...BASE, referralConsent: true, clinicId: 'diabetologicka', date: TUESDAY, time: '09:00' });
  expect(status).toBe(400);
  expect(body.message).toMatch(/bookable|closed|not bookable/i);
});

test('R5: trauma surgery on Monday (bookingDays=[2,4]) → 400', async () => {
  const { status, body } = await postBooking({ ...BASE, clinicId: CLINIC_TRAUMA, date: MONDAY, time: '09:00' });
  expect(status).toBe(400);
  expect(body.message).toMatch(/weekday|day/i);
});

test('R6: trauma surgery on Tuesday → rules pass → slot check (400 slot or 201)', async () => {
  const { status, body } = await postBooking({ ...BASE, clinicId: CLINIC_TRAUMA, date: TUESDAY, time: '09:00' });
  // Either books (if slot available) or 400 with "slot" message — not a rules error.
  // A successful POST /api/booking is 201 Created (NestJS's @Post() default,
  // no @HttpCode override) — not 200.
  if (status === 400) {
    expect(body.message).toMatch(/slot|available/i);
    expect(body.message).not.toMatch(/weekday|day|window/i);
  } else {
    expect(status).toBe(201);
    expect(body).toHaveProperty('id');
  }
});

test('R7: invalid RC → 400 before slot logic', async () => {
  const { status, body } = await postBooking({ ...BASE, patientRc: '1234567890', clinicId: CLINIC_TRAUMA, date: TUESDAY, time: '09:00' });
  expect(status).toBe(400);
  expect(body.message).toMatch(/rodné číslo|birth number|invalid/i);
});

test('R8: missing GDPR consent → 400', async () => {
  const { status, body } = await postBooking({ ...BASE, gdprConsent: false, clinicId: CLINIC_TRAUMA, date: TUESDAY, time: '09:00' });
  expect(status).toBe(400);
  expect(body.message).toMatch(/gdpr|consent/i);
});

test('R9: past date → 400', async () => {
  const { status, body } = await postBooking({ ...BASE, clinicId: CLINIC_TRAUMA, date: pastDate(), time: '09:00' });
  expect(status).toBe(400);
  expect(body.message).toMatch(/past|future|expired|invalid date/i);
});

// ── Cancel flow ────────────────────────────────────────────

test('HP3: cancel page renders for any token; non-existent token shows not-found state', async ({ page }) => {
  await page.goto('/sk/objednanie/zrusit/nonexistent-token-000');
  // Should show confirmation dialog (not 404)
  await expect(page.locator('button:has-text("Áno"), button:has-text("Zrušiť")')).toBeVisible({ timeout: 5_000 });
  await page.click('button:has-text("Áno"), button:has-text("Zrušiť")');
  // Same `text=A, text=B` non-union pitfall as HP1 above — use getByText() with regex OR.
  await expect(page.getByText(/Nastala chyba|Objednávku sa nepodarilo/).first()).toBeVisible({ timeout: 10_000 });
});
