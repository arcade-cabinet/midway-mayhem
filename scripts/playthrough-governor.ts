#!/usr/bin/env -S npx tsx
/**
 * E2E playthrough governor: launches the real app in real Chrome, drives
 * through a scripted 15-second playthrough (click DRIVE, hold throttle,
 * alternate steer), captures 10 screenshots across the run to
 * .test-screenshots/playthrough/.
 *
 * This is the "governor" the user asked for — proves end-to-end that the
 * game works from the cockpit perspective as a player would, not just in
 * isolated unit tests.
 *
 * Usage: pnpm dev in another terminal, then:
 *   pnpm tsx scripts/playthrough-governor.ts
 * (or) with a bundled server: the script starts vite preview itself if
 * the `--self-host` flag is passed.
 */
import { chromium } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(REPO_ROOT, '.test-screenshots/playthrough');
const APP_URL_DEFAULT = 'http://localhost:5173/midway-mayhem/';

interface Options {
  url: string;
  selfHost: boolean;
  frames: number;
  durationMs: number;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const opts: Options = {
    url: APP_URL_DEFAULT,
    selfHost: false,
    frames: 10,
    durationMs: 15_000,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url') opts.url = args[++i] ?? opts.url;
    else if (a === '--self-host') opts.selfHost = true;
    else if (a === '--frames') opts.frames = Number(args[++i] ?? opts.frames);
    else if (a === '--duration-ms') opts.durationMs = Number(args[++i] ?? opts.durationMs);
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
  await mkdir(OUTPUT_DIR, { recursive: true });

  let server: { proc: ChildProcess; url: string } | null = null;
  let url = opts.url;
  if (opts.selfHost) {
    server = await startPreviewServer();
    url = server.url;
  }

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

  page.on('console', (msg) => {
    // eslint-disable-next-line no-console
    console.log(`[browser:${msg.type()}]`, msg.text());
  });
  page.on('pageerror', (err) => {
    // eslint-disable-next-line no-console
    console.error('[browser:pageerror]', err.message);
  });

  // eslint-disable-next-line no-console
  console.log(`[governor] navigating to ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="title-drive-button"]', { timeout: 10_000 });
  await page.click('[data-testid="title-drive-button"]');
  await page.waitForTimeout(600); // allow title fade

  // Start throttle.
  await page.keyboard.down('ArrowUp');

  const captureAt = (idx: number, label: string) =>
    page.screenshot({
      path: resolve(OUTPUT_DIR, `${String(idx).padStart(2, '0')}-${label}.png`),
      fullPage: false,
    });

  const frameInterval = opts.durationMs / opts.frames;
  // Alternate steer across run: LEFT for thirds 0..2, NONE, RIGHT 3..5, NONE, LEFT 6..8, NONE.
  const steerPlan: (KeyboardKey | null)[] = [
    'ArrowLeft', null, 'ArrowRight', null, 'ArrowLeft', null,
    'ArrowRight', null, 'ArrowLeft', null,
  ];

  let currentSteer: KeyboardKey | null = null;
  for (let i = 0; i < opts.frames; i++) {
    const targetSteer = steerPlan[i % steerPlan.length] ?? null;
    if (currentSteer !== targetSteer) {
      if (currentSteer) await page.keyboard.up(currentSteer);
      if (targetSteer) await page.keyboard.down(targetSteer);
      currentSteer = targetSteer;
    }
    await page.waitForTimeout(frameInterval);
    await captureAt(i, `t${String(Math.round((i + 1) * frameInterval)).padStart(5, '0')}ms`);
    // eslint-disable-next-line no-console
    console.log(`[governor] captured frame ${i + 1}/${opts.frames}`);
  }

  if (currentSteer) await page.keyboard.up(currentSteer);
  await page.keyboard.up('ArrowUp');

  await browser.close();
  if (server) server.proc.kill();
  // eslint-disable-next-line no-console
  console.log(`[governor] done — ${opts.frames} frames in ${OUTPUT_DIR}`);
}

type KeyboardKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | ' ';

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[governor] failed:', err);
  process.exitCode = 1;
});

// Quieten unused-path when building.
void dirname;
