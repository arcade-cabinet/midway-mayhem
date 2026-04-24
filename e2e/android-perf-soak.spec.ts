/**
 * E3 — 3-minute Android emulator fps soak @android-perf
 *
 * Targets a running Android emulator (emulator-5554) via adb port-forwarding.
 * The emulator must already be booted and the app served on the preview server
 * (pnpm build && pnpm preview) before this spec runs.
 *
 * Flow:
 *   1. adb forward tcp:5174 tcp:5174   — forward preview server port into emulator
 *   2. Launch Chrome on the emulator pointing to http://localhost:5174/midway-mayhem/
 *   3. Start autonomous governor run (?autoplay=1&governor=1&phrase=…&difficulty=kazoo)
 *   4. Poll window.__mm.diag().fps once per second for 180 seconds
 *   5. Assert: p95 fps >= 40, 0 MAYHEM HALTED events
 *   6. Write perf-android.json artifact to test-results/
 *
 * Tag: @android-perf — separate from @nightly so it never runs on desktop CI
 * where there's no emulator. The CI job in perf-android.yml triggers it
 * manually or on a weekly schedule with an AVD pre-created.
 *
 * Reproduce locally:
 *   # Start emulator first (e.g. emulator -avd Pixel_8_API_35 -no-window &)
 *   # Start preview server: pnpm build && pnpm preview --port 5174
 *   pnpm perf:android
 */

import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, expect, test } from '@playwright/test';

// ── constants ─────────────────────────────────────────────────────────────────

/** Total soak duration in milliseconds. */
const SOAK_DURATION_MS = 180_000;

/** fps sample interval in milliseconds. */
const SAMPLE_INTERVAL_MS = 1_000;

/** p95 fps floor — failing below this triggers test failure. */
const P95_FPS_MIN = 40;

/** Phrase for deterministic content generation. */
const SOAK_PHRASE = 'lightning-kerosene-ferris';

/** adb serial to target — the standard emulator serial. */
const ADB_SERIAL = 'emulator-5554';

/** Host port to forward into the emulator for the preview server. */
const FORWARD_PORT = 5174;

/** Remote debugging port on the emulator — Chrome opens this for CDP. */
const CDP_PORT = 9222;

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Run an adb command against the target emulator using execFileSync (no shell
 * — prevents injection). Returns trimmed stdout.
 */
function adb(...args: string[]): string {
  return execFileSync('adb', ['-s', ADB_SERIAL, ...args], {
    encoding: 'utf-8',
    timeout: 15_000,
  }).trim();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))] ?? 0;
}

// ── test ──────────────────────────────────────────────────────────────────────

