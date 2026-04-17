import { expect, test } from '@playwright/test';
import { expectNoErrorModal, waitForHudReady } from './helpers';

test.describe('Boot sequence', () => {
  test('title screen loads with brand', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByText(/MIDWAY/i)).toBeVisible();
    await expect(page.getByText(/MAYHEM/i)).toBeVisible();
    await expect(page.getByText(/CLOWN CAR CHAOS/i)).toBeVisible();
    await expect(page.getByText(/DRIVE FAST\. HONK LOUDER\./i)).toBeVisible();
    await expect(page.getByTestId('start-button')).toBeVisible();
    await expectNoErrorModal(page);
  });

  test('?skip=1 drops directly into gameplay', async ({ page }) => {
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page);
  });

  test('title START button enters gameplay', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('start-button').click();
    await waitForHudReady(page);
    await expectNoErrorModal(page);
  });

  test('asset preload succeeds — circus_arena HDRI available', async ({
    page,
  }) => {
    const requestedUrls: string[] = [];
    page.on('request', (r) => requestedUrls.push(r.url()));
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    expect(requestedUrls.some((u) => u.includes('circus_arena_2k.hdr'))).toBe(
      true,
    );
    await expectNoErrorModal(page);
  });

  test('no console errors during boot', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    // Tolerate known-harmless upstream warnings; halt on mm:halt, React errors, or own code paths
    const serious = consoleErrors.filter(
      (e) =>
        !/404|favicon|AudioContext/i.test(e) &&
        // Kenney GLBs reference a colormap texture we don't ship — models use vertex colors
        !/GLTFLoader.*colormap\.png/i.test(e),
    );
    expect(serious).toEqual([]);
  });
});
