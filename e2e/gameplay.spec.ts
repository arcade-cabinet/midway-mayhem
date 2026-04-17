import { expect, test } from '@playwright/test';
import { expectNoErrorModal, readDiag, waitForHudReady } from './helpers';

test.describe('Gameplay mechanics', () => {
  test('distance increases over time during free-play', async ({ page }) => {
    await page.goto('/?skip=1&diag=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page); // entry
    const before = await readDiag(page);
    await page.waitForTimeout(2000);
    const after = await readDiag(page);
    expect(after.distance).toBeGreaterThan(before.distance);
    await expectNoErrorModal(page);
  });

  test('pointer steering moves the player laterally', async ({ page }) => {
    await page.goto('/?skip=1&diag=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page); // entry
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas missing');

    // Move mouse hard right (desktop: pointer X position maps to steering)
    const cy = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.9, cy);
    await page.waitForTimeout(800);
    const right = await readDiag(page);
    await page.mouse.move(box.x + box.width * 0.1, cy);
    await page.waitForTimeout(800);
    const left = await readDiag(page);
    expect(right.lateral).toBeGreaterThan(left.lateral);
    await expectNoErrorModal(page);
  });

  test('HONK button is clickable', async ({ page }) => {
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page); // entry
    await page.getByTestId('honk-button').click();
    await expectNoErrorModal(page);
  });

  test('HUD fields update as run progresses', async ({ page }) => {
    await page.goto('/?skip=1&governor=1&diag=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page); // entry
    await page.waitForTimeout(5000);
    const stats = page.getByTestId('hud-stats');
    await expect(stats).toContainText(/\d+m/); // distance shown
    await expectNoErrorModal(page);
  });
});
