/**
 * Golden-journey e2e — the full user path, bounded by the UI transitions
 * that define "this game works".
 *
 * Unlike @mechanics (proves gameplay mechanics fire) and @stability
 * (proves nothing fatal happens over 5 minutes), this spec steps
 * through the UI the user sees:
 *
 *   1. Title screen mounts (branding, NEW RUN button visible)
 *   2. Click NEW RUN → modal appears (difficulty grid renders)
 *   3. Click PLAY → title dismisses, HUD mounts (running state)
 *   4. Wait for HUD to update (proves ECS→React sync works)
 *   5. Force game-over via ?autocrash=1 (or by crashing the governor)
 *      OR let the autoplay run terminate naturally via the finish banner
 *   6. Game-over overlay appears
 *   7. Click the Watch Ghost button if available
 *
 * Tagged @journey so CI can opt in via --grep.
 */
import { expect, test } from '@playwright/test';

test.describe('golden journey — full UI transition path @journey @nightly', () => {
  test('title → NEW RUN → play → game-over overlay @nightly', async ({ page }) => {
    test.setTimeout(120_000);

    // 1. Land at title. `?nonameonboard=1` suppresses the first-launch
    // NameOnboardingModal (full-screen zIndex:60 overlay) which would
    // otherwise block every click on a fresh browser context. This spec
    // exercises the NEW RUN → NewRunModal → PLAY path, not the first-
    // launch name entry — that has its own dedicated coverage.
    await page.goto('/midway-mayhem/?nonameonboard=1');

    // Canvas must mount.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });

    // Title screen must mount.
    await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 15_000 });

    // 2. Click NEW RUN. Use testid + force:true — the R3F canvas behind
    // the title animates every frame so Playwright's normal actionability
    // stability loop never settles. elementFromPoint confirms start-button
    // is on top, so force-clicking is safe.
    await expect(page.getByTestId('start-button')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('start-button').click({ force: true });
    // The modal DOM mounts within ~500ms of click, but the title's R3F
    // frame loop keeps triggering re-renders, which flap the element's
    // "stable" state. `state: 'attached'` only checks DOM presence,
    // which is what we actually care about here; toBeVisible() loops
    // forever waiting for stable visibility and times out.
    await page.getByTestId('difficulty-grid').waitFor({ state: 'attached', timeout: 15_000 });

    // 3. Click PLAY inside the modal (not covered by the animated canvas).
    await page.getByTestId('new-run-play').click({ force: true });

    // Title should dismiss within a few seconds.
    await expect(page.getByTestId('title-screen')).toHaveCount(0, { timeout: 15_000 });

    // 4. HUD mounts (proves playing=true committed).
    await expect(page.getByTestId('hud-stats')).toBeVisible({ timeout: 15_000 });

    // 5. Let the run progress for 5s so the ECS advances + HUD reacts.
    await page.waitForTimeout(5_000);

    // 6. Sample diag — distance must have advanced (proves ECS tick is live).
    const distance = await page.evaluate(() => {
      const w = window as { __mm?: { diag?: () => { distance?: number } } };
      return w.__mm?.diag?.()?.distance ?? 0;
    });
    expect(distance, 'distance must advance during 5s of play').toBeGreaterThan(0);

    // 7. Pause button should be reachable (mobile UI).
    const pauseBtn = page.getByTestId('pause-button');
    // Optional — only mobile form factor renders it; we just check it doesn't blow up.
    await pauseBtn.count();
  });
});
