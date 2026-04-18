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
    await page.waitForTimeout(1500); // let fonts + animations settle
    await expect(page).toHaveScreenshot(`title-${testInfo.project.name}.png`, {
      maxDiffPixelRatio: 0.05,
      timeout: 30_000,
      animations: 'disabled',
    });
  });
});

test.describe('new run modal', () => {
  test('open + render', async ({ page }, testInfo) => {
    await page.goto('/midway-mayhem/');
    await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 20_000 });

    // Desktop hero has a testId'd start-button; compact uses NEW RUN text.
    const start = page.getByTestId('start-button');
    if (await start.isVisible().catch(() => false)) {
      await start.click();
    } else {
      await page
        .getByRole('button', { name: /new run/i })
        .first()
        .click();
    }
    await expect(page.getByTestId('difficulty-grid')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    // Canvas scene runs behind the modal; pixel-stable diff is flaky. Clip
    // the screenshot to the modal itself so only the UI matters.
    const modal = page.locator('[data-testid="difficulty-grid"]').locator('..').locator('..');
    await expect(modal).toHaveScreenshot(`new-run-modal-${testInfo.project.name}.png`, {
      maxDiffPixelRatio: 0.05,
      timeout: 30_000,
      animations: 'disabled',
    });
  });
});

test.describe('cockpit — governor autoplay', () => {
  test('cockpit frame after ~2s', async ({ page }, testInfo) => {
    await page.goto('/midway-mayhem/?autoplay=1&governor=1&phrase=neon-polkadot-jalopy');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2000);
    // Live game = pixels never settle. Take a plain screenshot and attach
    // for eyeball review rather than asserting pixel equality; the actual
    // gameplay correctness is covered by seed-playthroughs.spec.ts which
    // asserts on the diag JSON dumps, not screenshot diffs.
    const buf = await page.screenshot({ type: 'png' });
    await testInfo.attach(`cockpit-${testInfo.project.name}.png`, {
      body: buf,
      contentType: 'image/png',
    });
  });
});
