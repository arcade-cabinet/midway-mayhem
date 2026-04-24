/**
 * E1 — 5-minute autonomous stability soak @nightly
 *
 * Drives the game for 300 seconds via the governor autopilot
 * (?autoplay=1&governor=1&phrase=lightning-kerosene-ferris&difficulty=kazoo)
 * and asserts:
 *   - 0 errorBus events fired  (no MAYHEM HALTED)
 *   - 0 "MAYHEM HALTED" strings visible in the DOM at any point
 *   - fps > 20 at every 10-second heartbeat sample (alive guard)
 *   - runDistance at t=300s > 1000m (autopilot actually drove)
 *
 * On failure the test uploads:
 *   - all per-heartbeat frame dumps (PNG + JSON)
 *   - an errorBus transcript JSON
 *
 * Tag: @nightly — never runs on the PR smoke gate.
 * CI: e2e-nightly.yml stability-soak step runs this file via --grep stability-soak.
 *
 * Reproduce locally:
 *   pnpm build && pnpm exec playwright test --grep stability-soak
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

// ── constants ──────────────────────────────────────────────────────────────

/** Total soak duration in milliseconds. */
const SOAK_DURATION_MS = 300_000;

/** Heartbeat poll interval in milliseconds. */
const HEARTBEAT_MS = 10_000;

/** Minimum fps on a developer machine with real-GPU Chrome (60 fps typical).
 *  "Game is alive" in the ideal case. */
const LOCAL_MIN_FPS = 20;

/** Minimum fps on CI xvfb + swiftshader software WebGL. This scene runs
 *  at ~12–18 fps on swiftshader (vs 55–60 real-GPU). The guard isn't a
 *  performance SLO — it's a proof-of-life that catches 0- or 1-fps zombie
 *  states. 5 is well above the zombie floor and comfortably below the
 *  swiftshader steady-state, even at the slow end of that range. */
const CI_MIN_FPS = 5;

/** End-of-soak distance threshold on a developer machine. */
const LOCAL_MIN_DISTANCE_M = 1000;

/** End-of-soak distance threshold on CI. Swiftshader advances ~3–5× slower;
 *  200 m keeps headroom if we land at the 5× slow end, while still being
 *  enough travel to prove the car wasn't stuck. */
const CI_MIN_DISTANCE_M = 200;

/** Minimum acceptable fps at each heartbeat. */
const MIN_FPS = process.env.CI ? CI_MIN_FPS : LOCAL_MIN_FPS;

/** Minimum distance (metres) the car must have covered at end of soak. */
const MIN_DISTANCE_M = process.env.CI ? CI_MIN_DISTANCE_M : LOCAL_MIN_DISTANCE_M;

/** The canonical E1 soak phrase. */
const SOAK_PHRASE = 'lightning-kerosene-ferris';

/** Difficulty chosen for the soak — kazoo keeps obstacles sparse so the
 *  run survives the full 5 minutes without a difficulty-triggered game-over. */
const SOAK_DIFFICULTY = 'kazoo';

// ── test ───────────────────────────────────────────────────────────────────

