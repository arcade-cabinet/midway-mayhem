/**
 * Minimal Playwright config. v2 doesn't ship Playwright E2E — visual
 * regression happens inside vitest-browser on the same real-GPU Chromium
 * runtime. This config exists only to keep the inherited CI workflow's
 * `pnpm exec playwright test` step from discovering spec files inside
 * `reference/` (archived v1 code). It points testDir at a dir that
 * doesn't exist, so Playwright finds zero specs and exits 0.
 */
export default {
  testDir: './e2e',
  testIgnore: ['**/reference/**', '**/node_modules/**'],
  reporter: 'list',
  use: { trace: 'off' },
};
