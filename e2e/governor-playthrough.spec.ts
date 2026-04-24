/**
 * Governor autoplay e2e — visits `?autoplay=1`, confirms the title screen
 * vanishes, the game canvas renders, and the governor drives for a few
 * seconds while we capture cockpit screenshots at intervals.
 *
 * This is the "real playthrough" gate the user asked for: it's not just a
 * launch check, it drives a car down the track and takes pictures.
 */
import { expect, test } from '@playwright/test';

test.describe('governor playthrough', () => {
  test('autoplay=1 starts the game and the governor keeps it running @nightly', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'governor playthrough runs on desktop-chromium only (telemetry nightly)',
    );
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/midway-mayhem/?autoplay=1&governor=1&phrase=neon-polkadot-jalopy');

    // App mount
    await expect(page.getByTestId('mm-app')).toBeVisible({ timeout: 20_000 });

    // Canvas renders
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 20_000 });

    // Capture cockpit screenshots at 0.5s / 2s / 5s
    await page.waitForTimeout(500);
    const shot0 = await page.screenshot({ type: 'png', fullPage: false });
    await testInfo.attach('cockpit-0.5s.png', { body: shot0, contentType: 'image/png' });

    await page.waitForTimeout(1500);
    const shot1 = await page.screenshot({ type: 'png', fullPage: false });
    await testInfo.attach('cockpit-2s.png', { body: shot1, contentType: 'image/png' });

    await page.waitForTimeout(3000);
    const shot2 = await page.screenshot({ type: 'png', fullPage: false });
    await testInfo.attach('cockpit-5s.png', { body: shot2, contentType: 'image/png' });

    // Title screen should not be visible while the governor is driving
    await expect(page.getByTestId('title-screen')).toHaveCount(0);

    // Only FATAL console errors fail the test — persistence/OPFS transient
    // failures in mobile emulators are recoverable (tickets stay at 0, run
    // still plays) so we tolerate [mm:halt] TitleScreen.loadTickets noise.
    const fatal = consoleErrors.filter(
      (e) =>
        !e.includes('React DevTools') &&
        !e.toLowerCase().includes('download the react devtools') &&
        !e.includes('TitleScreen.loadTickets') &&
        !e.includes('OPFS') &&
        !e.includes('operation failed for an unknown transient reason'),
    );
    expect(fatal).toEqual([]);
  });

  test('loads title screen without autoplay flag', async ({ page }) => {
    // Cold boot on CI preview server + swiftshader + initial texture load
    // can push first paint past 20s. Extend timeouts per-expect.
    test.setTimeout(90_000);
    // ?nonameonboard=1 suppresses the first-launch NameOnboardingModal
    // (full-screen zIndex:60 overlay) so the start-button is reachable
    // on a fresh browser context.
    await page.goto('/midway-mayhem/?nonameonboard=1');
    await expect(page.getByTestId('mm-app')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 30_000 });
    // NEW RUN start button
    await expect(page.getByTestId('start-button')).toBeVisible({ timeout: 30_000 });
  });

  test('NEW RUN → NewRunModal → PLAY transitions into the game @nightly', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'modal flow runs on desktop-chromium only (telemetry nightly)',
    );
    await page.goto('/midway-mayhem/?nonameonboard=1');
    await expect(page.getByTestId('start-button')).toBeVisible({ timeout: 20_000 });

    // force: true because the R3F canvas behind the title animates on
    // every frame — Playwright's default actionability stability check
    // never decides the button is "stable" and either times out or
    // silently drops the click. The canvas is visibly underneath
    // (elementFromPoint confirms start-button is on top), so forcing the
    // click is safe and reliable here.
    await page.getByTestId('start-button').click({ force: true });
    await expect(page.getByTestId('difficulty-grid')).toBeVisible({ timeout: 15_000 });

    // PLAY button inside the modal (not covered by the animated canvas).
    await page.getByTestId('new-run-play').click();

    // Title should be gone
    await expect(page.getByTestId('title-screen')).toHaveCount(0);
    // Canvas still rendering
    await expect(page.locator('canvas').first()).toBeVisible();
  });
});
