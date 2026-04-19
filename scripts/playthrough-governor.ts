#!/usr/bin/env -S npx tsx
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * E2E playthrough governor: launches the real app in real Chrome, drops
 * into gameplay via `?autoplay=1&phrase=<seed>` (no click-through), and
 * samples interval frames (PNG + window.__mm.diag() JSON) at a fixed
 * cadence.
 *
 * This is the local-dev counterpart to `e2e/_factory.ts`. Both use the
 * same URL driver so "it worked in the governor" and "it worked in CI"
 * describe the same execution path — no separate click-chain or steer
 * plan to maintain.
 *
 * Usage:
 *   pnpm dev             (in another terminal)
 *   pnpm playthrough     (talks to localhost:5173)
 *
 *   or self-hosted:
 *   pnpm playthrough:self --self-host
 */
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(REPO_ROOT, '.test-screenshots/playthrough');
const APP_URL_DEFAULT = 'http://localhost:5173/midway-mayhem/';
const DEFAULT_PHRASE = 'neon-polkadot-jalopy';
const DEFAULT_DIFFICULTY = 'plenty';

interface Options {
  url: string;
  selfHost: boolean;
  phrase: string;
  difficulty: string;
  intervalMs: number;
  maxFrames: number;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const opts: Options = {
    url: APP_URL_DEFAULT,
    selfHost: false,
    phrase: DEFAULT_PHRASE,
    difficulty: DEFAULT_DIFFICULTY,
    intervalMs: 2_000,
    maxFrames: 10,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url') opts.url = args[++i] ?? opts.url;
    else if (a === '--self-host') opts.selfHost = true;
    else if (a === '--phrase') opts.phrase = args[++i] ?? opts.phrase;
    else if (a === '--difficulty') opts.difficulty = args[++i] ?? opts.difficulty;
    else if (a === '--interval-ms') opts.intervalMs = Number(args[++i] ?? opts.intervalMs);
    else if (a === '--max-frames') opts.maxFrames = Number(args[++i] ?? opts.maxFrames);
  }
  return opts;
}

async function startPreviewServer(): Promise<{ proc: ChildProcess; url: string }> {
  // Build first, then preview.
  const build = spawn('pnpm', ['build'], { cwd: REPO_ROOT, stdio: 'inherit' });
  await new Promise<void>((res, rej) => {
    build.on('exit', (code) => (code === 0 ? res() : rej(new Error(`build exit ${code}`))));
  });
  const preview = spawn('pnpm', ['preview', '--port', '4175'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((res, rej) => {
    const timer = setTimeout(() => rej(new Error('preview server timeout')), 20_000);
    preview.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('localhost:4175')) {
        clearTimeout(timer);
        res();
      }
    });
    preview.on('exit', (code) => rej(new Error(`preview exit ${code}`)));
  });
  return { proc: preview, url: 'http://localhost:4175/midway-mayhem/' };
}

async function run() {
  const opts = parseArgs();
  const outDir = resolve(OUTPUT_DIR, opts.phrase);
  await mkdir(outDir, { recursive: true });

  let server: { proc: ChildProcess; url: string } | null = null;
  let baseUrl = opts.url;
  if (opts.selfHost) {
    server = await startPreviewServer();
    baseUrl = server.url;
  }

  const params = new URLSearchParams({
    autoplay: '1',
    governor: '1',
    phrase: opts.phrase,
    difficulty: opts.difficulty,
  });
  const url = `${baseUrl}?${params.toString()}`;

  const browser = await chromium.launch({
    channel: 'chrome',
    args: [
      '--no-sandbox',
      '--use-angle=gl',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--mute-audio',
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    console.log(`[browser:${msg.type()}]`, msg.text());
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    console.error('[browser:pageerror]', err.message);
    consoleErrors.push(String(err));
  });

  console.log(`[governor] navigating to ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 20_000 });

  const start = Date.now();
  interface FrameDump {
    frame: number;
    elapsedMs: number;
    diag: Record<string, unknown> | null;
    screenshotPath: string;
  }
  const frames: FrameDump[] = [];

  for (let i = 0; i < opts.maxFrames; i++) {
    await page.waitForTimeout(opts.intervalMs);
    const elapsedMs = Date.now() - start;

    const diag = await page.evaluate(() => {
      const w = window as { __mm?: { diag?: () => unknown } };
      try {
        return (w.__mm?.diag?.() as Record<string, unknown>) ?? null;
      } catch {
        return null;
      }
    });

    const pngName = `frame-${String(i).padStart(2, '0')}.png`;
    const jsonName = `frame-${String(i).padStart(2, '0')}.json`;
    const pngPath = resolve(outDir, pngName);
    const jsonPath = resolve(outDir, jsonName);
    await page.screenshot({ type: 'png', path: pngPath });
    await writeFile(
      jsonPath,
      JSON.stringify(
        { frame: i, elapsedMs, phrase: opts.phrase, difficulty: opts.difficulty, diag },
        null,
        2,
      ),
    );
    frames.push({ frame: i, elapsedMs, diag, screenshotPath: pngPath });
    console.log(`[governor] frame ${i + 1}/${opts.maxFrames} @ t+${elapsedMs}ms`);
  }

  await writeFile(
    resolve(outDir, 'summary.json'),
    JSON.stringify(
      {
        phrase: opts.phrase,
        difficulty: opts.difficulty,
        intervalMs: opts.intervalMs,
        frameCount: frames.length,
        firstDiag: frames[0]?.diag ?? null,
        lastDiag: frames[frames.length - 1]?.diag ?? null,
        consoleErrors,
      },
      null,
      2,
    ),
  );

  await browser.close();
  if (server) server.proc.kill();
  console.log(`[governor] done — ${frames.length} frames in ${outDir}`);
}

run().catch((err) => {
  console.error('[governor] failed:', err);
  process.exitCode = 1;
});
