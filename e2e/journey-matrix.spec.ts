/**
 * Cross-viewport player-journey matrix.
 *
 * Playwright's config defines three projects (desktop-chromium,
 * mobile-portrait, tablet-landscape). This spec runs an explicit stage
 * walk on whichever project picks it up — Playwright will invoke it once
 * per project, so after a full CI pass we have a per-viewport journey
 * record with diag dumps + screenshot artifacts.
 *
 * At every stage:
 *   - A screenshot is attached to the Playwright report so the HTML
 *     viewer (gh actions artifacts) shows the full journey.
 *   - The full window.__mm.diag() JSON is dumped to the test log AND
 *     attached as an artifact so CI runs contain a complete state
 *     transcript.
 *
 * This complements the unit-test PlayerJourney.browser.test.tsx (runs
 * inside real Chrome on a local vitest harness) by running against the
 * ACTUAL production preview server — same bundle, same base URL, real
 * Playwright device profiles.
 */
import { expect, type Page, type TestInfo, test } from '@playwright/test';

interface Diag {
  running?: boolean;
  paused?: boolean;
  gameOver?: boolean;
  dropProgress?: number;
  distance?: number;
  fps?: number;
  currentZone?: string;
  lateral?: number;
  steer?: number;
  speedMps?: number;
  [k: string]: unknown;
}

async function captureDiag(page: Page): Promise<Diag> {
  return page.evaluate(() => {
    const w = window as { __mm?: { diag?: () => unknown } };
    const d = w.__mm?.diag?.();
    return (d && typeof d === 'object' ? (d as Record<string, unknown>) : {}) as Diag;
  });
}

async function logStage(page: Page, testInfo: TestInfo, stage: string): Promise<Diag> {
  const d = await captureDiag(page);
  const summary =
    `running=${d.running} paused=${d.paused} gameOver=${d.gameOver} ` +
    `dropProgress=${d.dropProgress?.toFixed(2)} distance=${d.distance?.toFixed(1)} ` +
    `fps=${d.fps?.toFixed(1)} zone=${d.currentZone} lateral=${d.lateral?.toFixed(2)} ` +
    `steer=${d.steer?.toFixed(2)}`;
  // biome-ignore lint/suspicious/noConsole: diagnostic dump is the whole point
  console.log(`[${testInfo.project.name}/journey/${stage}] ${summary}`);
  const shot = await page.screenshot({ type: 'png', fullPage: false });
  await testInfo.attach(`${stage}.png`, { body: shot, contentType: 'image/png' });
  await testInfo.attach(`${stage}.json`, {
    body: Buffer.from(JSON.stringify(d, null, 2)),
    contentType: 'application/json',
  });
  return d;
}

test.describe('journey matrix @nightly', () => {
  test('full stage walk with diag dumps @nightly', async ({ page }, testInfo) => {
    // 5-stage journey with screenshot + diag dump at each step. Headroom
    // for CI swiftshader + contention on the shared runner.
    test.setTimeout(420_000);
    page.on('pageerror', (e) => {
      // biome-ignore lint/suspicious/noConsole: surface runtime errors in journey logs
      console.log(`[${testInfo.project.name}/pageerror] ${String(e).slice(0, 200)}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // biome-ignore lint/suspicious/noConsole: surface runtime console.errors too
        console.log(`[${testInfo.project.name}/console.error] ${msg.text().slice(0, 200)}`);
      }
    });

    // Stage 1: MOUNT — canvas visible.
    await page.goto('/midway-mayhem/?nonameonboard=1');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    await logStage(page, testInfo, 'MOUNT');

    // Stage 2: TITLE — title-screen mounted.
    await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 20_000 });
    await logStage(page, testInfo, 'TITLE');

    // Stage 3: BEFORE_PLAY — click NEW RUN, modal attached.
    await page.getByTestId('start-button').click({ force: true });
    await page.getByTestId('new-run-modal').waitFor({ state: 'attached', timeout: 30_000 });
    await logStage(page, testInfo, 'BEFORE_PLAY');

    // Stage 4: AFTER_PLAY — click PLAY, HUD mounts.
    await page.getByTestId('new-run-play').click({ force: true });
    await expect(page.getByTestId('hud-stats')).toBeVisible({ timeout: 30_000 });
    await logStage(page, testInfo, 'AFTER_PLAY');

    // Stage 5: DRIVING — wait past drop-in, then sample distance twice
    // 3 seconds apart and prove it strictly advanced.
    await page.waitForFunction(
      () => {
        const w = window as { __mm?: { diag?: () => { dropProgress?: number } } };
        return (w.__mm?.diag?.()?.dropProgress ?? 0) >= 1;
      },
      null,
      { timeout: 60_000, polling: 200 },
    );
    const d0 = await captureDiag(page);
    await page.waitForTimeout(3_000);
    const d1 = await captureDiag(page);
    await logStage(page, testInfo, 'DRIVING');
    expect(
      (d1.distance ?? 0) - (d0.distance ?? 0),
      `distance did not advance on ${testInfo.project.name}: ${d0.distance} → ${d1.distance}`,
    ).toBeGreaterThan(0.1);
  });
});
