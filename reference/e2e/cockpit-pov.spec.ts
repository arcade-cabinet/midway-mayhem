import { test } from '@playwright/test';
import { waitForHudReady } from './helpers';

// Debug-only: capture the actual cockpit POV so we can eyeball artifacts.
// Not a regression test — screenshots go to test-results/ and are inspected
// manually during polish passes. Run with:
//   pnpm exec playwright test --project gameplay-desktop cockpit-pov

test.describe('Cockpit POV capture (debug)', () => {
  test('settled cockpit at 2.5s', async ({ page }, testInfo) => {
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    await page.waitForTimeout(2500);
    await testInfo.attach('cockpit-settled', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('mid-drop at 0.9s (cockpit-only, obstacles not yet spawned)', async ({ page }, testInfo) => {
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    await page.waitForTimeout(900);
    await testInfo.attach('cockpit-mid-drop', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('long settled at 3.5s (shows track + obstacles)', async ({ page }, testInfo) => {
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    await page.waitForTimeout(3500);
    await testInfo.attach('cockpit-long', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
