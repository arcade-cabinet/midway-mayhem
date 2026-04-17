/**
 * Compare two balance-audit JSON snapshots and print a per-metric delta table.
 *
 * Usage:
 *   pnpm audit:balance:compare <before.json> <after.json>
 *
 * The snapshots are produced by `pnpm audit:balance` into
 * `.claude/state/balance/<timestamp>.json`. Pass any two of them to see what
 * changed across tuning passes.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

interface RunStats {
  runIndex: number;
  maxDistance: number;
  avgSpeed: number;
  crashes: number;
  crowdScore: number;
  gameOverReason: 'sanity' | 'plunge' | 'timeout' | 'unknown';
  durationMs: number;
}

interface AuditSnapshot {
  timestamp: string;
  runs: RunStats[];
}

function loadSnapshot(path: string): AuditSnapshot {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as AuditSnapshot;
  if (!Array.isArray(parsed.runs)) {
    throw new Error(`[compare-balance-audits] ${path}: missing .runs[]`);
  }
  return parsed;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  let sum = 0;
  for (const n of nums) sum += n;
  return sum / nums.length;
}

interface AggregateMetrics {
  avgDistance: number;
  avgSpeed: number;
  avgCrashes: number;
  avgCrowd: number;
  avgDurationMs: number;
  sanityDeaths: number;
  plungeDeaths: number;
  timeouts: number;
}

function aggregate(snapshot: AuditSnapshot): AggregateMetrics {
  const runs = snapshot.runs;
  return {
    avgDistance: avg(runs.map((r) => r.maxDistance)),
    avgSpeed: avg(runs.map((r) => r.avgSpeed)),
    avgCrashes: avg(runs.map((r) => r.crashes)),
    avgCrowd: avg(runs.map((r) => r.crowdScore)),
    avgDurationMs: avg(runs.map((r) => r.durationMs)),
    sanityDeaths: runs.filter((r) => r.gameOverReason === 'sanity').length,
    plungeDeaths: runs.filter((r) => r.gameOverReason === 'plunge').length,
    timeouts: runs.filter((r) => r.gameOverReason === 'timeout').length,
  };
}

function pctDelta(before: number, after: number): string {
  if (before === 0 && after === 0) return '0%';
  if (before === 0) return '+∞';
  const d = ((after - before) / before) * 100;
  const sign = d >= 0 ? '+' : '';
  return `${sign}${d.toFixed(1)}%`;
}

function main(): void {
  const [beforePath, afterPath] = process.argv.slice(2);
  if (!beforePath || !afterPath) {
    // biome-ignore lint/suspicious/noConsole: CLI
    console.error('Usage: pnpm audit:balance:compare <before.json> <after.json>');
    process.exit(1);
  }

  const before = loadSnapshot(beforePath);
  const after = loadSnapshot(afterPath);
  const b = aggregate(before);
  const a = aggregate(after);

  const rows: Array<[string, string, string, string]> = [
    ['Metric', basename(beforePath), basename(afterPath), 'Delta'],
    [
      'avgDistance (m)',
      b.avgDistance.toFixed(1),
      a.avgDistance.toFixed(1),
      pctDelta(b.avgDistance, a.avgDistance),
    ],
    [
      'avgSpeed (m/s)',
      b.avgSpeed.toFixed(2),
      a.avgSpeed.toFixed(2),
      pctDelta(b.avgSpeed, a.avgSpeed),
    ],
    [
      'avgCrashes',
      b.avgCrashes.toFixed(2),
      a.avgCrashes.toFixed(2),
      pctDelta(b.avgCrashes, a.avgCrashes),
    ],
    ['avgCrowd', b.avgCrowd.toFixed(0), a.avgCrowd.toFixed(0), pctDelta(b.avgCrowd, a.avgCrowd)],
    [
      'avgDuration (s)',
      (b.avgDurationMs / 1000).toFixed(1),
      (a.avgDurationMs / 1000).toFixed(1),
      pctDelta(b.avgDurationMs, a.avgDurationMs),
    ],
    [
      'sanity deaths',
      String(b.sanityDeaths),
      String(a.sanityDeaths),
      `${a.sanityDeaths - b.sanityDeaths}`,
    ],
    [
      'plunge deaths',
      String(b.plungeDeaths),
      String(a.plungeDeaths),
      `${a.plungeDeaths - b.plungeDeaths}`,
    ],
    ['timeouts', String(b.timeouts), String(a.timeouts), `${a.timeouts - b.timeouts}`],
  ];

  const widths: [number, number, number, number] = [0, 0, 0, 0];
  for (const row of rows) {
    for (let i = 0; i < 4; i++) {
      const cell = row[i] ?? '';
      widths[i] = Math.max(widths[i] ?? 0, cell.length);
    }
  }

  // biome-ignore lint/suspicious/noConsole: CLI
  console.log('');
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const padded = row.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ');
    // biome-ignore lint/suspicious/noConsole: CLI
    console.log(padded);
    if (r === 0) {
      // biome-ignore lint/suspicious/noConsole: CLI
      console.log(widths.map((w) => '─'.repeat(w)).join('  '));
    }
  }
  // biome-ignore lint/suspicious/noConsole: CLI
  console.log('');
}

main();
