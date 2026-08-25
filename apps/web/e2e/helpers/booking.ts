/**
 * Booking wizard test helpers.
 *
 * NOTE: there is no actual server-clock mocking in this suite — the
 * `timezoneId: 'Europe/Bratislava'` in playwright.config.ts only pins the
 * *browser's* timezone, and TEST_NOW in global-setup.ts (2026-06-08) is
 * never wired into the NestJS API process (a separate OS process;
 * global-setup can't touch its clock). booking-rules.service.ts rejects any
 * date before the real server "now" — so hardcoded fixture dates silently
 * drift into the past over time and trip the (correct) past-date guard
 * instead of the rule under test. MONDAY/TUESDAY/WEDNESDAY/THURSDAY below
 * are computed relative to the actual current date instead, using local
 * Date components (not toISOString(), which shifts a local date across the
 * UTC boundary) — mirrors the working reference implementation in
 * booking-rules.service.ts's nextAvailableDates().
 */
import { Page, TestInfo } from '@playwright/test';

export const VALID_RC  = '9001010007'; // passes modulo-11 (9001014719 did NOT: 9001014719 % 11 === 4)
export const CLINIC_TRAUMA = 'urazova-chirurgia';       // bookingDays=[2,4] (Tue/Thu), referral not required
export const CLINIC_ANGIOLOGY = 'angiologicka';         // bookingDays=[4,5] (Thu/Fri), window 13:00–14:00, referral required

export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Next future date (strictly after today) that falls on the given JS weekday (Sun=0 … Sat=6). */
export function nextWeekday(targetDay: 0 | 1 | 2 | 3 | 4 | 5 | 6, from: Date = new Date()): string {
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1); // start from tomorrow — "today" itself is never offered by the wizard
  while (cursor.getDay() !== targetDay) {
    cursor.setDate(cursor.getDate() + 1);
  }
  return toLocalDateString(cursor);
}

/** A date guaranteed to be in the past relative to whenever the suite runs. */
export function pastDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDateString(d);
}

export const MONDAY    = nextWeekday(1); // not a bookingDay for CLINIC_TRAUMA — negative weekday fixture
export const TUESDAY   = nextWeekday(2); // valid for CLINIC_TRAUMA
export const WEDNESDAY = nextWeekday(3); // not a bookingDay for CLINIC_ANGIOLOGY — negative weekday fixture
export const THURSDAY  = nextWeekday(4); // valid for CLINIC_TRAUMA and CLINIC_ANGIOLOGY

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

const PROJECT_ORDER = ['sk', 'en', 'mobile'];

/**
 * booking.spec.ts's HP1 and telehealth.spec.ts's TH-1.4 each perform a real
 * POST /api/booking against the wizard's ".first()" time slot. All three
 * Playwright projects (sk/en/mobile) run the same spec against the same
 * seeded DB, so three concurrent ".first()" clicks race for the exact same
 * (clinicId, date, time) row — only the first writer's booking succeeds,
 * and CI's automatic retries hit the now-permanently-booked slot again
 * (global-setup seeds once per whole run, not per retry). Index into a
 * distinct, guaranteed-seeded slot per project instead so the three runs
 * never collide.
 */
export function projectSlotIndex(testInfo: TestInfo): number {
  const i = PROJECT_ORDER.indexOf(testInfo.project.name);
  return i === -1 ? 0 : i;
}

export async function submitAndGetBookingId(page: Page): Promise<string | null> {
  await page.click('button[type="submit"], [data-action="confirm"]');
  await page.waitForSelector('[data-booking-id], .booking-id', { timeout: 15_000 }).catch(() => null);
  const el = page.locator('[data-booking-id], .booking-id').first();
  return (await el.textContent().catch(() => null))?.trim() ?? null;
}
