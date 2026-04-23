#!/usr/bin/env -S npx tsx
/**
 * audit-perf.ts — gzipped critical-path bundle budget gate
 *
 * Walks dist/assets/*.js, computes gzip size of each chunk, classifies
 * each as "critical" (initial load) or "lazy" (dynamic import), then
 * enforces:
 *   - critical path gzip total < 2 048 KB  (PRQ E4)
 *   - full bundle gzip total   < 5 120 KB
 *
 * Emits perf-budget.json next to dist/ and, when running in CI,
 * appends a Markdown summary to $GITHUB_STEP_SUMMARY.
 *
 * Exit 0 = pass.  Exit 1 = budget exceeded.
 */
import { createReadStream, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createGzip } from 'node:zlib';

// ── Budget constants ────────────────────────────────────────────────────────
const BUDGET_CRITICAL_KB = 2048; // PRQ E4 target
const BUDGET_TOTAL_KB = 5120;

// ── Chunk name helpers ──────────────────────────────────────────────────────

/**
 * Vite names entry chunks "index-<hash>.js" and vendor manual-chunks by
 * their key ("three-<hash>.js", "r3f-<hash>.js", "react-<hash>.js" …).
 * Dynamic-import-only chunks get a numeric or descriptor hash with no
 * recognisable prefix matching the manualChunks keys.
 *
 * "Critical" = must be downloaded before first interactive frame:
 *   index chunk + the five vendor chunks split out in vite.config.ts.
 */
const CRITICAL_PREFIXES = ['index-', 'three-', 'r3f-', 'tone-', 'react-', 'koota-'];

function isCritical(filename: string): boolean {
  return CRITICAL_PREFIXES.some((prefix) => filename.startsWith(prefix));
}

// ── Gzip helper ─────────────────────────────────────────────────────────────

