/// <reference types="@vitest/browser/matchers" />

import path from 'node:path';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { captureServerPlugin } from './scripts/vite-capture-plugin';
import { writePngFromDataUrl } from './scripts/vitest-write-png-command';

const isCapacitor = process.env.CAPACITOR === 'true';
const alias = { '@': path.resolve(__dirname, 'src') };

// Browser test timeouts. CI swiftshader runs 3-5× slower than real-GPU
// Chrome, so tests that wait for distance accumulation need a longer
// budget on CI. Named constants so the threshold is easy to find.
const LOCAL_BROWSER_TEST_TIMEOUT_MS = 30_000;
const CI_BROWSER_TEST_TIMEOUT_MS = 120_000;

export default defineConfig({
  base: isCapacitor ? './' : '/midway-mayhem/',
  plugins: [react(), captureServerPlugin()],
  resolve: { alias },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Code-split the large third-party libs into their own chunks so
        // an app-code change doesn't invalidate the whole bundle cache on
        // deploy. Tone + three + drei weigh hundreds of KB and change
        // infrequently; separating them lets browsers keep them cached
        // across releases.
        manualChunks(id: string): string | undefined {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/@react-three/')) return 'r3f';
          if (id.includes('node_modules/tone/')) return 'tone';
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          )
            return 'react';
          if (id.includes('node_modules/koota/')) return 'koota';
          return undefined;
        },
      },
    },
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4175 },
  // Prebundle persistence deps so the browser test worker doesn't get a
  // mid-run Vite reload ("✨ new dependencies optimized → reloading") that
  // races the test timeout on CI where first-run optimization is slow.
  optimizeDeps: {
    include: ['@capacitor-community/sqlite', '@capacitor/core', 'sql.js'],
  },
  test: {
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.{ts,tsx}'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.{ts,tsx}'],
          fileParallelism: false,
          maxWorkers: 1,
          // CI swiftshader runs WebGL 3-5× slower than real-GPU Chrome, so
          // any integration test that waits for distance to accumulate
          // (driveInto + waitForDistance flows) needs proportionally more
          // wall-clock budget. See constants above.
          testTimeout: process.env.CI ? CI_BROWSER_TEST_TIMEOUT_MS : LOCAL_BROWSER_TEST_TIMEOUT_MS,
          setupFiles: ['src/test/setup.ts'],
          browser: {
            enabled: true,
            // Real GPU via ANGLE/GL through installed Chrome, not swiftshader.
            // Matches what the dev browser does — no "passes in test, breaks
            // in browser" split.
            provider: playwright({
              launchOptions: {
                channel: 'chrome',
                args: [
                  '--no-sandbox',
                  '--use-angle=gl',
                  '--enable-webgl',
                  '--enable-features=WebGL,WebGL2',
                  '--ignore-gpu-blocklist',
                  '--disable-background-timer-throttling',
                  '--disable-backgrounding-occluded-windows',
                  '--disable-renderer-backgrounding',
                  '--mute-audio',
                ],
              },
            }),
            instances: [
              {
                browser: 'chromium',
                headless: process.env.VITEST_HEADED !== '1',
                viewport: { width: 1280, height: 720 },
              },
            ],
            screenshotFailures: false,
            commands: { writePngFromDataUrl },
          },
        },
      },
    ],
  },
});
