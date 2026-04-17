/// <reference types="@vitest/browser/matchers" />

import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { captureServerPlugin } from './scripts/vite-capture-plugin';

const isCapacitor = process.env.CAPACITOR === 'true';
const alias = { '@': path.resolve(__dirname, 'src') };

export default defineConfig({
  base: isCapacitor ? './' : '/midway-mayhem/',
  plugins: [react(), tailwindcss(), captureServerPlugin()],
  resolve: { alias },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4175 },
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
          include: ['src/**/*.test.ts'],
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
          testTimeout: 30000,
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
          },
        },
      },
    ],
  },
});