function gzipSize(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const src = createReadStream(filePath);
    const gz = createGzip({ level: 9 });

    src.on('error', reject);
    gz.on('error', reject);
    gz.on('data', (chunk: Buffer) => {
      size += chunk.length;
    });
    gz.on('end', () => resolve(size));

    src.pipe(gz);
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ChunkResult {
  name: string;
  rawKB: number;
  gzipKB: number;
  critical: boolean;
}

interface BudgetReport {
  totalGzipKB: number;
  criticalGzipKB: number;
  chunks: ChunkResult[];
  budget: { critical: number; total: number };
  passed: boolean;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const distAssets = resolve('dist/assets');

  if (!existsSync(distAssets)) {
    console.error('dist/assets not found — run `pnpm build` first');
    process.exit(1);
  }

  const jsFiles = readdirSync(distAssets).filter((f) => f.endsWith('.js'));

  if (jsFiles.length === 0) {
    console.error('No JS chunks found in dist/assets');
    process.exit(1);
  }

  // Measure every chunk — hard-fail if any measurement throws
  const chunks: ChunkResult[] = [];
  for (const filename of jsFiles) {
    const filePath = resolve(distAssets, filename);
    const rawBytes = statSync(filePath).size;

    // Hard-fail: no silent catches — each measurement must succeed
    const gzipBytes = await gzipSize(filePath);

    chunks.push({
      name: filename,
      rawKB: rawBytes / 1024,
      gzipKB: gzipBytes / 1024,
      critical: isCritical(filename),
    });
  }

  // Sort largest-gzip-first for readability
  chunks.sort((a, b) => b.gzipKB - a.gzipKB);

  const totalGzipKB = chunks.reduce((sum, c) => sum + c.gzipKB, 0);
  const criticalGzipKB = chunks.filter((c) => c.critical).reduce((sum, c) => sum + c.gzipKB, 0);

  const passed = criticalGzipKB <= BUDGET_CRITICAL_KB && totalGzipKB <= BUDGET_TOTAL_KB;

  const report: BudgetReport = {
    totalGzipKB: Math.round(totalGzipKB * 10) / 10,
    criticalGzipKB: Math.round(criticalGzipKB * 10) / 10,
    chunks: chunks.map((c) => ({
      ...c,
      rawKB: Math.round(c.rawKB * 10) / 10,
      gzipKB: Math.round(c.gzipKB * 10) / 10,
    })),
    budget: { critical: BUDGET_CRITICAL_KB, total: BUDGET_TOTAL_KB },
    passed,
  };

  // Write JSON report
  writeFileSync('perf-budget.json', JSON.stringify(report, null, 2));
  console.log('Written perf-budget.json');

  // Console summary
  console.log('\n── Bundle Perf Budget ──────────────────────────────────');
  console.log(
    `  Critical gzip: ${report.criticalGzipKB.toFixed(1)} KB  (budget: ${BUDGET_CRITICAL_KB} KB)`,
  );
  console.log(
    `  Total gzip:    ${report.totalGzipKB.toFixed(1)} KB  (budget: ${BUDGET_TOTAL_KB} KB)`,
  );
  console.log('\n  Top 5 chunks by gzip size:');
  chunks.slice(0, 5).forEach((c) => {
    const tag = c.critical ? '[critical]' : '[lazy]    ';
    console.log(`    ${tag}  ${c.gzipKB.toFixed(1).padStart(8)} KB  ${c.name}`);
  });
  console.log('────────────────────────────────────────────────────────\n');

  // GitHub step summary
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const statusIcon = passed ? '✅' : '❌';
    const critStatus = criticalGzipKB <= BUDGET_CRITICAL_KB ? '✅' : '❌';
    const totalStatus = totalGzipKB <= BUDGET_TOTAL_KB ? '✅' : '❌';

    const mdLines: string[] = [
      `## ${statusIcon} Bundle Perf Budget`,
      '',
      '| Metric | Actual | Budget | Status |',
      '|--------|--------|--------|--------|',
      `| Critical path (gzip) | ${report.criticalGzipKB.toFixed(1)} KB | ${BUDGET_CRITICAL_KB} KB | ${critStatus} |`,
      `| Total bundle (gzip)  | ${report.totalGzipKB.toFixed(1)} KB | ${BUDGET_TOTAL_KB} KB | ${totalStatus} |`,
      '',
      '### Top 5 chunks by gzip size',
      '',
      '| Chunk | Raw KB | Gzip KB | Type |',
      '|-------|--------|---------|------|',
      ...chunks
        .slice(0, 5)
        .map(
          (c) =>
            `| \`${c.name}\` | ${c.rawKB.toFixed(1)} | ${c.gzipKB.toFixed(1)} | ${c.critical ? 'critical' : 'lazy'} |`,
        ),
      '',
    ];

    // Node's fs.appendFileSync works fine; avoid importing extra modules
    const { appendFileSync } = await import('node:fs');
    appendFileSync(summaryPath, mdLines.join('\n'));
    console.log('Written GitHub step summary');
  }

  if (!passed) {
    if (criticalGzipKB > BUDGET_CRITICAL_KB) {
      console.error(
        `FAIL: critical path ${report.criticalGzipKB.toFixed(1)} KB exceeds budget of ${BUDGET_CRITICAL_KB} KB`,
      );
    }
    if (totalGzipKB > BUDGET_TOTAL_KB) {
      console.error(
        `FAIL: total bundle ${report.totalGzipKB.toFixed(1)} KB exceeds budget of ${BUDGET_TOTAL_KB} KB`,
      );
    }
    process.exit(1);
  }

  console.log('PASS: all budgets met');
}

// Re-export gzipSize so the unit test can import it without running main()
export { gzipSize };

// Only run when invoked directly (tsx scripts/audit-perf.ts), not when
// imported by a test. ESM doesn't have require.main; check argv instead.
if (process.argv[1]?.endsWith('audit-perf.ts') || process.argv[1]?.endsWith('audit-perf.js')) {
  main().catch((err: unknown) => {
    console.error('audit-perf fatal error:', err);
    process.exit(1);
  });
}
