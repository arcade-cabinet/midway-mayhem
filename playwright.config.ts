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
      testIgnore: ['**/mobile.spec.ts', '**/visual.spec.ts'],
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
    // Visual regression: one project per form-factor tier the responsive HUD targets.
    // Baselines are stored per-project, so a resize regression surfaces as a
    // failed screenshot diff scoped to the exact tier that broke.
    {
      name: 'visual-desktop',
      testMatch: '**/visual.spec.ts',
      use: {
        browserName: 'chromium',
        headless: false,
        viewport: { width: 1440, height: 900 },
        launchOptions: { args: GPU_ARGS },
      },
    },
    {
      name: 'visual-tablet',
      testMatch: '**/visual.spec.ts',
      use: {
        browserName: 'chromium',
        headless: false,
        viewport: { width: 820, height: 1180 },
        launchOptions: { args: GPU_ARGS },
      },
    },
    {
      name: 'visual-phone-portrait',
      testMatch: '**/visual.spec.ts',
      use: {
        browserName: 'chromium',
        headless: false,
        viewport: { width: 390, height: 844 },
        launchOptions: { args: GPU_ARGS },
      },
    },
    {
      name: 'visual-phone-landscape',
      testMatch: '**/visual.spec.ts',
      use: {
        browserName: 'chromium',
        headless: false,
        viewport: { width: 844, height: 390 },
        launchOptions: { args: GPU_ARGS },
      },
    },
    // 3D visual: captures live WebGL cockpit render (canvas NOT hidden)
    {
      name: 'visual-3d',
      testMatch: '**/visual-3d.spec.ts',
      use: {
        browserName: 'chromium',
        headless: false,
        viewport: { width: 1440, height: 900 },
        launchOptions: { args: GPU_ARGS },
      },
    },
    {
      name: 'visual-3d-tablet',
      testMatch: '**/visual-3d.spec.ts',
      use: {
        browserName: 'chromium',
        headless: false,
        viewport: { width: 820, height: 1180 },
        launchOptions: { args: GPU_ARGS },
      },
    },
    {
      name: 'visual-3d-phone-portrait',
      testMatch: '**/visual-3d.spec.ts',
      use: {
        browserName: 'chromium',
        headless: false,
        viewport: { width: 390, height: 844 },
        launchOptions: { args: GPU_ARGS },
      },
    },
    {
      name: 'visual-3d-phone-landscape',
      testMatch: '**/visual-3d.spec.ts',
      use: {
        browserName: 'chromium',
        headless: false,
        viewport: { width: 844, height: 390 },
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
