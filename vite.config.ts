/// <reference types="@vitest/browser/matchers" />

import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const isCapacitor = process.env.CAPACITOR === 'true';

const src = (sub: string) => path.resolve(__dirname, `src/${sub}`);

const sharedAlias = {
  '@': path.resolve(__dirname, 'src'),
  '@/audio': src('audio/index.ts'),
  '@/obstacles': src('obstacles/index.ts'),
  '@/cockpit': src('cockpit/index.ts'),
  '@/hud': src('hud/index.ts'),
  '@/track': src('track/index.ts'),
  '@/config': src('config/index.ts'),
  '@/persistence': src('persistence/index.ts'),
  '@/design': src('design/index.ts'),
};

export default defineConfig({
  base: isCapacitor ? './' : '/midway-mayhem/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: sharedAlias },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three-vendor';
          if (
            id.includes('node_modules/@react-three/') ||
            id.includes('node_modules/postprocessing')
          )
            return 'r3f-vendor';
          if (id.includes('node_modules/tone') || id.includes('node_modules/spessasynth_lib'))
            return 'audio-vendor';
          if (id.includes('node_modules/yuka')) return 'ai-vendor';
        },
      },
    },
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4175 },
  optimizeDeps: { include: ['sql.js'] },
  define: {
    __DEV__: JSON.stringify(true),
  },
  test: {
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      include: ['src/game/**/*.ts', 'src/systems/**/*.ts', 'src/utils/**/*.ts'],
      exclude: ['src/**/__tests__/**'],
      thresholds: {
        branches: 50,
        functions: 65,
        lines: 65,
        statements: 65,
      },
    },
    projects: [
      {
        resolve: { alias: sharedAlias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
          exclude: [
            'src/**/__tests__/**/*.browser.test.{ts,tsx}',
            'src/**/__tests__/ui/**/*.test.{ts,tsx}',
            'e2e/**',
          ],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: sharedAlias },
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/__tests__/ui/**/*.test.{ts,tsx}'],
          setupFiles: ['src/__tests__/setup.jsdom.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: sharedAlias },
        optimizeDeps: {
          force: true,
          include: [
            'react',
            'react-dom',
            'three',
            '@react-three/fiber',
            '@react-three/drei',
            '@react-three/postprocessing',
            '@react-three/test-renderer',
            'zustand',
          ],
        },
        test: {
          name: 'browser',
          include: ['src/**/__tests__/**/*.browser.test.{ts,tsx}'],
          fileParallelism: false,
          maxWorkers: 1,
          testTimeout: 30000,
          setupFiles: ['src/__tests__/setup.browser.ts'],
          browser: {
            enabled: true,
            // Real-GPU WebGL via ANGLE/GL (matches stellar-descent + grailguard).
            // `--use-angle=gl` routes WebGL to the host GPU driver instead of
            // the SwiftShader software rasterizer. The result: component tests
            // exercise the same driver path the dev browser does, so a
            // "renders in test, blank in dev" split is impossible.
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
