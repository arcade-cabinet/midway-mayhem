/**
 * Fast merge-gate boot smoke. Desktop-only. Navigate with autoplay=1,
 * wait for the canvas, poll `window.__mm.diag().running` until it
 * flips true. No screenshots, no intervals — those belong in the
 * @nightly suite.
 *
 * Earlier iterations used `page.evaluate()` to read the diag once,
 * which hung for the full test timeout on the xvfb Chromium runner
 * (presumably because the synchronous call competes with the WebGL
 * render loop on a shared main thread). `page.waitForFunction()`
 * polls on a timer and returns as soon as the predicate is true,
 * which is the playwright-idiomatic way to wait for a JS-accessible
 * state flip.
 */
import { expect, test } from '@playwright/test';

const SMOKE_PHRASE = 'neon-polkadot-jalopy';

test.describe('boot smoke — fast merge gate', () => {
  test('autoplay=1 boots into a running game on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'smoke runs on desktop-chromium only');
    test.setTimeout(45_000);

    await page.goto(`/midway-mayhem/?autoplay=1&governor=1&phrase=${SMOKE_PHRASE}`);

    // Canvas mounts.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });

    // Poll __mm.diag() until the run flips to running=true. waitForFunction
    // is safe with the busy WebGL render loop because it polls on a timer
    // and yields between attempts.
    // Poll until running=true AND speed>0 in one shot. Both flip after
    // the drop-in intro completes, so bundling them lets the poll ride
    // the same cadence rather than two separate serialize/yield cycles.
    await page.waitForFunction(
      () => {
        const w = window as {
          __mm?: { diag?: () => { running?: boolean; speedMps?: number } };
        };
        const d = w.__mm?.diag?.();
        return d?.running === true && (d.speedMps ?? 0) > 0;
      },
      { timeout: 20_000, polling: 500 },
    );

    // Read the speed one last time for the assertion message, so the
    // test body ends with a concrete expect() call (keeps reporters happy).
    const speed = await page.evaluate(() => {
      const w = window as { __mm?: { diag?: () => { speedMps?: number } } };
      return w.__mm?.diag?.()?.speedMps ?? 0;
    });

    expect(
      speed,
      `car must have non-zero speed after boot + 3s drive (got ${speed})`,
    ).toBeGreaterThan(0);
  });
});
