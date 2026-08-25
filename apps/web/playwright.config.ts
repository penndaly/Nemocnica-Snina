import { defineConfig, devices } from '@playwright/test';

// telehealth.spec.ts's patient/physician room pages call
// getUserMedia({video:true,audio:true}) during the device-check step before
// joining — without a granted permission + fake device, this rejects (no
// real camera in CI) and every telehealth room test gets stuck in a
// device_denied error state before ever reaching the join/waiting-room UI
// the tests assert on. Chromium-only: the fake-device launch args are a
// Chrome flag, and WebKit doesn't recognize 'camera'/'microphone' as valid
// permission names at all (throws "Unknown permission" on context creation)
// — so this is added per-project to sk/en (Desktop Chrome) only, not to the
// global `use` block, which would otherwise break every test in the
// `mobile` (WebKit) project, not just the telehealth ones.
const chromeMediaOverrides = {
  permissions: ['camera', 'microphone'],
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
};

export default defineConfig({
  testDir:  './e2e',
  timeout:  30_000,
  retries:  process.env['CI'] ? 2 : 0,
  // 'github' alone only emits log annotations — it never writes
  // playwright-report/, so CI's "Upload Playwright report" step had nothing
  // to upload every single run (it reported success anyway: actions/upload-
  // artifact doesn't fail on an empty/missing path, it just silently skips
  // creating the artifact). Screenshots/videos/traces on failure were
  // captured (use.screenshot/video below) but never retrievable — every
  // past CI failure investigation had to work from raw text logs alone.
  // Keep the GitHub annotations AND actually produce the HTML report.
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL:     process.env['APP_BASE_URL'] ?? 'http://localhost:3000',
    screenshot:  'only-on-failure',
    video:       'retain-on-failure',
    trace:       'retain-on-failure',
    // Only pins the *browser's* timezone — there is no server-clock mocking
    // in this suite (see helpers/booking.ts for the date-fixture approach
    // that works around that).
    timezoneId:  'Europe/Bratislava',
  },

  projects: [
    {
      name:  'sk',
      use:   { ...devices['Desktop Chrome'], locale: 'sk-SK', ...chromeMediaOverrides },
    },
    {
      name:  'en',
      use:   { ...devices['Desktop Chrome'], locale: 'en-GB', ...chromeMediaOverrides },
    },
    {
      name:  'mobile',
      use:   { ...devices['iPhone 13'], locale: 'sk-SK' },
    },
  ],

  globalSetup:    './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  webServer: process.env['CI']
    ? undefined  // CI starts the server externally
    : {
        command: 'pnpm dev',
        url:     'http://localhost:3000',
        reuseExistingServer: true,
      },
});
