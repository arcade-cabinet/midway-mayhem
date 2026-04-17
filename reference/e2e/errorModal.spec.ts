import { expect, test } from '@playwright/test';
import { expectNoErrorModal, waitForHudReady } from './helpers';

test.describe('Error modal', () => {
  test('does not appear during a clean run', async ({ page }) => {
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page); // entry
    await page.waitForTimeout(2000);
    await expectNoErrorModal(page); // exit
  });

  test('missing HDRI asset triggers modal with specific path', async ({ page }) => {
    // Intercept the HDRI request to return 404, simulating a deploy miss
    await page.route('**/circus_arena_2k.hdr', (route) => {
      route.fulfill({ status: 404, body: 'not found' });
    });
    await page.goto('/?skip=1');
    await expect(page.getByTestId('error-modal')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId('error-modal-context')).toHaveText(/preloadAllAssets/);
    await expect(page.getByTestId('error-modal-message')).toContainText('circus_arena_2k.hdr');
    // Copy-report + reload buttons exist
    await expect(page.getByTestId('error-modal-copy')).toBeVisible();
    await expect(page.getByTestId('error-modal-reload')).toBeVisible();
  });
});
