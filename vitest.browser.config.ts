/// <reference types="@vitest/browser/matchers" />

import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { sharedVitestConfig } from './vitest.shared';

export default defineConfig({
  ...sharedVitestConfig,
  plugins: [react()],
  optimizeDeps: {
    force: true,
    include: [
      'react',
      'react-dom',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/postprocessing',
      'zustand',
    ],
  },
  test: {
    globals: true,
    include: ['src/**/__tests__/**/*.browser.test.{ts,tsx}'],
    fileParallelism: false,
    testTimeout: 30000,
    setupFiles: ['src/__tests__/setup.browser.ts'],
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: {
          args: [
            '--enable-webgl',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
            '--use-gl=angle',
            '--use-angle=swiftshader-webgl',
            '--mute-audio',
          ],
        },
      }),
      instances: [
        {
          browser: 'chromium',
          headless: true,
          viewport: { width: 1280, height: 720 },
        },
      ],
      screenshotFailures: true,
    },
  },
});
