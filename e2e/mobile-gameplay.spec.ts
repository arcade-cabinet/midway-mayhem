/**
 * Mobile-first gameplay e2e. Midway Mayhem ships as a Capacitor app on
 * iOS + Android; these tests simulate the real mobile surface in headless
 * Chromium (Pixel 7 device preset) and assert the critical interaction
 * paths work:
 *   - title renders with the mobile compact layout
 *   - NEW RUN → NewRunModal → PLAY starts the game
 *   - HUD is visible during the run
 *   - TouchControls render (HONK button, thumb-steering zone)
 *   - autoplay seed run advances deterministically
 *
 * Every failure here is a mobile regression — the thing Capacitor
 * will ship. Desktop is the dev UX; mobile is the product.
 */
import { expect, test } from '@playwright/test';

test.describe('mobile-first gameplay', () => {
  test('title compact layout + ticket balance render', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-portrait', 'mobile-only');
    await page.goto('/midway-mayhem/');
    await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('title-ticket-balance')).toBeVisible();
    await expect(page.getByTestId('title-square-logo')).toBeVisible();
  });

  test('NEW RUN → modal → PLAY transitions into the running game', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-portrait', 'mobile-only');
    await page.goto('/midway-mayhem/');
    await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 20_000 });

    // Both TitleCompactLayout and TitleHeroLayout testId the NEW RUN
    // button as 'start-button' — use that directly for reliability.
    await expect(page.getByTestId('start-button')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('start-button').click();
    await expect(page.getByTestId('new-run-play')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('new-run-play').click();

    // Title is gone, canvas + HUD visible
    await expect(page.getByTestId('title-screen')).toHaveCount(0);
    await expect(page.locator('canvas').first()).toBeVisible();
    // HUD contains the word HYPE or SANITY somewhere
    await expect(page.getByText(/hype|sanity/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('touch controls render during a run', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-portrait', 'mobile-only');
    await page.goto('/midway-mayhem/?autoplay=1');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });

    // HONK button (in TouchControls, visible only once playing)
    await expect(page.getByRole('button', { name: /honk/i })).toBeVisible({ timeout: 10_000 });
  });

  test('autoplay advances deterministically on mobile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-portrait', 'mobile-only');
    test.setTimeout(90_000);
    await page.goto('/midway-mayhem/?autoplay=1&governor=1&phrase=neon-polkadot-jalopy');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });

    // Sample the diag at t=3s and t=9s and confirm distance increased.
    await page.waitForTimeout(3000);
    const d3 = await page.evaluate(() => {
      const d = (window as { __mm?: { diag?: () => { distance?: number } } }).__mm?.diag?.();
      return typeof d?.distance === 'number' ? d.distance : 0;
    });

    await page.waitForTimeout(6000);
    const d9 = await page.evaluate(() => {
      const d = (window as { __mm?: { diag?: () => { distance?: number } } }).__mm?.diag?.();
      return typeof d?.distance === 'number' ? d.distance : 0;
    });

    expect(d9, `mobile run distance at 9s (${d9}) > 3s (${d3})`).toBeGreaterThan(d3);
    expect(d9, 'mobile run moved at least 15m in 9s').toBeGreaterThan(15);
  });
});
