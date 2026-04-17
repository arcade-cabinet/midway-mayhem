/**
 * Frame-time profiler.
 *
 * Launches Playwright with governor + skip flags, polls window.__mm.diag()
 * every 250ms for 30 seconds, collects frameTimeMs samples, then computes
 * p50/p95/p99 and budget violations.
 *
 * Thresholds:
 *   p95 frame time ≤ 20 ms on desktop (headless)
 *
 * Budget violation markers:
 *   > 16.67 ms — missed 60 fps frame
 *   > 33.33 ms — missed 30 fps frame
 *
 * Writes docs/media/frametime/latest.md + timestamped json.
 * Exits 1 if p95 > 20 ms.
 *
 * Usage: pnpm audit:frametime
 * CI:    run after build, under xvfb on Linux
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const BASE_URL = process.env.PROFILE_BASE_URL ?? 'http://127.0.0.1:4175/midway-mayhem';
const SAMPLE_INTERVAL_MS = 250;
const PROFILE_DURATION_MS = 30_000;
const WARMUP_DURATION_MS = 5_000;

// Fail if p95 exceeds this on desktop headless
const P95_THRESHOLD_MS = 20;
const BUDGET_60FPS_MS = 1000 / 60; // ~16.67
const BUDGET_30FPS_MS = 1000 / 30; // ~33.33

interface DiagSnapshot {
  frameTimeMs: number;
  fps: number;
  running: boolean;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function writeReport(
  samples: number[],
  p50: number,
  p95: number,
  p99: number,
  violations60: number,
  violations30: number,
): { jsonPath: string; mdPath: string } {
  const outDir = join(ROOT, 'docs', 'media', 'frametime');
  mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const passed = p95 <= P95_THRESHOLD_MS;

  const report = {
    generatedAt: new Date().toISOString(),
    sampleCount: samples.length,
    profileDurationS: PROFILE_DURATION_MS / 1000,
    warmupDurationS: WARMUP_DURATION_MS / 1000,
    p50Ms: Math.round(p50 * 100) / 100,
    p95Ms: Math.round(p95 * 100) / 100,
    p99Ms: Math.round(p99 * 100) / 100,
    budget60FpsMs: BUDGET_60FPS_MS,
    budget30FpsMs: BUDGET_30FPS_MS,
    violations60fps: violations60,
    violations30fps: violations30,
    p95ThresholdMs: P95_THRESHOLD_MS,
    passed,
  };

  const jsonPath = join(outDir, `${timestamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const statusStr = passed
    ? 'PASS'
    : `**FAIL** (p95 ${p95.toFixed(2)} ms > ${P95_THRESHOLD_MS} ms)`;

  const md = [
    '---',
    'title: Frame-Time Profile',
    `updated: ${new Date().toISOString().slice(0, 10)}`,
    'status: current',
    'domain: quality',
    '---',
    '',
    '# Frame-Time Profile — Latest',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Samples: ${samples.length} (${PROFILE_DURATION_MS / 1000}s at ${SAMPLE_INTERVAL_MS}ms intervals, ${WARMUP_DURATION_MS / 1000}s warmup excluded)`,
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| p50 frame time | ${p50.toFixed(2)} ms |`,
    `| p95 frame time | ${p95.toFixed(2)} ms |`,
    `| p99 frame time | ${p99.toFixed(2)} ms |`,
    `| 60fps violations (>16.67ms) | ${violations60} / ${samples.length} (${((violations60 / Math.max(1, samples.length)) * 100).toFixed(1)}%) |`,
    `| 30fps violations (>33.33ms) | ${violations30} / ${samples.length} (${((violations30 / Math.max(1, samples.length)) * 100).toFixed(1)}%) |`,
    `| p95 threshold | ${P95_THRESHOLD_MS} ms |`,
    `| Status | ${statusStr} |`,
    '',
    `Full JSON: ${jsonPath}`,
  ].join('\n');

  const mdPath = join(outDir, 'latest.md');
  writeFileSync(mdPath, md);

  return { jsonPath, mdPath };
}

async function main(): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log('Frame-time profiler starting...');
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(`URL: ${BASE_URL}/?skip=1&governor=1&diag=1`);
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(
    `Warmup: ${WARMUP_DURATION_MS / 1000}s  Profile: ${PROFILE_DURATION_MS / 1000}s  Interval: ${SAMPLE_INTERVAL_MS}ms\n`,
  );

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

    // Wait for HUD (R3F scene ready)
    await page.waitForSelector('[data-testid="hud"]', { state: 'visible', timeout: 30_000 });
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log('Scene loaded. Warming up...');

    // Warmup phase — discard samples
    const warmupEnd = Date.now() + WARMUP_DURATION_MS;
    while (Date.now() < warmupEnd) {
      await page.waitForTimeout(SAMPLE_INTERVAL_MS);
    }

    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log('Collecting samples...');
    const samples: number[] = [];
    const profileEnd = Date.now() + PROFILE_DURATION_MS;

    while (Date.now() < profileEnd) {
      await page.waitForTimeout(SAMPLE_INTERVAL_MS);

      const snap = await page.evaluate<DiagSnapshot | null>(() => {
        // biome-ignore lint/suspicious/noExplicitAny: diag bridge
        const mm = (window as any).__mm;
        if (!mm?.diag) return null;
        const d = mm.diag() as DiagSnapshot;
        return {
          frameTimeMs: d.frameTimeMs,
          fps: d.fps,
          running: d.running,
        };
      });

      if (snap && snap.frameTimeMs > 0) {
        samples.push(snap.frameTimeMs);
      }
    }

    if (samples.length === 0) {
      throw new Error('No frameTimeMs samples collected — is the game running?');
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const p99 = percentile(sorted, 99);
    const violations60 = samples.filter((t) => t > BUDGET_60FPS_MS).length;
    const violations30 = samples.filter((t) => t > BUDGET_30FPS_MS).length;

    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log(`\n  Samples collected: ${samples.length}`);
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log(`  p50 frame time:  ${p50.toFixed(2)} ms`);
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log(`  p95 frame time:  ${p95.toFixed(2)} ms  (threshold: ${P95_THRESHOLD_MS} ms)`);
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log(`  p99 frame time:  ${p99.toFixed(2)} ms`);
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log(
      `  60fps violations: ${violations60} (${((violations60 / samples.length) * 100).toFixed(1)}%)`,
    );
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log(
      `  30fps violations: ${violations30} (${((violations30 / samples.length) * 100).toFixed(1)}%)`,
    );

    const { jsonPath, mdPath } = writeReport(samples, p50, p95, p99, violations60, violations30);
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log(`\nReport written → ${jsonPath}`);
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log(`Summary   → ${mdPath}`);

    if (p95 > P95_THRESHOLD_MS) {
      console.error(
        `\nFrame-time p95 FAILED: ${p95.toFixed(2)} ms > ${P95_THRESHOLD_MS} ms threshold`,
      );
      process.exit(1);
    } else {
      // biome-ignore lint/suspicious/noConsole: CLI script
      console.log('\nFrame-time budget met.');
    }
  } finally {
    await browser.close();
  }
}

main().catch((err: unknown) => {
  console.error('profile-frametime fatal:', err);
  process.exit(1);
});
