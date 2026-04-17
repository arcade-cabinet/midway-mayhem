/**
 * Bundle-size budget gate.
 *
 * Reads dist/assets/*.js and *.css, gzips each file in-memory, compares
 * against budgets. Prints a markdown table, writes docs/media/bundle-size/
 * latest.md + timestamped json. Exits 1 if any budget is exceeded.
 *
 * Budget table (gzipped KB):
 *   total               ≤ 700 KB
 *   three-vendor chunk  ≤ 400 KB
 *   audio-vendor chunk  ≤ 160 KB
 *   r3f-vendor chunk    ≤ 400 KB
 *   app chunk (index)   ≤ 150 KB
 *   css                 ≤   5 KB
 *
 * Note: "three" imports are currently bundled into r3f-vendor. The three-vendor
 * budget is evaluated only when a three-vendor-*.js chunk is present; otherwise
 * it is skipped with a WARN so CI still passes until the chunk is split out.
 *
 * Usage:  pnpm audit:bundle
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const DIST_ASSETS = join(ROOT, 'dist', 'assets');

const KB = 1024;

interface BudgetLine {
  label: string;
  /**
   * Pattern function: receives the filename, returns true when this file
   * should be counted toward this budget line.
   */
  match: (name: string) => boolean;
  /** Aggregate all matching files (true) or pick the largest single match (false) */
  aggregate: boolean;
  maxKb: number;
  /** When false, skip the check (emit WARN) if no matching file is found */
  required: boolean;
}

const BUDGET: BudgetLine[] = [
  {
    label: 'three-vendor chunk',
    match: (n) => n.startsWith('three-vendor') && n.endsWith('.js'),
    aggregate: false,
    maxKb: 400,
    required: false, // currently merged into r3f-vendor — skip when absent
  },
  {
    label: 'audio-vendor chunk',
    match: (n) => n.startsWith('audio-vendor') && n.endsWith('.js'),
    aggregate: false,
    maxKb: 160,
    required: true,
  },
  {
    label: 'r3f-vendor chunk',
    match: (n) => n.startsWith('r3f-vendor') && n.endsWith('.js'),
    aggregate: false,
    maxKb: 400,
    required: true,
  },
  {
    label: 'app chunk (index)',
    match: (n) => n.startsWith('index-') && n.endsWith('.js'),
    aggregate: false,
    maxKb: 150,
    required: true,
  },
  {
    label: 'css',
    match: (n) => n.endsWith('.css'),
    aggregate: true,
    maxKb: 5,
    required: true,
  },
  // Total is computed separately below
];

interface BudgetResult {
  label: string;
  files: string[];
  gzKb: number;
  maxKb: number;
  status: 'PASS' | 'FAIL' | 'WARN';
  note?: string;
}

function gzKbOf(filePath: string): number {
  const raw = readFileSync(filePath);
  const gz = gzipSync(raw, { level: 9 });
  return gz.length / KB;
}

function evaluate(): { results: BudgetResult[]; totalGzKb: number; totalPassed: boolean } {
  const files = readdirSync(DIST_ASSETS).filter((n) => !n.endsWith('.map'));

  const results: BudgetResult[] = [];

  for (const line of BUDGET) {
    const matching = files.filter(line.match);

    if (matching.length === 0) {
      results.push({
        label: line.label,
        files: [],
        gzKb: 0,
        maxKb: line.maxKb,
        status: line.required ? 'FAIL' : 'WARN',
        note: line.required
          ? 'No matching file found — check build output'
          : 'Chunk absent (skipped)',
      });
      continue;
    }

    let gzKb: number;
    let usedFiles: string[];
    if (line.aggregate) {
      usedFiles = matching;
      gzKb = matching.reduce((sum, n) => sum + gzKbOf(join(DIST_ASSETS, n)), 0);
    } else {
      // Largest single chunk
      const withSizes = matching.map((n) => ({ name: n, gzKb: gzKbOf(join(DIST_ASSETS, n)) }));
      withSizes.sort((a, b) => b.gzKb - a.gzKb);
      // withSizes is non-empty (matching.length > 0 check above)
      // biome-ignore lint/style/noNonNullAssertion: array is guaranteed non-empty (matching.length > 0)
      const top = withSizes[0]!;
      usedFiles = [top.name];
      gzKb = top.gzKb;
    }

    const passed = gzKb <= line.maxKb;
    results.push({
      label: line.label,
      files: usedFiles,
      gzKb,
      maxKb: line.maxKb,
      status: passed ? 'PASS' : 'FAIL',
    });
  }

  // Total: sum of all non-map JS + CSS
  const totalGzKb = files
    .filter((n) => n.endsWith('.js') || n.endsWith('.css'))
    .reduce((sum, n) => sum + gzKbOf(join(DIST_ASSETS, n)), 0);

  const totalPassed = totalGzKb <= 700;

  return { results, totalGzKb, totalPassed };
}

