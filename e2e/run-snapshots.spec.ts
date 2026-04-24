/**
 * Periodic full-run snapshotter.
 *
 * Drives a full autoplay run and captures a PNG + diag JSON at a fixed
 * wall-clock interval until either the run ends or a hard time cap is
 * reached. Attaches everything to the Playwright report so that an entire
 * playthrough is a browsable strip of screenshots + state dumps — no more
 * guessing whether the cockpit looks right in zone 3 at 400m.
 *
 * Tag is @snapshots (not @nightly) so it is opt-in via:
 *   pnpm exec playwright test -g "periodic run snapshots"
 * or with `--grep @snapshots`.
 *
 * Output structure (inside the Playwright HTML report):
 *   <project>/t000.png  t000.json
 *   <project>/t003.png  t003.json
 *   ...
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
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
  obstacleCount?: number;
  obstacleByKind?: Record<string, number>;
  pickupCount?: number;
  pickupByKind?: Record<string, number>;
  sanity?: number;
  ecsDamage?: number;
  scaresThisRun?: number;
  [k: string]: unknown;
}

function kindsToStr(kinds?: Record<string, number>): string {
  if (!kinds) return '{}';
  const entries = Object.entries(kinds).filter(([, n]) => n > 0);
  if (entries.length === 0) return '{}';
  return entries.map(([k, n]) => `${k}:${n}`).join(',');
}

const SNAPSHOT_INTERVAL_MS = 3_000;
const MAX_WALL_CLOCK_MS = 180_000;

async function captureDiag(page: Page): Promise<Diag> {
  return page.evaluate(() => {
    const w = window as { __mm?: { diag?: () => unknown } };
    const d = w.__mm?.diag?.();
    return (d && typeof d === 'object' ? (d as Record<string, unknown>) : {}) as Diag;
  });
}

function formatDiag(d: Diag): string {
  return (
    `drop=${d.dropProgress?.toFixed(2)} dist=${d.distance?.toFixed(1)} ` +
    `zone=${d.currentZone} spd=${d.speedMps?.toFixed(1)} fps=${d.fps?.toFixed(1)} ` +
    `lat=${d.lateral?.toFixed(2)} sanity=${d.sanity?.toFixed(0)} ` +
    `dmg=${d.ecsDamage} scares=${d.scaresThisRun} ` +
    `ob[${d.obstacleCount}]=${kindsToStr(d.obstacleByKind)} ` +
    `pu[${d.pickupCount}]=${kindsToStr(d.pickupByKind)}`
  );
}

async function snap(page: Page, testInfo: TestInfo, label: string): Promise<Diag> {
  const d = await captureDiag(page);
  // biome-ignore lint/suspicious/noConsole: full-run transcript is the point
  console.log(`[${testInfo.project.name}/${label}] ${formatDiag(d)}`);
  const shot = await page.screenshot({ type: 'png', fullPage: false });
  await testInfo.attach(`${label}.png`, { body: shot, contentType: 'image/png' });
  await testInfo.attach(`${label}.json`, {
    body: Buffer.from(JSON.stringify(d, null, 2)),
    contentType: 'application/json',
  });
  // Also write to a stable on-disk location so a human (or an agent) can
  // scrub the full run without unpacking the HTML report.
  const outDir = path.join(
    testInfo.project.outputDir ?? testInfo.outputDir,
    '..',
    '__run-snapshots__',
    testInfo.project.name,
  );
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${label}.png`), shot);
  fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify(d, null, 2));
  return d;
}

test.describe('periodic run snapshots @snapshots', () => {
  test('full run with snapshot every 3s @snapshots', async ({ page }, testInfo) => {
    test.setTimeout(MAX_WALL_CLOCK_MS + 120_000);

    page.on('pageerror', (e) => {
      // biome-ignore lint/suspicious/noConsole: surface runtime errors into run log
      console.log(`[${testInfo.project.name}/pageerror] ${String(e).slice(0, 200)}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // biome-ignore lint/suspicious/noConsole: surface runtime console.errors too
        console.log(`[${testInfo.project.name}/console.error] ${msg.text().slice(0, 200)}`);
      }
    });
    // Capture every failed request so 404s name the URL, not just the status.
    page.on('response', (resp) => {
      if (resp.status() >= 400) {
        // biome-ignore lint/suspicious/noConsole: surface 4xx/5xx with full URL
        console.log(`[${testInfo.project.name}/http.${resp.status()}] ${resp.url()}`);
      }
    });

    // `?autoplay=1` — TitleScreen commits a NewRunConfig on boot, so we
    // skip the whole menu walk and go straight into driving.
    await page.goto('/midway-mayhem/?autoplay=1&nonameonboard=1');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

    await snap(page, testInfo, 't000-mount');

    // HUD mount confirms the autoplay actually started a run.
    await expect(page.getByTestId('hud-stats')).toBeVisible({ timeout: 45_000 });
    await snap(page, testInfo, 't001-hud');

    // Wait through the drop-in animation, then begin periodic sampling.
    await page.waitForFunction(
      () => {
        const w = window as { __mm?: { diag?: () => { dropProgress?: number } } };
        return (w.__mm?.diag?.()?.dropProgress ?? 0) >= 1;
      },
      null,
      { timeout: 60_000, polling: 200 },
    );

    const start = Date.now();
    let lastDistance = -Infinity;
    let stuckTicks = 0;
    let idx = 2;
    for (;;) {
      const elapsed = Date.now() - start;
      if (elapsed > MAX_WALL_CLOCK_MS) {
        // biome-ignore lint/suspicious/noConsole: end marker in run log
        console.log(`[${testInfo.project.name}/cap] hit max wall clock at ${elapsed}ms`);
        break;
      }
      const label = `t${String(idx).padStart(3, '0')}-${Math.floor(elapsed / 1000)}s`;
      const d = await snap(page, testInfo, label);

      if (d.gameOver === true) {
        // biome-ignore lint/suspicious/noConsole: run ended — final marker
        console.log(`[${testInfo.project.name}/gameover] run ended at dist=${d.distance}`);
        break;
      }

      // Distance advance watchdog — 3 consecutive ticks without advance
      // means the run stalled. Snap once more and break so we can see it.
      const dist = d.distance ?? 0;
      if (dist - lastDistance < 0.5) {
        stuckTicks += 1;
      } else {
        stuckTicks = 0;
      }
      lastDistance = dist;
      if (stuckTicks >= 3) {
        // biome-ignore lint/suspicious/noConsole: stall marker
        console.log(`[${testInfo.project.name}/stalled] distance stuck at ${dist}`);
        await snap(page, testInfo, `t${String(idx + 1).padStart(3, '0')}-STALL`);
        break;
      }

      await page.waitForTimeout(SNAPSHOT_INTERVAL_MS);
      idx += 1;
    }

    // Final summary shot no matter how we exited the loop.
    await snap(page, testInfo, 'tFINAL');
  });
});
