import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

/**
 * GPU-accelerated WebGL flags for headed Chrome (mirrors grailguard).
 * CI runs headed under xvfb-run which activates real GPU rendering;
 * locally we can run headed without xvfb.
 */
const GPU_ARGS = [
  '--no-sandbox',
  '--use-angle=default',
  '--enable-features=WebGL,WebGL2',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--use-gl=angle',
  '--mute-audio',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: isCI ? 'never' : 'on-failure' }]],
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      maxDiffPixels: 250,
      threshold: 0.25,
      animations: 'disabled',
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4175/midway-mayhem',
    trace: isCI ? 'on-first-retry' : 'on',
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'off',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'gameplay-desktop',
      testMatch: '**/*.spec.ts',
      testIgnore: '**/mobile.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        headless: false,
        viewport: { width: 1280, height: 720 },
        launchOptions: { args: GPU_ARGS },
      },
    },
    {
      name: 'gameplay-mobile',
      testMatch: '**/mobile.spec.ts',
      use: {
        ...devices['iPhone 14 Pro'],
        headless: false,
        launchOptions: { args: GPU_ARGS },
      },
    },
  ],
  webServer: {
    command: 'pnpm preview --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175/midway-mayhem/',
    reuseExistingServer: !isCI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