function writeReport(
  results: BudgetResult[],
  totalGzKb: number,
  totalPassed: boolean,
): { jsonPath: string; mdPath: string } {
  const outDir = join(ROOT, 'docs', 'media', 'bundle-size');
  mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const allPassed = results.every((r) => r.status !== 'FAIL') && totalPassed;

  const report = {
    generatedAt: new Date().toISOString(),
    totalGzKb: Math.round(totalGzKb * 10) / 10,
    totalBudgetKb: 700,
    totalPassed,
    lines: results.map((r) => ({
      label: r.label,
      files: r.files,
      gzKb: Math.round(r.gzKb * 10) / 10,
      maxKb: r.maxKb,
      status: r.status,
      note: r.note,
    })),
    passed: allPassed,
  };

  const jsonPath = join(outDir, `${timestamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // Markdown table
  const rows = [
    `| Total (all JS+CSS) | — | ${totalGzKb.toFixed(1)} KB | 700 KB | ${totalPassed ? 'PASS' : '**FAIL**'} |`,
    ...results.map((r) => {
      const status = r.status === 'FAIL' ? `**${r.status}**` : r.status;
      const gzStr = r.status === 'WARN' ? '—' : `${r.gzKb.toFixed(1)} KB`;
      const note = r.note ? ` (${r.note})` : '';
      return `| ${r.label} | ${r.files.join(', ') || '—'} | ${gzStr} | ${r.maxKb} KB | ${status}${note} |`;
    }),
  ];

  const md = [
    '---',
    'title: Bundle Size Budget',
    `updated: ${new Date().toISOString().slice(0, 10)}`,
    'status: current',
    'domain: quality',
    '---',
    '',
    '# Bundle Size Budget — Latest',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Budget Line | Files | Gzipped Size | Budget | Status |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    `Full JSON: ${jsonPath}`,
  ].join('\n');

  const mdPath = join(outDir, 'latest.md');
  writeFileSync(mdPath, md);

  return { jsonPath, mdPath };
}

function main(): void {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log('Bundle budget check...\n');
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(`Reading dist: ${DIST_ASSETS}\n`);

  const { results, totalGzKb, totalPassed } = evaluate();

  // Print table
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(
    `${'Budget Line'.padEnd(24)} ${'Gzipped'.padStart(10)} ${'Budget'.padStart(10)}  Status`,
  );
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log('-'.repeat(65));

  const totalStatus = totalPassed ? 'PASS' : 'FAIL';
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(
    `${'TOTAL'.padEnd(24)} ${`${totalGzKb.toFixed(1)} KB`.padStart(10)} ${'700 KB'.padStart(10)}  ${totalStatus}`,
  );

  for (const r of results) {
    const gzStr = r.status === 'WARN' ? '      —' : `${r.gzKb.toFixed(1)} KB`.padStart(10);
    const note = r.note ? ` (${r.note})` : '';
    const line = `${r.label.padEnd(24)} ${gzStr} ${`${r.maxKb} KB`.padStart(10)}  ${r.status}${note}`;
    if (r.status === 'FAIL') {
      console.error(line);
    } else {
      // biome-ignore lint/suspicious/noConsole: CLI script
      console.log(line);
    }
  }

  const { jsonPath, mdPath } = writeReport(results, totalGzKb, totalPassed);
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(`\nReport written → ${jsonPath}`);
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(`Summary   → ${mdPath}`);

  const anyFailed = results.some((r) => r.status === 'FAIL') || !totalPassed;
  if (anyFailed) {
    console.error('\nBundle budget FAILED — see violations above');
    process.exit(1);
  } else {
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log('\nAll bundle budgets met.');
  }
}

main();