test.describe('E1 stability soak @nightly', () => {
  test('5-minute autonomous soak: no MAYHEM HALTED, fps > 20, distance > 1000m @nightly', async ({
    page,
  }, testInfo) => {
    // Desktop-Chromium only — the soak is a stability probe, not a
    // viewport-matrix regression. Mobile viewports are covered by the
    // governor-playthrough + mobile-gameplay nightly specs.
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'E1 stability soak runs on desktop-chromium only',
    );

    // 5-min soak + 90s boot allowance + 30s assertions/cleanup = 390s.
    // Set 480s to give CI swiftshader headroom without timing out.
    test.setTimeout(480_000);

    // ── output directory ────────────────────────────────────────────────
    const outDir = join(testInfo.outputDir, 'stability-soak');
    await mkdir(outDir, { recursive: true });

    // ── error + console listeners ───────────────────────────────────────
    interface ErrorBusEntry {
      kind: 'pageerror' | 'console-error';
      text: string;
      elapsedMs: number;
    }
    const startTs = Date.now();
    const errorBusTranscript: ErrorBusEntry[] = [];

    page.on('pageerror', (err) => {
      errorBusTranscript.push({
        kind: 'pageerror',
        text: String(err),
        elapsedMs: Date.now() - startTs,
      });
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorBusTranscript.push({
          kind: 'console-error',
          text: msg.text(),
          elapsedMs: Date.now() - startTs,
        });
      }
    });

    // ── navigate ────────────────────────────────────────────────────────
    const params = new URLSearchParams({
      autoplay: '1',
      governor: '1',
      phrase: SOAK_PHRASE,
      difficulty: SOAK_DIFFICULTY,
    });
    const url = `/midway-mayhem/?${params.toString()}`;

    await page.goto(url);

    // The app MUST mount — fail immediately rather than silently
    // driving for 5 minutes on a dead page.
    await expect(page.getByTestId('mm-app')).toBeVisible({
      timeout: 30_000,
    });

    // Canvas must be rendering before we start the clock.
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });

    // Hard fail if MAYHEM HALTED appears at boot (before soak begins).
    await expect(page.getByTestId('error-modal-root')).toHaveCount(0, {
      timeout: 5_000,
    });

    // ── heartbeat loop ─────────────────────────────────────────────────
    interface HeartbeatSample {
      heartbeat: number;
      elapsedMs: number;
      fps: number;
      distance: number;
      running: boolean;
      gameOver: boolean;
      halted: boolean;
      screenshotPath: string;
      diagPath: string;
    }

    const heartbeats: HeartbeatSample[] = [];
    const numHeartbeats = Math.floor(SOAK_DURATION_MS / HEARTBEAT_MS);

    for (let i = 0; i < numHeartbeats; i++) {
      await page.waitForTimeout(HEARTBEAT_MS);
      const elapsedMs = Date.now() - startTs;

      // ── collect diagnostics ──────────────────────────────────────────
      const diag = await page.evaluate(() => {
        const w = window as { __mm?: { diag?: () => unknown } };
        try {
          return (w.__mm?.diag?.() as Record<string, unknown>) ?? null;
        } catch {
          return null;
        }
      });

      // ── check for MAYHEM HALTED in DOM ───────────────────────────────
      const modalVisible = await page
        .getByTestId('error-modal-root')
        .isVisible()
        .catch(() => false);

      const fps = typeof diag?.fps === 'number' ? diag.fps : 0;
      const distance = typeof diag?.distance === 'number' ? diag.distance : 0;
      const running = typeof diag?.running === 'boolean' ? diag.running : false;
      const gameOver = typeof diag?.gameOver === 'boolean' ? diag.gameOver : false;

      // ── write frame dump ─────────────────────────────────────────────
      const padded = String(i).padStart(3, '0');
      const pngPath = join(outDir, `heartbeat-${padded}.png`);
      const jsonPath = join(outDir, `heartbeat-${padded}.json`);

      await page.screenshot({ type: 'png', path: pngPath });
      await writeFile(
        jsonPath,
        JSON.stringify(
          {
            heartbeat: i,
            elapsedMs,
            fps,
            distance,
            running,
            gameOver,
            mayhemHaltedVisible: modalVisible,
            diag,
          },
          null,
          2,
        ),
      );

      heartbeats.push({
        heartbeat: i,
        elapsedMs,
        fps,
        distance,
        running,
        gameOver,
        halted: modalVisible,
        screenshotPath: pngPath,
        diagPath: jsonPath,
      });

      // Attach screenshot for Playwright HTML report.
      const shot = await page.screenshot({ type: 'png' });
      await testInfo.attach(`heartbeat-${padded}.png`, {
        body: shot,
        contentType: 'image/png',
      });

      // ── fps alive guard ───────────────────────────────────────────────
      // Assert at every heartbeat so a zombie-state freeze fails fast
      // rather than grinding for the remaining 5 minutes.
      expect(
        fps,
        `fps dropped to ${fps.toFixed(1)} at heartbeat ${i} (t=${(elapsedMs / 1000).toFixed(0)}s) — game appears frozen`,
      ).toBeGreaterThan(MIN_FPS);

      // ── MAYHEM HALTED inline check ───────────────────────────────────
      expect(
        modalVisible,
        `MAYHEM HALTED modal appeared at heartbeat ${i} (t=${(elapsedMs / 1000).toFixed(0)}s)`,
      ).toBe(false);
    }

    // ── post-soak: persist error transcript ────────────────────────────
    await writeFile(
      join(outDir, 'errorBus-transcript.json'),
      JSON.stringify(
        { phrase: SOAK_PHRASE, difficulty: SOAK_DIFFICULTY, entries: errorBusTranscript },
        null,
        2,
      ),
    );

    await writeFile(
      join(outDir, 'summary.json'),
      JSON.stringify(
        {
          phrase: SOAK_PHRASE,
          difficulty: SOAK_DIFFICULTY,
          soakDurationMs: SOAK_DURATION_MS,
          heartbeatCount: heartbeats.length,
          errorBusEntries: errorBusTranscript.length,
          finalDistance: heartbeats[heartbeats.length - 1]?.distance ?? 0,
          finalFps: heartbeats[heartbeats.length - 1]?.fps ?? 0,
          heartbeats,
        },
        null,
        2,
      ),
    );

    // ── final assertions ────────────────────────────────────────────────

    // Filter the same known-harmless noise the factory uses.
    const fatalErrors = errorBusTranscript.filter(
      ({ text }) =>
        !text.includes('React DevTools') &&
        !text.toLowerCase().includes('download the react devtools') &&
        !text.includes('TitleScreen.loadTickets') &&
        !text.includes('OPFS') &&
        !text.includes('operation failed for an unknown transient reason'),
    );

    expect(
      fatalErrors,
      `errorBus emitted ${fatalErrors.length} fatal error(s) during the 5-minute soak`,
    ).toHaveLength(0);

    // DOM-level check: MAYHEM HALTED must not appear in the final state.
    await expect(page.getByTestId('error-modal-root')).toHaveCount(0);

    // Sanity: the autopilot must have actually driven the car.
    const finalDistance = heartbeats[heartbeats.length - 1]?.distance ?? 0;
    expect(
      finalDistance,
      `car only covered ${finalDistance.toFixed(0)}m in 5 minutes — autopilot may not have started`,
    ).toBeGreaterThan(MIN_DISTANCE_M);
  });
});
