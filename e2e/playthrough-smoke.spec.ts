/**
 * Fast merge-gate boot smoke. Desktop-only. Navigate with autoplay=1,
 * wait for the canvas, read `window.__mm.diag()` once, assert the run
 * is actually running and the car has started moving. No interval
 * sampling, no screenshots — those belong in the @nightly suite.
 *
 * Earlier iterations of this spec sampled 5 × 1s frames via the
 * `runPlaythrough` factory, which drove `page.screenshot()` and
 * `page.evaluate()` under a 60s → 90s budget. The xvfb Chromium on
 * CI ate that budget with "waiting for fonts to load" and frozen-
 * evaluate phases despite the test logic finishing in seconds; the
 * factory is the wrong shape for a merge gate.
 *
 * If this test fails, autoplay itself is broken — `window.__mm` isn't
 * wired or the run never flipped to `running=true`. Quick to diagnose,
 * quick to ship a fix.
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

    // Give autoplay + drop-intro a moment to commit.
    await page.waitForTimeout(3_000);

    // One diag read — must be running, not paused, not gameOver.
    const diag = await page.evaluate(() => {
      const w = window as {
        __mm?: {
          diag?: () => {
            running?: boolean;
            paused?: boolean;
            gameOver?: boolean;
            distance?: number;
            speedMps?: number;
          };
        };
      };
      return w.__mm?.diag?.() ?? null;
    });

    expect(diag, 'window.__mm.diag() must be wired').toBeTruthy();
    expect(diag?.running, 'run must be running after autoplay').toBe(true);
    expect(diag?.paused, 'run must not be paused').toBe(false);
    expect(diag?.gameOver, 'run must not be game-over').toBe(false);
    expect(
      diag?.speedMps ?? 0,
      `car must have non-zero speed after 3s (got ${diag?.speedMps})`,
    ).toBeGreaterThan(0);
  });
});
