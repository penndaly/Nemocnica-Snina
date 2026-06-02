/**
 * Booking wizard test helpers.
 * TEST_NOW is 2026-06-08 (Monday) — defined in global-setup.ts.
 * NEXT_TUESDAY  = 2026-06-09 — valid for urazova-chirurgia (bookingDays=[2,4])
 * NEXT_THURSDAY = 2026-06-11 — valid for angiologicka (window 13:00–14:00) + urazova
 */
import { Page } from '@playwright/test';

export const VALID_RC  = '9001014719'; // passes modulo-11
export const CLINIC_TRAUMA = 'urazova-chirurgia';
export const CLINIC_ANGIOLOGY = 'angiologicka';
export const TUESDAY  = '2026-06-09';
export const THURSDAY = '2026-06-11';

export async function selectClinic(page: Page, clinicId: string): Promise<void> {
  await page.goto(`/sk/objednanie?clinic=${clinicId}`);
  // If deep-link didn't jump to step 2, click the clinic card
  const step2 = page.locator('[data-step="2"], [aria-label*="Dátum"]');
  const isStep2 = await step2.isVisible().catch(() => false);
  if (!isStep2) {
    await page.locator(`[data-clinic-id="${clinicId}"]`).click();
  }
}

export async function selectDate(page: Page, date: string): Promise<void> {
  await page.locator(`button[data-date="${date}"], [data-value="${date}"]`).click();
}

export async function selectTime(page: Page, time: string): Promise<void> {
  await page.locator(`button[data-time="${time}"], [data-value="${time}"]`).click();
}

export async function fillPatientDetails(page: Page, options?: {
  name?: string; phone?: string; rc?: string; gdpr?: boolean; referral?: boolean;
}): Promise<void> {
  const { name = 'Test Pacient', phone = '+421900000000', rc = VALID_RC, gdpr = true, referral } = options ?? {};
  await page.fill('[name="patientName"], [placeholder*="Meno"]', name);
  await page.fill('[name="patientPhone"], [placeholder*="Telefón"]', phone);
  await page.fill('[name="patientRc"], [placeholder*="Rodné číslo"]', rc);
  if (gdpr) await page.locator('[name="gdprConsent"]').check();
  if (referral != null && referral) await page.locator('[name="referralConsent"]').check();
}

export async function submitAndGetBookingId(page: Page): Promise<string | null> {
  await page.click('button[type="submit"], [data-action="confirm"]');
  await page.waitForSelector('[data-booking-id], .booking-id', { timeout: 15_000 }).catch(() => null);
  const el = page.locator('[data-booking-id], .booking-id').first();
  return (await el.textContent().catch(() => null))?.trim() ?? null;
}
