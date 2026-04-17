import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { sharedVitestConfig } from './vitest.shared';

export default defineConfig({
  ...sharedVitestConfig,
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/__tests__/ui/**/*.test.{ts,tsx}'],
    setupFiles: ['src/__tests__/setup.jsdom.ts'],
  },
});
