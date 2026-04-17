import { expect, test } from '@playwright/test';
import { expectNoErrorModal, readDiag, waitForHudReady } from './helpers';

test.describe('Yuka governor autonomous playthrough', () => {
  test.setTimeout(120_000);

  test('autonomous run drives > 300m before game-over or 45s elapsed', async ({ page }) => {
    await page.goto('/?skip=1&governor=1&diag=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page);

    await page.waitForTimeout(5000);
    const s5 = await readDiag(page);
    expect(s5.distance).toBeGreaterThan(10);
    expect(s5.running).toBe(true);
    expect(s5.fps).toBeGreaterThan(25);

    // Wait until either game over OR 40 seconds more (covers both short & long runs)
    const start = Date.now();
    let last = s5;
    while (Date.now() - start < 40_000) {
      await page.waitForTimeout(2000);
      last = await readDiag(page);
      if (last.gameOver) break;
    }
    expect(last.distance).toBeGreaterThan(300);
    // Crashes happen but not at excessive rate (per-meter)
    expect(last.crashes / Math.max(1, last.distance)).toBeLessThan(0.05);
    await expectNoErrorModal(page);
  });

  test('captures screenshots at t=3, t=12, t=25', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.goto('/?skip=1&governor=1&diag=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page); // entry

    await page.waitForTimeout(3000);
    await testInfo.attach('t=3s', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.waitForTimeout(9000);
    await testInfo.attach('t=12s', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.waitForTimeout(13000);
    await testInfo.attach('t=25s', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await expectNoErrorModal(page);
  });
});
