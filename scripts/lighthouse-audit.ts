/**
 * Lighthouse audit script.
 *
 * Launches `pnpm preview` on port 4175, waits for the server to respond,
 * then runs Lighthouse against both the base page and the gameplay route
 * (?skip=1) on desktop and mobile form factors.
 *
 * Thresholds:
 *   desktop: performance ≥ 80, accessibility ≥ 80, best-practices ≥ 80, seo ≥ 80
 *   mobile:  performance ≥ 70, accessibility ≥ 70, best-practices ≥ 70, seo ≥ 70
 *
 * Writes docs/media/lighthouse/<timestamp>.json + latest.md.
 * Exits 1 if any threshold is breached.
 *
 * Usage:  pnpm audit:lighthouse
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const PORT = 4175;
const BASE = `http://127.0.0.1:${PORT}/midway-mayhem`;

// Thresholds: [desktop, mobile]
const THRESHOLDS: Record<string, [number, number]> = {
  performance: [80, 70],
  accessibility: [80, 70],
  'best-practices': [80, 70],
  seo: [80, 70],
};

interface CategoryScore {
  score: number | null;
}

interface LHResult {
  categories: Record<string, CategoryScore>;
  requestedUrl: string;
  finalDisplayedUrl: string;
  audits: Record<string, { score: number | null; displayValue?: string }>;
}

interface RunResult {
  url: string;
  formFactor: 'desktop' | 'mobile';
  scores: Record<string, number>;
  passed: boolean;
  violations: string[];
}

function waitForPort(port: number, timeout = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    function attempt() {
      const client = createConnection({ port, host: '127.0.0.1' });
      client.on('connect', () => {
        client.destroy();
        resolve();
      });
      client.on('error', () => {
        client.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Port ${port} not ready after ${timeout}ms`));
        } else {
          setTimeout(attempt, 300);
        }
      });
    }
    attempt();
  });
}

async function startPreviewServer(): Promise<ChildProcess> {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log('Starting pnpm preview on port', PORT);
  const child = spawn('pnpm', ['preview', '--port', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  child.stdout?.on('data', (d: Buffer) => {
    const line = d.toString().trim();
    if (line) process.stdout.write(`  [preview] ${line}\n`);
  });
  child.stderr?.on('data', (d: Buffer) => {
    const line = d.toString().trim();
    if (line) process.stderr.write(`  [preview] ${line}\n`);
  });
  return child;
}

async function runLighthouse(url: string, formFactor: 'desktop' | 'mobile'): Promise<RunResult> {
  // Dynamic import to avoid top-level chrome-launcher resolution issues
  const { default: lighthouse, desktopConfig } = await import('lighthouse');
  const chromeLauncher = await import('chrome-launcher');

  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--mute-audio',
    ],
  });

  try {
    const flags: Record<string, unknown> = {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      formFactor,
      screenEmulation: formFactor === 'mobile' ? undefined : { disabled: true },
      throttlingMethod: 'simulate',
    };

    const config = formFactor === 'desktop' ? desktopConfig : undefined;

    const result = (await lighthouse(url, flags, config)) as { lhr: LHResult } | undefined;
    if (!result) throw new Error(`Lighthouse returned no result for ${url} (${formFactor})`);

    const { lhr } = result;
    const scores: Record<string, number> = {};
    for (const [cat, data] of Object.entries(lhr.categories)) {
      scores[cat] = Math.round((data.score ?? 0) * 100);
    }

    const violations: string[] = [];
    const thresholdIdx = formFactor === 'desktop' ? 0 : 1;
    for (const [cat, [desktop, mobile]] of Object.entries(THRESHOLDS)) {
      const threshold = thresholdIdx === 0 ? desktop : mobile;
      const score = scores[cat] ?? 0;
      if (score < threshold) {
        violations.push(`${cat}: ${score} < ${threshold} (${formFactor})`);
      }
    }

    return { url, formFactor, scores, passed: violations.length === 0, violations };
  } finally {
    await chrome.kill();
  }
}

function writeReport(runs: RunResult[]): { jsonPath: string; mdPath: string } {
  const outDir = join(ROOT, 'docs', 'media', 'lighthouse');
  mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const report = {
    generatedAt: new Date().toISOString(),
    thresholds: THRESHOLDS,
    runs,
    passed: runs.every((r) => r.passed),
  };

  const jsonPath = join(outDir, `${timestamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // Build markdown summary table
  const cats = Object.keys(THRESHOLDS);
  const header = `| URL | Form Factor | ${cats.join(' | ')} | Pass |`;
  const sep = `| --- | --- | ${cats.map(() => '---').join(' | ')} | --- |`;
  const rows = runs.map((r) => {
    const scores = cats.map((c) => {
      const s = r.scores[c] ?? 0;
      // THRESHOLDS[c] always exists — cats comes from Object.keys(THRESHOLDS)
      // biome-ignore lint/style/noNonNullAssertion: key comes from Object.keys(THRESHOLDS)
      const [d, m] = THRESHOLDS[c]!;
      const threshold = r.formFactor === 'desktop' ? d : m;
      return s >= threshold ? `${s}` : `**${s}** ⚠`;
    });
    const shortUrl = r.url.replace(`http://127.0.0.1:${PORT}`, '');
    return `| ${shortUrl} | ${r.formFactor} | ${scores.join(' | ')} | ${r.passed ? 'PASS' : 'FAIL'} |`;
  });

  const md = [
    '---',
    'title: Lighthouse Audit',
    `updated: ${new Date().toISOString().slice(0, 10)}`,
    'status: current',
    'domain: quality',
    '---',
    '',
    '# Lighthouse Audit — Latest',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    header,
    sep,
    ...rows,
    '',
    `Full JSON: ${jsonPath}`,
  ].join('\n');

  const mdPath = join(outDir, 'latest.md');
  writeFileSync(mdPath, md);

  return { jsonPath, mdPath };
}

async function main(): Promise<void> {
  const child = await startPreviewServer();

  let exitCode = 0;
  try {
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log('Waiting for preview server...');
    await waitForPort(PORT);
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log('Server ready. Running Lighthouse audits...\n');

    const urls = [`${BASE}/`, `${BASE}/?skip=1`];
    const formFactors: Array<'desktop' | 'mobile'> = ['desktop', 'mobile'];
    const runs: RunResult[] = [];

    for (const url of urls) {
      for (const ff of formFactors) {
        // biome-ignore lint/suspicious/noConsole: CLI script
        console.log(`  Auditing ${url} [${ff}]...`);
        const run = await runLighthouse(url, ff);
        runs.push(run);
        // biome-ignore lint/suspicious/noConsole: CLI script
        console.log(
          `    ${Object.entries(run.scores)
            .map(([k, v]) => `${k}=${v}`)
            .join('  ')}  ${run.passed ? 'PASS' : 'FAIL'}`,
        );
        if (!run.passed) {
          for (const v of run.violations) {
            console.error(`    VIOLATION: ${v}`);
          }
        }
      }
    }

    const { jsonPath, mdPath } = writeReport(runs);
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log(`\nReport written → ${jsonPath}`);
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.log(`Summary   → ${mdPath}`);

    const allPassed = runs.every((r) => r.passed);
    if (!allPassed) {
      console.error('\nLighthouse audit FAILED — thresholds not met (see violations above)');
      exitCode = 1;
    } else {
      // biome-ignore lint/suspicious/noConsole: CLI script
      console.log('\nAll Lighthouse thresholds met.');
    }
  } finally {
    child.kill('SIGTERM');
  }

  process.exit(exitCode);
}

main().catch((err: unknown) => {
  console.error('lighthouse-audit fatal:', err);
  process.exit(1);
});
