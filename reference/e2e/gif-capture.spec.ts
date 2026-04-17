import { test } from '@playwright/test';

/**
 * Capture a sequence of frames of the drop-in intro, then assemble them
 * into a GIF for the PR description. Skipped by default — run explicitly:
 *   pnpm exec playwright test e2e/gif-capture.spec.ts --project=gameplay-desktop
 *
 * Each PNG goes to docs/media/frames/; then scripts/make-gif.sh stitches.
 */

test.describe('GIF capture (manual)', () => {
  test('drop-in intro 0–2.5s', async ({ page }, testInfo) => {
    await page.goto('/?skip=1');
    await page.waitForSelector('[data-testid="cockpit"]', { timeout: 15_000 });

    const FRAMES = 24;
    const INTERVAL_MS = 110;
    for (let i = 0; i < FRAMES; i++) {
      const buf = await page.screenshot({ fullPage: false });
      await testInfo.attach(`frame-${String(i).padStart(3, '0')}`, {
        body: buf,
        contentType: 'image/png',
      });
      await page.waitForTimeout(INTERVAL_MS);
    }
  });
});
