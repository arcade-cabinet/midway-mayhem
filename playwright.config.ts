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
  // CI retries double wall-clock time, which we can't afford on the
  // nightly (45-min cap). Skip retries when PW_NIGHTLY is set; otherwise
  // use 1 retry for the smoke suite to absorb flakes.
  retries: process.env.PW_NIGHTLY ? 0 : process.env.CI ? 1 : 0,
  // Cap parallelism — 3D scene + preview server gets overwhelmed with
  // more than 2 concurrent renderers on a 4-core box.
  workers: process.env.CI ? 2 : 2,
  fullyParallel: false,
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
  // Snapshots are intentionally *not* per-platform. Cross-OS pixel diffs
  // would break CI/local parity. Renderer noise + font hinting across OSes
  // is absorbed via maxDiffPixelRatio at each call site.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
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
      // Use a chromium device so CI only needs to install Chromium.
      // Viewport + touch/mobile flags mimic a tablet-landscape surface.
      name: 'tablet-landscape',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 1024 },
        hasTouch: true,
        isMobile: false,
      },
    },
  ],
});
