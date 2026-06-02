import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:  './e2e',
  timeout:  30_000,
  retries:  process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',

  use: {
    baseURL:     process.env['APP_BASE_URL'] ?? 'http://localhost:3000',
    screenshot:  'only-on-failure',
    video:       'retain-on-failure',
    // Freeze "now" to a fixed Monday for deterministic weekday rule tests
    timezoneId:  'Europe/Bratislava',
  },

  projects: [
    {
      name:  'sk',
      use:   { ...devices['Desktop Chrome'], locale: 'sk-SK' },
    },
    {
      name:  'en',
      use:   { ...devices['Desktop Chrome'], locale: 'en-GB' },
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
