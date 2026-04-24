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

/** Total soak duration in milliseconds. Locally we run the full 5-min
 *  soak (with fast real-GPU Chrome); on CI we cut to 2 min because each
 *  heartbeat cycle takes ~20-30s on swiftshader (screenshot + page.evaluate
 *  + disk write) and the 5-min soak was overrunning the 15-min test cap.
 *  The goal is "alive under load for a sustained window" — 2 min is
 *  plenty to catch regressions without burning 15 min of runner time. */
const SOAK_DURATION_MS = process.env.CI ? 120_000 : 300_000;

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

    // 5-min soak + boot + per-heartbeat screenshots (slow on swiftshader).
    // On CI each heartbeat's screenshot can take 10-15s, which across 30
    // heartbeats adds 5-8 minutes on top of the 5-minute soak itself.
    // 900s cap keeps us inside the 20-min job timeout with comfortable
    // headroom; local runs finish in ~6 minutes and never reach this.
    test.setTimeout(900_000);

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

    // Cap each text capture and the total entry count so a runaway logger
    // cannot balloon the process. A 5-min soak with a misbehaving log can
    // easily produce > 100k messages; retaining even 500 bytes each is
    // enough to matter. We keep the most recent entries + a dropped-count.
    const MAX_ERRORBUS_ENTRIES = 500;
    const MAX_MSG_LEN = 500;
    let errorBusDropped = 0;
    const pushErrorBus = (entry: ErrorBusEntry): void => {
      if (errorBusTranscript.length >= MAX_ERRORBUS_ENTRIES) {
        errorBusTranscript.shift();
        errorBusDropped += 1;
      }
      errorBusTranscript.push({ ...entry, text: entry.text.slice(0, MAX_MSG_LEN) });
    };

    const onPageError = (err: Error): void => {
      pushErrorBus({
        kind: 'pageerror',
        text: String(err),
        elapsedMs: Date.now() - startTs,
      });
    };
    const onConsole = (msg: { type: () => string; text: () => string }): void => {
      if (msg.type() === 'error') {
        pushErrorBus({
          kind: 'console-error',
          text: msg.text(),
          elapsedMs: Date.now() - startTs,
        });
      }
    };
    page.on('pageerror', onPageError);
    page.on('console', onConsole);

    try {
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

      // Keep only summary stats + the LAST heartbeat in memory. Previously
      // we accumulated every heartbeat (screenshot paths + diag + timestamps)
      // in a growing array — 30 entries × full diag × 5-min soak under worker
      // retry turned into a multi-MB leak. Each heartbeat still writes its
      // full dump to disk, so post-mortem scrubbing isn't affected.
      let heartbeatCount = 0;
      let minFpsSeen = Infinity;
      let maxDistanceSeen = 0;
      let lastHeartbeat: HeartbeatSample | null = null;
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

        lastHeartbeat = {
          heartbeat: i,
          elapsedMs,
          fps,
          distance,
          running,
          gameOver,
          halted: modalVisible,
          screenshotPath: pngPath,
          diagPath: jsonPath,
        };
        heartbeatCount += 1;
        if (fps < minFpsSeen) minFpsSeen = fps;
        if (distance > maxDistanceSeen) maxDistanceSeen = distance;

        // Attach PNG we just wrote to disk as an HTML-report attachment —
        // reusing the file skips a second screenshot call (each screenshot
        // is ~10s on CI swiftshader, and across 30 heartbeats the
        // redundant second shot was pushing total runtime past 8 minutes).
        await testInfo.attach(`heartbeat-${padded}.png`, {
          path: pngPath,
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
          {
            phrase: SOAK_PHRASE,
            difficulty: SOAK_DIFFICULTY,
            entries: errorBusTranscript,
            droppedOlderEntries: errorBusDropped,
          },
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
            heartbeatCount,
            errorBusEntries: errorBusTranscript.length,
            errorBusDropped,
            minFpsSeen: minFpsSeen === Infinity ? null : minFpsSeen,
            maxDistanceSeen,
            finalDistance: lastHeartbeat?.distance ?? 0,
            finalFps: lastHeartbeat?.fps ?? 0,
            lastHeartbeat,
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
      const finalDistance = lastHeartbeat?.distance ?? 0;
      expect(
        finalDistance,
        `car only covered ${finalDistance.toFixed(0)}m in 5 minutes — autopilot may not have started`,
      ).toBeGreaterThan(MIN_DISTANCE_M);
    } finally {
      // Detach listeners + close the page even if an assertion inside the
      // heartbeat loop threw. Playwright would normally reap on worker
      // teardown, but retries + long soaks meant the page sometimes held
      // multiple MB of listener-closure state between retries.
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
      await page.close().catch(() => {});
    }
  });
});
