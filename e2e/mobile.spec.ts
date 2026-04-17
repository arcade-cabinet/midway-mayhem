import { expect, test } from '@playwright/test';
import { expectNoErrorModal, waitForHudReady } from './helpers';

test.describe('Mobile portrait', () => {
  test('boots and renders HUD at portrait aspect ratio', async ({ page }) => {
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page); // entry
    const vp = page.viewportSize();
    expect(vp).toBeTruthy();
    if (vp) expect(vp.height).toBeGreaterThan(vp.width); // portrait
    await expectNoErrorModal(page);
  });

  test('HONK button is reachable at portrait safe-area', async ({ page }) => {
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page); // entry
    await expect(page.getByTestId('honk-button')).toBeVisible();
    await page.getByTestId('honk-button').tap();
    await expectNoErrorModal(page);
  });
});
