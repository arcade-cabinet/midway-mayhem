/**
 * Visual-regression e2e — screenshots each titlescreen + panel across
 * 3 form factors (desktop, phone-portrait, tablet-landscape). Playwright
 * writes baselines to __screenshots__/ on first run; subsequent runs
 * compare pixel-by-pixel.
 *
 * Use `pnpm e2e:update` to refresh baselines after intentional UI changes.
 */
import { expect, test } from '@playwright/test';

test.describe('title screen', () => {
  test('renders at the current viewport', async ({ page }, testInfo) => {
    await page.goto('/midway-mayhem/');
    await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800); // let fonts + animations settle
    await expect(page).toHaveScreenshot(`title-${testInfo.project.name}.png`, {
      maxDiffPixelRatio: 0.03,
      animations: 'disabled',
    });
  });
});

test.describe('new run modal', () => {
  test('open + render', async ({ page }, testInfo) => {
    await page.goto('/midway-mayhem/');
    await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 20_000 });

    // Desktop hero has a testId'd start-button; compact layout doesn't —
    // tap the NEW RUN text in either case.
    await page.getByRole('button', { name: /new run/i }).first().click();

    await expect(page.getByTestId('difficulty-grid')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(`new-run-modal-${testInfo.project.name}.png`, {
      maxDiffPixelRatio: 0.03,
      animations: 'disabled',
    });
  });
});

test.describe('cockpit — governor autoplay', () => {
  test('cockpit frame after ~2s', async ({ page }, testInfo) => {
    await page.goto('/midway-mayhem/?autoplay=1&governor=1&phrase=neon-polkadot-jalopy');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot(`cockpit-${testInfo.project.name}.png`, {
      maxDiffPixelRatio: 0.08, // 3D rendering is naturally jittery
      animations: 'disabled',
    });
  });
});