test.describe('E3 Android emulator perf soak @android-perf', () => {
  test('3-minute fps soak on emulator-5554: p95 >= 40 fps @android-perf', async ({
    page: _page,
  }, testInfo) => {
    // This test manages its own browser connection via CDP — skip the
    // default Playwright project browser setup.
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'E3 android perf soak uses CDP directly — only runs under desktop-chromium project',
    );

    // Generous timeout: 3-min soak + 90s setup + 60s assertions = 330s.
    test.setTimeout(420_000);

    // ── verify adb + emulator are reachable ──────────────────────────────
    let adbDevices: string;
    try {
      adbDevices = execFileSync('adb', ['devices'], { encoding: 'utf-8', timeout: 10_000 });
    } catch {
      test.skip(true, 'adb not available — skipping E3 android perf soak');
      return;
    }

    if (!adbDevices.includes(ADB_SERIAL)) {
      test.skip(true, `emulator ${ADB_SERIAL} not connected — skipping E3 android perf soak`);
      return;
    }

    // ── output directory ─────────────────────────────────────────────────
    const outDir = join(testInfo.outputDir, 'android-perf-soak');
    await mkdir(outDir, { recursive: true });

    // ── adb port forward: preview server → emulator ──────────────────────
    // Forward the preview server running on the host into the emulator so
    // Chrome inside the emulator can reach http://localhost:5174.
    adb('forward', `tcp:${FORWARD_PORT}`, `tcp:${FORWARD_PORT}`);

    // Forward the CDP remote debugging port out of the emulator so
    // Playwright can connect to Chrome running inside the emulator.
    adb('forward', `tcp:${CDP_PORT}`, 'localabstract:chrome_devtools_remote');

    // Launch Chrome on the emulator with remote debugging enabled.
    const appUrl = `http://localhost:${FORWARD_PORT}/midway-mayhem/?autoplay=1&governor=1&phrase=${SOAK_PHRASE}&difficulty=kazoo`;
    adb(
      'shell',
      'am',
      'start',
      '-n',
      'com.android.chrome/com.google.android.apps.chrome.Main',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      appUrl,
      '--es',
      'com.android.chrome.EXTRA_LAUNCH_FLAGS',
      `--remote-debugging-port=${CDP_PORT}`,
    );

    // Give Chrome time to boot and start the CDP server.
    await new Promise<void>((r) => setTimeout(r, 8_000));

    // ── connect to emulator Chrome via CDP ───────────────────────────────
    const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
    const [context] = browser.contexts();
    if (!context) throw new Error('No browser context from emulator CDP endpoint');
    const pages = context.pages();
    const page = pages[0] ?? (await context.newPage());

    // Navigate in case the am start URL didn't land in the right tab.
    await page.goto(appUrl, { timeout: 30_000 });

    // The app MUST mount — fail immediately rather than soaking 3 minutes on a dead page.
    await expect(page.getByTestId('mm-app')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

    // MAYHEM HALTED must not appear at boot.
    await expect(page.getByTestId('error-modal-root')).toHaveCount(0, { timeout: 5_000 });

    // ── fps sample loop ──────────────────────────────────────────────────
    interface FpsSample {
      elapsedMs: number;
      fps: number;
      distance: number;
      running: boolean;
      gameOver: boolean;
    }

    const samples: FpsSample[] = [];
    const errorBus: string[] = [];
    const startTs = Date.now();

    page.on('pageerror', (err) => {
      errorBus.push(String(err));
    });

    const numSamples = Math.floor(SOAK_DURATION_MS / SAMPLE_INTERVAL_MS);

    for (let i = 0; i < numSamples; i++) {
      await page.waitForTimeout(SAMPLE_INTERVAL_MS);
      const elapsedMs = Date.now() - startTs;

      const diag = await page.evaluate(() => {
        const w = window as { __mm?: { diag?: () => unknown } };
        try {
          return (w.__mm?.diag?.() as Record<string, unknown>) ?? null;
        } catch {
          return null;
        }
      });

      const fps = typeof diag?.fps === 'number' ? (diag.fps as number) : 0;
      const distance = typeof diag?.distance === 'number' ? (diag.distance as number) : 0;
      const running = typeof diag?.running === 'boolean' ? (diag.running as boolean) : false;
      const gameOver = typeof diag?.gameOver === 'boolean' ? (diag.gameOver as boolean) : false;

      samples.push({ elapsedMs, fps, distance, running, gameOver });

      // Inline MAYHEM HALTED guard — fail fast rather than soaking further.
      const halted = await page
        .getByTestId('error-modal-root')
        .isVisible()
        .catch(() => false);
      if (halted) {
        throw new Error(`MAYHEM HALTED modal appeared at t=${(elapsedMs / 1000).toFixed(0)}s`);
      }
    }

    // ── compute p95 / median ─────────────────────────────────────────────
    const sorted = [...samples.map((s) => s.fps)].sort((a, b) => a - b);
    const p95 = percentile(sorted, 95);
    const median = percentile(sorted, 50);
    const minFps = sorted[0] ?? 0;
    const maxFps = sorted[sorted.length - 1] ?? 0;
    const finalDistance = samples[samples.length - 1]?.distance ?? 0;

    // ── write perf-android.json artifact ─────────────────────────────────
    const report = {
      phrase: SOAK_PHRASE,
      soakDurationMs: SOAK_DURATION_MS,
      sampleCount: samples.length,
      p95Fps: p95,
      medianFps: median,
      minFps,
      maxFps,
      finalDistanceM: finalDistance,
      errorBusEntries: errorBus.length,
      samples,
    };

    const reportPath = join(outDir, 'perf-android.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2));

    // Attach to Playwright HTML report for easy inspection.
    await testInfo.attach('perf-android.json', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });

    // ── cleanup ───────────────────────────────────────────────────────────
    await browser.close();

    // Remove port forwards — best-effort, don't fail the test.
    try {
      adb('forward', '--remove', `tcp:${FORWARD_PORT}`);
      adb('forward', '--remove', `tcp:${CDP_PORT}`);
    } catch {
      // Non-fatal — the runner will clean up when the emulator exits.
    }

    // ── assertions ────────────────────────────────────────────────────────
    expect(
      p95,
      `p95 fps ${p95.toFixed(1)} < ${P95_FPS_MIN} — game running below 40 fps on Android emulator`,
    ).toBeGreaterThanOrEqual(P95_FPS_MIN);

    expect(
      errorBus.filter(
        (e) =>
          !e.includes('React DevTools') && !e.toLowerCase().includes('download the react devtools'),
      ),
      'errorBus emitted fatal errors during the 3-minute soak',
    ).toHaveLength(0);

    expect(
      finalDistance,
      `car only covered ${finalDistance.toFixed(0)}m in 3 minutes — autopilot may not have started`,
    ).toBeGreaterThan(300);
  });
});
