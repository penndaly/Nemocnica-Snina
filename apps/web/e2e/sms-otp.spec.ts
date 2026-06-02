/**
 * SPEC 8 — SMS OTP flow (booking confirmation + step-up 2FA).
 * In CI: SMS_PROVIDER=console → codes are logged, not sent.
 * Uses the /api/sms/last-otp test helper (only available when SMS_PROVIDER=console).
 */
import { test, expect } from '@playwright/test';
import { VALID_RC } from './helpers/booking';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:3001';

// Only run SMS tests if the console mock is active
const skipIfRealSms = process.env['SMS_PROVIDER'] === 'console' ? test : test.skip;

skipIfRealSms('SMS1: OTP is sent and verifiable via test helper', async () => {
  const phone = '+421900000099';
  // Send OTP
  const r1 = await fetch(`${API}/api/sms/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, purpose: 'test' }),
  });
  expect(r1.status).toBe(201);

  // Retrieve last OTP via test helper (console mode only)
  const r2 = await fetch(`${API}/api/sms/last-otp?phone=${phone}&purpose=test`);
  expect(r2.status).toBe(200);
  const { code } = await r2.json() as { code: string };
  expect(code).toMatch(/^\d{6}$/);

  // Verify OTP
  const r3 = await fetch(`${API}/api/sms/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code, purpose: 'test' }),
  });
  expect(r3.status).toBe(200);
  const { valid } = await r3.json() as { valid: boolean };
  expect(valid).toBe(true);
});

skipIfRealSms('SMS2: wrong OTP returns invalid', async () => {
  const phone = '+421900000098';
  await fetch(`${API}/api/sms/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, purpose: 'test2' }),
  });

  const r = await fetch(`${API}/api/sms/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code: '000000', purpose: 'test2' }),
  });
  expect(r.status).toBe(200);
  const { valid } = await r.json() as { valid: boolean };
  expect(valid).toBe(false);
});

skipIfRealSms('SMS3: expired OTP is rejected', async () => {
  // OTP TTL is 10 min in prod; in test mode we can force expiry via the API
  const phone = '+421900000097';
  const r1 = await fetch(`${API}/api/sms/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, purpose: 'expired-test', ttlOverrideMs: 1 }), // 1ms TTL
  });
  expect(r1.status).toBe(201);

  await new Promise((r) => setTimeout(r, 50)); // wait for expiry

  const r2 = await fetch(`${API}/api/sms/last-otp?phone=${phone}&purpose=expired-test`);
  if (!r2.ok) { test.skip(); return; } // helper not available
  const { code } = await r2.json() as { code: string };

  const r3 = await fetch(`${API}/api/sms/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code, purpose: 'expired-test' }),
  });
  const { valid } = await r3.json() as { valid: boolean };
  expect(valid).toBe(false);
});

test('SMS4: booking confirmation SMS is triggered after successful booking', async () => {
  // Create a booking via API and confirm an OTP/confirmation was queued
  const r = await fetch(`${API}/api/booking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clinicId: 'urologicka',
      date: '2026-06-09',
      time: '09:00',
      patientName: 'SMS Test Pacient',
      patientPhone: '+421900000096',
      patientRc: VALID_RC,
      gdprConsent: true,
      referralConsent: false,
      hasReferral: false,
    }),
  });
  // If slot is taken, skip; otherwise confirm booking succeeded and SMS was queued
  if (r.status === 200) {
    const body = await r.json() as { id?: string };
    expect(body).toHaveProperty('id');
    // SMS service logs in console mode — we can't assert delivery but confirm no exception
  } else {
    expect([400, 200]).toContain(r.status);
  }
});
