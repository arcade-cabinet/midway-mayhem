/**
 * Fast merge-gate boot smoke. Desktop-only. Navigate with `?autoplay=1`,
 * wait for the canvas and HUD to mount, then confirm the DISTANCE
 * readout shows a positive number — proof the car is moving.
 *
 * Earlier iterations used `page.evaluate()` / `page.waitForFunction()`
 * against `window.__mm.diag()`. Both hung for 45s on the xvfb CI
 * Chromium, apparently because synchronous/polling bridge calls
 * compete with the busy WebGL render loop on the main thread.
 * `mobile-gameplay test 3` runs the same `?autoplay=1` URL and
 * passes in 9.2s — its assertions use playwright's DOM locator API,
 * which yields cleanly through the page's own event loop.
 *
 * Copy that pattern: all assertions via `expect(locator).toXxx()`.
 * No page.evaluate, no __mm bridge, no screenshots. DISTANCE HUD
 * panel displays the current `distance.toFixed(0)` + " m" suffix —
 * when a non-zero number appears there, the run is live and moving.
 */
import { expect, test } from '@playwright/test';

test.describe('boot smoke — fast merge gate', () => {
  test('autoplay=1 boots into a running game on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'smoke runs on desktop-chromium only');
    test.setTimeout(60_000);

    await page.goto('/midway-mayhem/?autoplay=1');

    // Canvas mounts.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });

    // HUD renders — confirms the app mounted the play-mode UI, not
    // stuck on the title screen.
    await expect(page.getByTestId('hud-stats')).toBeVisible({ timeout: 15_000 });

    // Distance readout shows a positive number with the "m" suffix.
    // The HUD formats as `distance.toFixed(0)` + " m". We match any
    // non-zero whole-number followed by " m".
    //
    // 30s upper bound: the 1.8s drop-in intro freezes distance. The
    // governor then has to tick a few frames for distance to round up
    // to ≥ 1m. On CI swiftshader a frame can take 200ms+, so give the
    // game 30s to reach the first non-zero rendered distance.
    await expect(page.getByTestId('hud-stats')).toContainText(/[1-9]\d*\s*m/, {
      timeout: 30_000,
    });
  });
});
