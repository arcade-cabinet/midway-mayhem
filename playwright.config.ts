/**
 * Playwright e2e config — governor playthrough + mobile-viewport smoke tests.
 *
 * Runs against `pnpm preview` on port 4173 so we exercise the production
 * bundle, not the dev server. webServer below starts it automatically.
 */
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4173/midway-mayhem/';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/node_modules/**'],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-portrait',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'tablet-landscape',
      use: { ...devices['iPad Pro 11 landscape'] },
    },
  ],
});
