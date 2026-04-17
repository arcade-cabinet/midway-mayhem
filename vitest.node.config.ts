import { defineConfig } from 'vitest/config';
import { sharedVitestConfig } from './vitest.shared';

export default defineConfig({
  ...sharedVitestConfig,
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    exclude: [
      'src/**/__tests__/**/*.browser.test.{ts,tsx}',
      'src/**/__tests__/ui/**/*.test.{ts,tsx}',
      'e2e/**',
    ],
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
  },
});
