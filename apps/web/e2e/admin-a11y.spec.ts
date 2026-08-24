/**
 * Axe WCAG 2.1 AA on the admin routes added this sprint — closes the A4-8
 * `test.fixme` that deferred this when the production /admin pages did not
 * exist yet. Act No. 351/2022 makes AA a legal requirement.
 *
 * The staff JWT is injected into sessionStorage and the API is stubbed with
 * fixtures via page.route(). That is deliberate: axe runs against the REAL
 * rendered DOM of each route, but the suite needs no Postgres/Redis/RabbitMQ,
 * so it is a CI gate rather than something that only runs on a seeded box.
 * Live-data assertions (clinic scoping, RBAC) stay in admin-a4.spec.ts, which
 * hits the API for real.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Unsigned token — AdminAuthContext only base64-decodes the `role` claim for
 * cosmetic gating, and every stubbed endpoint below bypasses the server guard.
 * Never a substitute for the server-side RBAC tests.
 */
function fakeStaffJwt(role: 'super_admin' | 'administrator' | 'clinician'): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    sub: 'e2e-staff', email: 'e2e@nemocnicasnina.sk', role,
    aud: 'ns.staff', exp: Math.floor(Date.now() / 1000) + 3600,
  })}.sig`;
}

const BOOKINGS = {
  items: [
    {
      id: 'bk-1', patientTokenPreview: 'pt_9f3a…', clinicId: 'c1', clinicName: 'Kardiologická ambulancia',
      physicianSlug: 'mudr-novak', slot: '2026-09-01T09:30:00.000Z', durationMin: 30,
      status: 'booked', paymentStatus: 'paid', bookedAt: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-20T10:00:00.000Z',
    },
    {
      id: 'bk-2', patientTokenPreview: 'pt_1c7b…', clinicId: 'c2', clinicName: 'Interná ambulancia',
      slot: '2026-09-02T11:00:00.000Z', durationMin: 20,
      status: 'no_show', paymentStatus: 'free', bookedAt: '2026-08-21T08:00:00.000Z', updatedAt: '2026-08-21T08:00:00.000Z',
    },
  ],
  total: 2, page: 1, limit: 25,
};

const BOOKING_STATS = {
  today: { booked: 12, cancelled: 2, noShow: 1, completed: 8 },
  week: { booked: 64, cancelled: 7, noShow: 4 },
  pendingReview: 3,
};

const PLATFORMS = [
  {
    id: 'fitbit', name: 'Fitbit', category: 'consumer', partnershipRequired: false, manualUploadOnly: false,
    iosAppRequired: false, euBlocked: false, enabled: true, credentialsConfigured: true,
    connectedDeviceCount: 4, lastSyncAt: '2026-08-24T07:00:00.000Z', connectionTestUrl: 'https://api.fitbit.com',
  },
  {
    id: 'huawei', name: 'Huawei Health', category: 'consumer', partnershipRequired: false, manualUploadOnly: false,
    iosAppRequired: false, euBlocked: true, enabled: false, credentialsConfigured: false,
    connectedDeviceCount: 0, lastSyncAt: null, connectionTestUrl: null,
  },
  {
    id: 'medtronic-cardiac', name: 'Medtronic CareLink', category: 'medical', partnershipRequired: true,
    manualUploadOnly: false, iosAppRequired: false, euBlocked: false, enabled: false, credentialsConfigured: false,
    connectedDeviceCount: 0, lastSyncAt: null, connectionTestUrl: null,
  },
];

const MONITORING_SUMMARY = {
  totalConnected: 4,
  byPlatform: { fitbit: { connected: 4, syncErrors: 1 } },
  consentExpiringSoon: 2, consentGracePending: 1, pendingAlerts: 3,
};

const ALERTS = {
  items: [
    {
      id: 'al-1', severity: 'critical', metricType: '8867-4', platformId: 'fitbit',
      patientTokenPreview: 'pt_9f3a…', thresholdValue: 120, readingValue: '141',
      ts: '2026-08-24T06:12:00.000Z', acknowledged: false,
    },
  ],
  total: 1,
};

const THRESHOLDS = [
  { metricType: '8867-4', key: 'heart_rate', label: 'Srdcová frekvencia', unit: 'bpm', criticalLow: 40, highLow: 50, highHigh: 110, criticalHigh: 130 },
  { metricType: '2708-6', key: 'spo2', label: 'Saturácia kyslíkom', unit: '%', criticalLow: 88, highLow: 92, highHigh: null, criticalHigh: null },
];

const HEALTH_REPORT = {
  generatedAt: '2026-08-24T08:00:00.000Z',
  overall: 'degraded',
  integrations: [
    { id: 'oidc', name: 'eID / OIDC broker (slovensko.sk)', group: 'identity', state: 'ok', mode: 'mock', credentialsConfigured: false, lastSuccessAt: null, errorsLastHour: 0, detail: 'Mock broker' },
    { id: 'his', name: 'HIS / NCZI eZdravie sync', group: 'clinical', state: 'ok', mode: 'mock', credentialsConfigured: true, lastSuccessAt: '2026-08-24T07:55:00.000Z', errorsLastHour: 0 },
    { id: 'sms', name: 'SMS (console)', group: 'messaging', state: 'ok', mode: 'mock', credentialsConfigured: false, lastSuccessAt: null, errorsLastHour: 0 },
    { id: 'payments', name: 'Platobná brána (mock)', group: 'payments', state: 'ok', mode: 'mock', credentialsConfigured: false, lastSuccessAt: null, errorsLastHour: 0 },
    { id: 'translation', name: 'Strojový preklad (mock)', group: 'content', state: 'ok', mode: 'mock', credentialsConfigured: true, lastSuccessAt: null, errorsLastHour: 0 },
    { id: 'livekit', name: 'Telemedicína (mock)', group: 'video', state: 'ok', mode: 'mock', credentialsConfigured: false, lastSuccessAt: null, errorsLastHour: 0, detail: 'TURN región: eu' },
    { id: 'wearables', name: 'Nositeľné zariadenia (agregát)', group: 'wearables', state: 'degraded', mode: 'disabled', credentialsConfigured: false, lastSuccessAt: null, errorsLastHour: 2, detail: 'WEARABLES_ENABLED=false' },
  ],
  infra: [
    { id: 'postgres', name: 'PostgreSQL', state: 'ok', latencyMs: 3, metrics: { connections: 6, active: 1, maxConnections: 100 } },
    { id: 'redis', name: 'Redis', state: 'ok', latencyMs: 1 },
    { id: 'rabbitmq', name: 'RabbitMQ', state: 'degraded', latencyMs: 8, metrics: { 'ns.his.events.messages': 0, 'ns.his.events.dlq.messages': 2 }, detail: '2 správ v DLQ' },
  ],
  crons: [
    { job: 'telehealth.no-show', state: 'ok', expectedEveryMs: 300000, lastRunAt: '2026-08-24T07:58:00.000Z', lastOutcome: 'ok', durationMs: 12, runs: 40, errors: 0 },
    { job: 'booking.reminders', state: 'unknown', expectedEveryMs: 3600000, detail: 'Od štartu procesu nebežalo' },
    { job: 'wearables.sync', state: 'degraded', expectedEveryMs: 60000, lastRunAt: '2026-08-24T07:30:00.000Z', lastOutcome: 'error', lastError: 'adapter timeout', durationMs: 3000, runs: 20, errors: 3 },
    { job: 'wearables.retention-purge', state: 'ok', expectedEveryMs: 86400000, lastRunAt: '2026-08-24T02:00:00.000Z', lastOutcome: 'ok', durationMs: 900, runs: 1, errors: 0 },
    { job: 'wearables.consent-grace', state: 'ok', expectedEveryMs: 86400000, lastRunAt: '2026-08-24T03:00:00.000Z', lastOutcome: 'ok', durationMs: 400, runs: 1, errors: 0 },
  ],
};

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function stubAdminApi(page: Page, role: 'super_admin' | 'administrator' = 'super_admin') {
  await page.addInitScript(
    ([token, r]) => {
      sessionStorage.setItem('ns_admin_token', token as string);
      sessionStorage.setItem('ns_admin_role', r as string);
      sessionStorage.setItem('ns_admin_email', 'e2e@nemocnicasnina.sk');
    },
    [fakeStaffJwt(role), role] as const,
  );

  // Playwright matches the LAST-registered route first, so the specific /stats
  // handler must be registered AFTER the general list handler or the list
  // payload would be served for stats and crash the stat tiles.
  await page.route('**/api/admin/bookings**', (r) => r.fulfill(json(BOOKINGS)));
  await page.route('**/api/admin/bookings/stats**', (r) => r.fulfill(json(BOOKING_STATS)));
  await page.route('**/api/admin/wearables/platforms**', (r) => r.fulfill(json(PLATFORMS)));
  await page.route('**/api/admin/wearables/monitoring/summary', (r) => r.fulfill(json(MONITORING_SUMMARY)));
  await page.route('**/api/admin/wearables/monitoring/alerts**', (r) => r.fulfill(json(ALERTS)));
  await page.route('**/api/admin/wearables/monitoring/thresholds/defaults**', (r) => r.fulfill(json(THRESHOLDS)));
  await page.route('**/api/admin/health', (r) => r.fulfill(json(HEALTH_REPORT)));
  await page.route('**/api/booking/slots**', (r) => r.fulfill(json([{ id: 's1', time: '10:00' }])));
}

async function expectNoSeriousAxeViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .disableRules(['color-contrast']) // checked separately against real brand colours
    .analyze();

  const bad = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  if (bad.length > 0) {
    const summary = bad
      .map((v) => `${v.impact}: ${v.id} — ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`)
      .join('\n');
    throw new Error(`Axe violations on ${label}:\n${summary}`);
  }
  expect(bad).toHaveLength(0);
}

/**
 * `settled` waits on fixture-derived content, not networkidle — the Next dev
 * server holds an HMR socket open, so networkidle never fires.
 */
const ROUTES: Array<{ path: string; ready: string; settled: string }> = [
  { path: '/admin/bookings', ready: 'h1:has-text("Objednania")', settled: 'text=Kardiologická ambulancia' },
  { path: '/admin/wearables', ready: 'h1:has-text("Nositeľné zariadenia")', settled: 'text=Huawei Health' },
  { path: '/admin/health', ready: 'h1:has-text("Stav integrácií")', settled: 'text=PostgreSQL' },
];

for (const route of ROUTES) {
  test(`ADMIN-A11Y: zero critical/serious axe violations — ${route.path}`, async ({ page }) => {
    await stubAdminApi(page);
    await page.goto(route.path);
    await page.waitForSelector(route.ready, { timeout: 10_000 });
    await page.waitForSelector(route.settled, { timeout: 10_000 });
    await expectNoSeriousAxeViolations(page, route.path);
  });
}

test('ADMIN-A11Y: wearables tabs are keyboard-operable and expose ARIA state', async ({ page }) => {
  await stubAdminApi(page);
  await page.goto('/admin/wearables');
  await page.waitForSelector('h1:has-text("Nositeľné zariadenia")');

  const tablist = page.getByRole('tablist');
  await expect(tablist).toBeVisible();

  const platforms = page.getByRole('tab', { name: 'Platformy' });
  await expect(platforms).toHaveAttribute('aria-selected', 'true');

  await platforms.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Monitoring' })).toHaveAttribute('aria-selected', 'true');
  await expectNoSeriousAxeViolations(page, '/admin/wearables (monitoring tab)');

  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Prahy' })).toHaveAttribute('aria-selected', 'true');
  await expectNoSeriousAxeViolations(page, '/admin/wearables (thresholds tab)');
});

test('ADMIN-A11Y: booking dialogs are labelled and axe-clean', async ({ page }) => {
  await stubAdminApi(page);
  await page.goto('/admin/bookings');
  await page.waitForSelector('h1:has-text("Objednania")');

  await page.getByLabel(/Zrušiť objednanie/).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expectNoSeriousAxeViolations(page, '/admin/bookings (cancel dialog)');
});

test('ADMIN-A11Y: platform toggle is disabled for EU-blocked and partnership-gated platforms', async ({ page }) => {
  await stubAdminApi(page);
  await page.goto('/admin/wearables');
  await page.waitForSelector('h1:has-text("Nositeľné zariadenia")');

  await expect(page.getByLabel('Povoliť platformu Huawei Health')).toBeDisabled();
  await expect(page.getByLabel('Povoliť platformu Medtronic CareLink')).toBeDisabled();
  await expect(page.getByLabel('Povoliť platformu Fitbit')).toBeEnabled();
});
