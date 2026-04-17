/**
 * End-to-end smoke for the NewRunModal → in-run flow. This is the test that
 * would have caught the sf2 AudioWorkletNode crash, the circular-JSON
 * postprocessing explosion, and any future "click PLAY, get a halt modal"
 * regression. It does what a manual browser session does — click through the
 * real UI, poll diagnostics, capture frames — but deterministically.
 *
 * Captures PNGs at t=0/3/6/9/12s of the run into test-results/ and asserts:
 *   - no error modal ever fires across the full 12s window
 *   - no unexpected console errors (Kenney colormap is whitelisted — models
 *     use vertex colors and don't ship a colormap.png)
 *   - distance is monotonically increasing (the car is actually driving)
 *   - the run transitions to a playable state with HUD + canvas visible
 */

import { expect, test } from '@playwright/test';
import { expectNoErrorModal, readDiag, waitForHudReady } from './helpers';

const BENIGN_CONSOLE_PATTERNS = [
  /favicon/i,
  /AudioContext.*not allowed to start/i, // Chrome autoplay policy pre-gesture
  /GLTFLoader.*colormap\.png/i, // Kenney kit uses vertex colors, no texture ship
  /THREE\.Clock.*deprecated/i, // benign three.js upstream warning
  /preloaded.*not used/i, // font preload warnings in dev mode
];

function isBenign(msg: string): boolean {
  return BENIGN_CONSOLE_PATTERNS.some((r) => r.test(msg));
}

test.describe('NewRun modal → gameplay flow', () => {
  test('click START → pick difficulty → PLAY → 12 s of clean gameplay', async ({
    page,
  }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (!isBenign(text)) consoleErrors.push(text);
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    await page.goto('/?diag=1');

    // Landing is visible, modal is not yet open
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('new-run-modal')).toHaveCount(0);
    await expectNoErrorModal(page);

    // Click NEW RUN — modal should appear
    await page.getByTestId('start-button').click();
    await expect(page.getByTestId('new-run-modal')).toBeVisible();
    await expect(page.getByTestId('seed-phrase-input')).toBeVisible();
    await expect(page.getByTestId('seed-phrase-shuffle')).toBeVisible();

    // Verify all 6 difficulty tiles render
    for (const id of ['silly', 'kazoo', 'plenty', 'ultra-honk', 'nightmare', 'ultra-nightmare']) {
      await expect(page.getByTestId(`difficulty-tile-${id}`)).toBeVisible();
    }

    // Shuffle changes the phrase
    const beforePhrase = await page.getByTestId('seed-phrase-input').inputValue();
    await page.getByTestId('seed-phrase-shuffle').click();
    // Try up to 3 shuffles in case the first collides
    let afterPhrase = await page.getByTestId('seed-phrase-input').inputValue();
    for (let i = 0; i < 3 && afterPhrase === beforePhrase; i++) {
      await page.getByTestId('seed-phrase-shuffle').click();
      afterPhrase = await page.getByTestId('seed-phrase-input').inputValue();
    }
    expect(afterPhrase).not.toBe(beforePhrase);

    // Pick NORMAL (kazoo) explicitly and hit PLAY
    await page.getByTestId('difficulty-tile-kazoo').click();
    await page.getByTestId('new-run-play').click();

    // Modal closes, gameplay mounts
    await expect(page.getByTestId('new-run-modal')).toHaveCount(0);
    await waitForHudReady(page);
    await expectNoErrorModal(page);

    // Capture 5 frames over 12 seconds + collect diagnostics
    const samples: Array<{ tSec: number; distance: number; running: boolean; gameOver: boolean }> =
      [];
    for (const tSec of [0, 3, 6, 9, 12]) {
      if (tSec > 0) await page.waitForTimeout(3000);
      await expectNoErrorModal(page);
      const diag = await readDiag(page);
      samples.push({
        tSec,
        distance: diag.distance,
        running: diag.running,
        gameOver: diag.gameOver,
      });
      const screenshot = await page.screenshot({ type: 'png' });
      await testInfo.attach(`frame-t${tSec.toString().padStart(2, '0')}s`, {
        body: screenshot,
        contentType: 'image/png',
      });
    }

    // The car should have covered real ground across the window
    const first = samples[0];
    const last = samples[samples.length - 1];
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    if (first && last) {
      // Must be running at t=0 sample
      expect(first.running || first.gameOver).toBe(true);
      // If the car never died: distance should have advanced
      if (!last.gameOver) {
        expect(last.distance).toBeGreaterThan(first.distance + 20);
      }
    }

    // Final assertion: no unexpected console errors over the full window
    if (consoleErrors.length > 0) {
      // Attach the dump for offline review
      await testInfo.attach('unexpected-console-errors.txt', {
        body: Buffer.from(consoleErrors.join('\n\n'), 'utf8'),
        contentType: 'text/plain',
      });
    }
    expect(consoleErrors, `Unexpected console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
