import { expect, test } from '@playwright/test';
import { expectNoErrorModal } from './helpers';

test.describe('Big Top Tour', () => {
  test('tour button is present on title screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('tour-button')).toBeVisible();
    await expectNoErrorModal(page);
  });

  test('enter tour, walk forward 5s, verify no errors, screenshot', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tour-button').click();

    // Wait for tour scene to mount
    await expect(page.getByTestId('bigtop-tour')).toBeVisible({ timeout: 15_000 });
    await expectNoErrorModal(page); // entry

    // Walk forward 5 seconds (W key held down — no pointer lock needed)
    await page.keyboard.down('w');
    await page.waitForTimeout(5_000);
    await page.keyboard.up('w');

    await expectNoErrorModal(page); // after walk

    // Screenshot
    await expect(page).toHaveScreenshot('bigtop-tour-walk.png', {
      maxDiffPixels: 500,
    });

    await expectNoErrorModal(page); // exit
  });

  test('ESC exits tour back to title', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tour-button').click();
    await expect(page.getByTestId('bigtop-tour')).toBeVisible({ timeout: 15_000 });
    await expectNoErrorModal(page);

    // ESC without pointer lock should exit
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 5_000 });
    await expectNoErrorModal(page);
  });

  test('EXIT button exits tour back to title', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tour-button').click();
    await expect(page.getByTestId('bigtop-tour')).toBeVisible({ timeout: 15_000 });
    await expectNoErrorModal(page);

    await page.getByTestId('tour-exit-button').click();
    await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 5_000 });
    await expectNoErrorModal(page);
  });
});
