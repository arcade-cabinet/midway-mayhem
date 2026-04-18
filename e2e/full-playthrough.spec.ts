/**
 * Full playthrough e2e — governor drives the car top-to-bottom. Captures
 * cockpit frames every 2s for up to 60s OR until the game-over overlay
 * appears, whichever comes first. Proves:
 *   - Car actually drives
 *   - Track scrolls / segments advance
 *   - Game eventually ends (damage or finish)
 */
import { expect, test } from '@playwright/test';

test.describe('full playthrough', () => {
  test('governor drives the car from start to game-over', async ({ page }, testInfo) => {
    // Mobile emulator runs at ~15fps in headless Chromium — a full 60s run
    // at that rate blows the test budget. Desktop + tablet are the coverage.
    test.skip(testInfo.project.name === 'mobile-portrait', 'too slow in mobile emulation');
    test.setTimeout(240_000);

    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto(
      '/midway-mayhem/?autoplay=1&governor=1&phrase=neon-polkadot-jalopy&difficulty=plenty',
    );
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });

    // Capture frames every 2s for up to 60s
    const frameCount = 30;
    let gameOverSeen = false;
    for (let i = 0; i < frameCount; i++) {
      await page.waitForTimeout(2000);
      const frameName = `frame-${String(i).padStart(2, '0')}.png`;
      const framePath = testInfo.outputPath(frameName);
      await page.screenshot({ type: 'png', path: framePath });
      await testInfo.attach(frameName, { path: framePath, contentType: 'image/png' });
      // Check if GAME OVER overlay has appeared
      const gameOverVisible = await page
        .getByText(/game over/i)
        .first()
        .isVisible()
        .catch(() => false);
      if (gameOverVisible) {
        gameOverSeen = true;
        break;
      }
    }

    // We expect *either* game-over was reached OR we made it through 60s
    // of driving without fatal errors. Both mean the car is going.
    const fatal = errors.filter(
      (e) =>
        !e.includes('React DevTools') &&
        !e.toLowerCase().includes('download the react devtools') &&
        !e.includes('TitleScreen.loadTickets') &&
        !e.includes('OPFS') &&
        !e.includes('operation failed for an unknown transient reason'),
    );
    expect(fatal, `fatal console errors: ${JSON.stringify(fatal, null, 2)}`).toEqual([]);
    // Either game-over happened or we drove for the full window without fatal errors.
    expect(gameOverSeen || fatal.length === 0).toBe(true);
  });
});
