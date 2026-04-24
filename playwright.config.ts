/**
 * Playwright e2e config — governor playthrough + mobile-viewport smoke tests.
 *
 * Runs against `pnpm preview` on port 4173 so we exercise the production
 * bundle, not the dev server. webServer below starts it automatically.
 *
 * GPU-accelerated WebGL is ON by default — swiftshader is ~15fps on this
 * game, which produces misleading screenshots AND hides perf regressions.
 * Set `PW_HEADLESS=1` to run truly headless (fallback when Chrome isn't
 * available); otherwise we launch real Chrome with ANGLE-GL.
 */
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4173/midway-mayhem/';
const IS_CI = !!process.env.CI;
const IS_HEADLESS = process.env.PW_HEADLESS === '1';
// Traces + videos on every failed test retain large per-worker buffers
// (traces can be 50-100MB each) and keep them alive until the worker
// tears down. That amplified every other leak during long specs and was
// a meaningful contributor to the host-memory spike. Default off; opt
// into full forensics with PW_DEBUG_TRACES=1 when you need to debug a
// flaky run.
const DEBUG_TRACES = process.env.PW_DEBUG_TRACES === '1';

/**
 * GPU-accelerated WebGL args. Using ANGLE/GL in headless mode keeps the
 * real driver path alive; `--ignore-gpu-blocklist` lets Chrome stop
 * downgrading to swiftshader when it detects "unsupported" hardware
 * (macOS CI + Linux CI both lie about this).
 */
const GPU_ARGS = [
  '--no-sandbox',
  '--use-angle=gl',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--mute-audio',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--window-position=9999,9999',
];

// Use real Chrome channel when it's available (local + GitHub-hosted
// runners both have it). Falls back to bundled Chromium when running
// headless on a machine without Chrome installed.
const CHROMIUM_CHANNEL = process.env.PW_CHROMIUM_CHANNEL ?? (IS_HEADLESS ? undefined : 'chrome');

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/node_modules/**'],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: IS_CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  retries: process.env.PW_NIGHTLY ? 0 : IS_CI ? 1 : 0,
  workers: IS_CI ? 2 : 2,
  fullyParallel: false,
  use: {
    baseURL: BASE_URL,
    headless: IS_HEADLESS,
    trace: DEBUG_TRACES ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
    video: DEBUG_TRACES ? 'retain-on-failure' : 'off',
    launchOptions: {
      args: GPU_ARGS,
    },
  },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: !IS_CI,
    timeout: 180_000,
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: CHROMIUM_CHANNEL,
        viewport: { width: 1440, height: 900 },
        launchOptions: { args: GPU_ARGS },
      },
    },
    {
      name: 'mobile-portrait',
      use: {
        ...devices['Pixel 7'],
        channel: CHROMIUM_CHANNEL,
        launchOptions: { args: GPU_ARGS },
      },
    },
    {
      name: 'tablet-landscape',
      use: {
        ...devices['Desktop Chrome'],
        channel: CHROMIUM_CHANNEL,
        viewport: { width: 1366, height: 1024 },
        hasTouch: true,
        isMobile: false,
        launchOptions: { args: GPU_ARGS },
      },
    },
  ],
});
