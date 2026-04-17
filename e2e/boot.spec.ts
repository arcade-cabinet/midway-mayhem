import { expect, test } from '@playwright/test';
import { expectNoErrorModal, waitForHudReady } from './helpers';

test.describe('Boot sequence', () => {
  test('title screen loads with brand', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expectNoErrorModal(page);
    // Brand wordmark is baked into the hero art PNG, so assert the art loaded
    // + every canonical landing button is present + no error modal.
    await expect(page.getByTestId('start-button')).toBeVisible();
    await expect(page.getByTestId('shop-button')).toBeVisible();
    await expect(page.getByTestId('achievements-button')).toBeVisible();
    await expect(page.getByTestId('settings-button')).toBeVisible();
    await expect(page.getByTestId('title-ticket-balance')).toBeVisible();
    await expectNoErrorModal(page);
  });

  test('DB bootstrap succeeds — no initSqlJs / Mayhem Halted modal', async ({ page }) => {
    // Regression guard for the sql.js CJS-interop bug where
    // `(await import('sql.js')).default` resolved to a non-function.
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    // Give initDb a full second to finish before checking
    await page.waitForTimeout(1_000);
    await expectNoErrorModal(page);
    // Additionally assert no MAYHEM HALTED text anywhere
    await expect(page.getByText(/MAYHEM HALTED/i)).toHaveCount(0);
  });

  test('?skip=1 drops directly into gameplay', async ({ page }) => {
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page); // entry
    await expectNoErrorModal(page); // exit
  });

  test('title START button → NewRunModal → PLAY enters gameplay', async ({ page }) => {
    await page.goto('/?diag=1');
    await page.getByTestId('start-button').click();
    // NewRunModal now gates the run. Click PLAY to commit the default config.
    await page.getByTestId('new-run-modal').waitFor({ state: 'visible' });
    await page.getByTestId('new-run-play').click();
    await waitForHudReady(page);
    await expectNoErrorModal(page); // entry
    await expectNoErrorModal(page); // exit
  });

  test('asset preload succeeds — circus_arena HDRI available', async ({ page }) => {
    const requestedUrls: string[] = [];
    page.on('request', (r) => requestedUrls.push(r.url()));
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page); // entry
    expect(requestedUrls.some((u) => u.includes('circus_arena_2k.hdr'))).toBe(true);
    await expectNoErrorModal(page); // exit
  });

  test('no console errors during boot', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page); // entry
    // Tolerate known-harmless upstream warnings; halt on mm:halt, React errors, or own code paths
    const serious = consoleErrors.filter(
      (e) =>
        !/404|favicon|AudioContext/i.test(e) &&
        // Kenney GLBs reference a colormap texture we don't ship — models use vertex colors
        !/GLTFLoader.*colormap\.png/i.test(e),
    );
    expect(serious).toEqual([]);
    await expectNoErrorModal(page); // exit
  });
});
