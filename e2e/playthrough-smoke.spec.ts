/**
 * Fast merge-gate boot smoke. Runs across all 3 viewports. Asserts
 * that `?autoplay=1` boots into gameplay — DOM-level signals only.
 *
 * The smoke's job is narrowly scoped:
 *   1. canvas mounts
 *   2. title screen is gone
 *   3. HUD is visible (proves the app committed NewRunConfig + setPlaying)
 *
 * We deliberately do NOT assert that distance > 0. On CI swiftshader
 * runners the GPU stalls enough to make frame progress 3-10× slower
 * than wall clock, so distance can take 60+ seconds to reach 1m even
 * though gameplay is functioning. That's not a useful merge-gate signal —
 * the interesting regressions land on whether the app boots at all.
 *
 * Deep distance / zone progression assertions live in the @nightly
 * suite (`seed-playthroughs.spec.ts`) which has the budget for slow
 * sampling.
 */
import { expect, test } from '@playwright/test';

test.describe('boot smoke — fast merge gate', () => {
  test('autoplay=1 boots into a running game', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/midway-mayhem/?autoplay=1');

    // Canvas mounts.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });

    // Title screen dismisses (autoplay committed + setTitleVisible(false)).
    await expect(page.getByTestId('title-screen')).toHaveCount(0, { timeout: 15_000 });

    // HUD mounts (App only renders HUD when playing=true).
    await expect(page.getByTestId('hud-stats')).toBeVisible({ timeout: 15_000 });
  });
});
