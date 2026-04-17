/**
 * Balance-audit script.
 * Launches headless Playwright, runs 5 autonomous governor sessions (each capped
 * at 45 s), collects per-run stats from window.__mm.diag(), writes a timestamped
 * JSON report to .claude/state/balance/<timestamp>.json, and prints a human-
 * readable summary to stdout.
 *
 * Usage:  pnpm audit:balance
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const BASE_URL = process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:4175/midway-mayhem';
const RUN_COUNT = 5;
const RUN_DURATION_MS = 45_000;
const POLL_INTERVAL_MS = 1_000;

interface RunStats {
  runIndex: number;
  maxDistance: number;
  avgSpeed: number;
  crashes: number;
  crowdScore: number;
  gameOverReason: 'sanity' | 'plunge' | 'timeout' | 'unknown';
  durationMs: number;
}

interface DiagSnapshot {
  distance: number;
  speedMps: number;
  crashes: number;
  crowdReaction: number;
  gameOver: boolean;
  running: boolean;
  sanity: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

async function runOnce(runIndex: number): Promise<RunStats> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--use-angle=default',
      '--enable-features=WebGL,WebGL2',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--mute-audio',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/?skip=1&governor=1&diag=1`, { timeout: 30_000 });

    // Wait for HUD — indicates R3F scene is live
    await page.waitForSelector('[data-testid="hud"]', { state: 'visible', timeout: 30_000 });

    const start = Date.now();
    const speedSamples: number[] = [];
    let last: DiagSnapshot = {
      distance: 0,
      speedMps: 0,
      crashes: 0,
      crowdReaction: 0,
      gameOver: false,
      running: false,
      sanity: 100,
    };

    while (Date.now() - start < RUN_DURATION_MS) {
      await page.waitForTimeout(POLL_INTERVAL_MS);

      const snap = await page.evaluate<DiagSnapshot>(() => {
        // biome-ignore lint/suspicious/noExplicitAny: diag bridge
        const mm = (window as any).__mm;
        if (!mm?.diag) throw new Error('window.__mm.diag unavailable');
        const d = mm.diag() as DiagSnapshot;
        return {
          distance: d.distance,
          speedMps: d.speedMps,
          crashes: d.crashes,
          crowdReaction: d.crowdReaction,
          gameOver: d.gameOver,
          running: d.running,
          sanity: d.sanity,
        };
      });

      last = snap;
      if (snap.running && !snap.gameOver) {
        speedSamples.push(snap.speedMps);
      }
      if (snap.gameOver) break;
    }

    const durationMs = Date.now() - start;
    const avgSpeed =
      speedSamples.length > 0 ? speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length : 0;

    let gameOverReason: RunStats['gameOverReason'] = 'timeout';
    if (last.gameOver) {
      if (last.sanity <= 0) gameOverReason = 'sanity';
      else gameOverReason = 'plunge';
    }

    return {
      runIndex,
      maxDistance: last.distance,
      avgSpeed,
      crashes: last.crashes,
      crowdScore: last.crowdReaction,
      gameOverReason,
      durationMs,
    };
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(`Balance audit: ${RUN_COUNT} runs × ${RUN_DURATION_MS / 1000}s each`);
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(`Base URL: ${BASE_URL}\n`);

  const runs: RunStats[] = [];
  for (let i = 0; i < RUN_COUNT; i++) {
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log(`  Run ${i + 1}/${RUN_COUNT}…`);
    const stats = await runOnce(i);
    runs.push(stats);
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log(
      `    dist=${stats.maxDistance.toFixed(0)}m  avgSpd=${stats.avgSpeed.toFixed(1)}m/s  crashes=${stats.crashes}  crowd=${stats.crowdScore}  reason=${stats.gameOverReason}  t=${(stats.durationMs / 1000).toFixed(1)}s`,
    );
  }

  // Aggregate p50 / p95
  function agg(key: keyof Omit<RunStats, 'runIndex' | 'gameOverReason'>): {
    p50: number;
    p95: number;
  } {
    const sorted = runs.map((r) => r[key] as number).sort((a, b) => a - b);
    return { p50: percentile(sorted, 50), p95: percentile(sorted, 95) };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    runCount: RUN_COUNT,
    runDurationS: RUN_DURATION_MS / 1000,
    runs,
    aggregated: {
      maxDistance: agg('maxDistance'),
      avgSpeed: agg('avgSpeed'),
      crashes: agg('crashes'),
      crowdScore: agg('crowdScore'),
      durationMs: agg('durationMs'),
    },
    gameOverReasons: Object.fromEntries(
      (['sanity', 'plunge', 'timeout', 'unknown'] as const).map((r) => [
        r,
        runs.filter((s) => s.gameOverReason === r).length,
      ]),
    ),
  };

  const outDir = join(ROOT, '.claude', 'state', 'balance');
  mkdirSync(outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(outDir, `${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log('\n--- Summary ---');
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(
    `  maxDist   p50=${report.aggregated.maxDistance.p50.toFixed(0)}m   p95=${report.aggregated.maxDistance.p95.toFixed(0)}m`,
  );
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(
    `  avgSpeed  p50=${report.aggregated.avgSpeed.p50.toFixed(1)}m/s p95=${report.aggregated.avgSpeed.p95.toFixed(1)}m/s`,
  );
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(
    `  crashes   p50=${report.aggregated.crashes.p50}   p95=${report.aggregated.crashes.p95}`,
  );
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(
    `  crowd     p50=${report.aggregated.crowdScore.p50}   p95=${report.aggregated.crowdScore.p95}`,
  );
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(
    `  reasons   sanity=${report.gameOverReasons.sanity}  plunge=${report.gameOverReasons.plunge}  timeout=${report.gameOverReasons.timeout}`,
  );
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(`\nReport written → ${outPath}`);
}

main().catch((err: unknown) => {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.error('Balance audit failed:', err);
  process.exit(1);
});
