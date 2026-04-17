/**
 * Difficulty balance audit.
 *
 * Runs `auditAllDifficulties` against 100 deterministic seeds, writes
 * `docs/telemetry/difficulty-balance.json`, and prints a table to stdout.
 *
 * Usage:  pnpm audit:difficulty
 *
 * Exit code 1 if any tier fails (obstaclesHit > 0 on any seed).
 *
 * Seeds are generated from a deterministic splitmix step so the set is
 * stable across runs and doesn't depend on wall-clock time.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Difficulty } from '../src/game/difficulty';
import type { DifficultyAudit } from '../src/game/difficultyTelemetry';
import { auditAllDifficulties } from '../src/game/difficultyTelemetry';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const SEED_COUNT = 100;

// Deterministic seed list — same splitmix64-style step every run.
function makeSeedList(count: number): number[] {
  let s = 0xdeadbeef_cafebaben;
  const seeds: number[] = [];
  for (let i = 0; i < count; i++) {
    s = BigInt.asUintN(64, s + 0x9e3779b97f4a7c15n);
    seeds.push(Number(BigInt.asUintN(32, s)));
  }
  return seeds;
}

const TIER_ORDER: Difficulty[] = [
  'silly',
  'kazoo',
  'plenty',
  'ultra-honk',
  'nightmare',
  'ultra-nightmare',
];

function padRight(s: string, n: number): string {
  return s.padEnd(n);
}

function padLeft(s: string, n: number): string {
  return s.padStart(n);
}

function fmt2(n: number): string {
  return n.toFixed(2);
}

function printTable(all: Record<Difficulty, DifficultyAudit>): void {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(
    `\n${padRight('Tier', 18)}${padLeft('Speed(m/s)', 12)}${padLeft('Seeds', 8)}${padLeft('Solvable', 10)}${padLeft('PassRate', 10)}${padLeft('Passes', 8)}${padLeft('Hits(mean)', 12)}${padLeft('Hits(max)', 11)}${padLeft('Switches(mean)', 16)}${padLeft('Dev/100m', 10)}`,
  );
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log('─'.repeat(115));
  for (const tier of TIER_ORDER) {
    const a = all[tier];
    const passIcon = a.passes ? '✓' : '✗';
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log(
      `${padRight(tier, 18)}${padLeft(String(a.targetSpeedMps), 12)}${padLeft(String(a.seedCount), 8)}${padLeft(String(a.solvableSeeds), 10)}${padLeft(`${fmt2(a.passRate * 100)}%`, 10)}${padLeft(passIcon, 8)}${padLeft(fmt2(a.aggregated.obstaclesHit.mean), 12)}${padLeft(String(a.aggregated.obstaclesHit.max), 11)}${padLeft(fmt2(a.aggregated.laneSwitches.mean), 16)}${padLeft(fmt2(a.aggregated.deviationDensityPer100m.mean), 10)}`,
    );
  }
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log('');
}

function main(): void {
  const seeds = makeSeedList(SEED_COUNT);
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(`Difficulty balance audit: ${SEED_COUNT} seeds`);
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log('Running abstract solver across all 6 tiers...\n');

  const all = auditAllDifficulties(seeds);

  printTable(all);

  // Write snapshot
  const outDir = join(ROOT, 'docs', 'telemetry');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'difficulty-balance.json');
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        seedCount: SEED_COUNT,
        passThreshold: 1.0,
        tiers: all,
      },
      null,
      2,
    ),
  );
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(`Report written → ${outPath}`);

  // Check overall pass
  const failing = TIER_ORDER.filter((t) => !all[t].passes);
  if (failing.length > 0) {
    console.error(
      `\nBALANCE BUG: tiers that failed (solver could not avoid all obstacles):\n  ${failing.join(', ')}\n`,
    );
    process.exit(1);
  }
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log('All tiers pass. Balance is GOOD.\n');
}

main();
