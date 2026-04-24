#!/usr/bin/env -S npx tsx
/**
 * Store-listing screenshot generator.
 *
 * Captures 5 canonical moments × 2 platform viewports = 10 PNG files
 * for App Store (iOS 6.7") and Google Play (Android Phone) listings.
 *
 * Moments captured:
 *   01-title      – Title screen cockpit before clicking PLAY
 *   02-mid-run    – POV with hood + track in motion (t≈3s)
 *   03-boost      – Speed-lines / boost FX active (t≈6s)
 *   04-trick      – Barrel-roll trick in progress, triggered via keyboard (t≈9s)
 *   05-game-over  – Game-over overlay via __mm.end() (t≈12s)
 *
 * Usage:
 *   pnpm screenshots:store              # expects pnpm dev running on :5173
 *   pnpm screenshots:store --self-host  # builds + previews automatically
 *
 * Output: resources/store-screenshots/{ios,android}/<slot>.png
 *
 * Hard-fails if any moment does not produce a valid PNG.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

// ─── Platform viewport specs ─────────────────────────────────────────────────

interface PlatformSpec {
  id: string;
  label: string;
  /** Playwright device scale factor. */
  deviceScaleFactor: number;
  viewport: { width: number; height: number };
  /** True mobile UA so touch controls render instead of keyboard hints. */
  isMobile: boolean;
  userAgent?: string;
}

const PLATFORMS: PlatformSpec[] = [
  {
    id: 'ios',
    label: 'iOS 6.7" (1290×2796)',
    // At DPR 3 the canvas renders at 430×932 CSS px → 1290×2796 physical px.
    deviceScaleFactor: 3,
    viewport: { width: 430, height: 932 },
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'android',
    label: 'Android Phone (1080×1920)',
    // At DPR 2.625 the canvas renders at ~411×731 CSS px → ~1079×1919 physical px (≈1080×1920).
    deviceScaleFactor: 2.625,
    viewport: { width: 412, height: 732 },
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  },
];

// ─── Canonical seed ───────────────────────────────────────────────────────────

const PHRASE = 'lightning-kerosene-ferris';
const DIFFICULTY = 'plenty';

// ─── Parse args ───────────────────────────────────────────────────────────────

interface Options {
  selfHost: boolean;
  url: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const opts: Options = {
    selfHost: false,
    url: 'http://localhost:5173/midway-mayhem/',
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--self-host') opts.selfHost = true;
    else if (a === '--url') opts.url = args[++i] ?? opts.url;
  }
  return opts;
}

// ─── Self-hosted preview server ───────────────────────────────────────────────

async function startPreviewServer(): Promise<{ proc: ChildProcess; url: string }> {
  console.log('[store-screenshots] building production bundle…');
  const build = spawn('pnpm', ['build'], { cwd: REPO_ROOT, stdio: 'inherit' });
  await new Promise<void>((res, rej) => {
    build.on('exit', (code) => (code === 0 ? res() : rej(new Error(`build exited ${code}`))));
  });

  console.log('[store-screenshots] starting preview server…');
  // Pick a port unlikely to conflict with other running services.
  const PREVIEW_PORT = 4176;
  const preview = spawn('pnpm', ['preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const url = `http://localhost:${PREVIEW_PORT}/midway-mayhem/`;
  await new Promise<void>((res, rej) => {
    const timer = setTimeout(() => rej(new Error('preview server timed out after 30s')), 30_000);
    preview.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes(`localhost:${PREVIEW_PORT}`)) {
        clearTimeout(timer);
        res();
      }
    });
    preview.on('exit', (code) => rej(new Error(`preview exited ${code}`)));
  });
  return { proc: preview, url };
}

// ─── Screenshot capture helpers ──────────────────────────────────────────────

function assertPngWritten(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`[store-screenshots] HARD FAIL — PNG not written: ${path}`);
  }
  const size = statSync(path).size;
  if (size < 1024) {
    throw new Error(
      `[store-screenshots] HARD FAIL — PNG suspiciously small (${size} bytes): ${path}`,
    );
  }
  console.log(`[store-screenshots]   ✓ ${path} (${(size / 1024).toFixed(0)} KB)`);
}

// ─── Per-platform capture ────────────────────────────────────────────────────

async function capturePlatform(
  platform: PlatformSpec,
  baseUrl: string,
  outDir: string,
): Promise<void> {
  console.log(`\n[store-screenshots] ── ${platform.label} ──`);

  const browser = await chromium.launch({
    channel: 'chrome',
    args: [
      '--no-sandbox',
      '--use-angle=gl',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--mute-audio',
      // Force the device scale factor at the browser level so the OS
      // compositor handles the DPR naturally — avoids the expensive
      // Page.captureScreenshot readback that hangs on large high-DPR viewports.
      `--force-device-scale-factor=${platform.deviceScaleFactor}`,
    ],
  });

  const contextOpts: Parameters<typeof browser.newContext>[0] = {
    viewport: platform.viewport,
    isMobile: platform.isMobile,
    hasTouch: platform.isMobile,
  };
  if (platform.userAgent !== undefined) {
    contextOpts.userAgent = platform.userAgent;
  }
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();
  // Set a longer default action timeout for this page — the Three.js/R3F
  // scene takes longer to settle than a typical web page, and Playwright's
  // screenshot action waits for document.fonts.ready which can take >30s
  // while the WebGL context + font files are loading on the first cold boot.
  page.setDefaultTimeout(90_000);

  const fatalErrors: string[] = [];
  page.on('pageerror', (err) => {
    const msg = String(err);
    // Filter out known-benign noise (same list as _factory.ts)
    if (
      !msg.includes('React DevTools') &&
      !msg.toLowerCase().includes('download the react devtools') &&
      !msg.includes('TitleScreen.loadTickets') &&
      !msg.includes('OPFS') &&
      !msg.includes('operation failed for an unknown transient reason')
    ) {
      fatalErrors.push(msg);
      console.error('[browser:pageerror]', msg);
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        !text.includes('React DevTools') &&
        !text.toLowerCase().includes('download the react devtools') &&
        !text.includes('TitleScreen.loadTickets') &&
        !text.includes('OPFS') &&
        !text.includes('operation failed for an unknown transient reason') &&
        // 404s on audio/WASM workers are non-fatal for visual store screenshots.
        // The game renders fine; only audio/MIDI is affected.
        !text.includes('Failed to load resource') &&
        !text.includes('net::ERR_')
      ) {
        fatalErrors.push(text);
      }
    }
  });

  // ── moment 01: title screen ─────────────────────────────────────────────────
  // Navigate WITHOUT ?autoplay so the title screen remains visible.
  const titleUrl = baseUrl;
  console.log(`[store-screenshots] 01-title → ${titleUrl}`);
  // Use 'load' so the JS bundle is evaluated before we start polling; this
  // avoids a race where mm-app hasn't mounted yet on slower CI Chrome.
  await page.goto(titleUrl, { waitUntil: 'load', timeout: 60_000 });
  // Wait for the R3F canvas first (it mounts before mm-app in React tree order).
  await page.waitForSelector('canvas', { timeout: 40_000 });
  // Then wait for the mm-app wrapper that proves React rendered.
  await page.waitForSelector('[data-testid="mm-app"]', { timeout: 30_000 });
  // Give the 3D title scene 3s to settle (HDRI + cockpit + font load).
  await page.waitForTimeout(3_000);
  // Force a compositor paint by running document.fonts.ready inside the page —
  // this makes Playwright's screenshot pre-check pass without waiting again.
  await page.evaluate(() => document.fonts.ready);

  const titlePath = resolve(outDir, '01-title.png');
  await page.screenshot({ type: 'png', path: titlePath, timeout: 0 });
  assertPngWritten(titlePath);

  // ── moments 02-05: in-run and game-over ──────────────────────────────────────
  // Navigate with ?autoplay=1 + seed so the governor drives immediately.
  const params = new URLSearchParams({
    autoplay: '1',
    governor: '1',
    phrase: PHRASE,
    difficulty: DIFFICULTY,
  });
  const runUrl = `${baseUrl}?${params.toString()}`;
  console.log(`[store-screenshots] navigating to run → ${runUrl}`);
  await page.goto(runUrl, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForSelector('canvas', { timeout: 40_000 });
  // Prime document.fonts.ready so subsequent screenshots don't wait for it.
  await page.evaluate(() => document.fonts.ready);

  // Wait for title to disappear (governor auto-starts the run).
  // We poll for [data-testid="title-screen"] to vanish.
  await page
    .locator('[data-testid="title-screen"]')
    .waitFor({ state: 'hidden', timeout: 20_000 })
    .catch(() => {
      // title-screen may not appear at all when autoplay fires before paint.
    });

  // ── moment 02: mid-run at ~3s ───────────────────────────────────────────────
  await page.waitForTimeout(3_000);
  const midRunPath = resolve(outDir, '02-mid-run.png');
  console.log('[store-screenshots] 02-mid-run');
  await page.screenshot({ type: 'png', path: midRunPath, timeout: 0 });
  assertPngWritten(midRunPath);

  // ── moment 03: boost FX at ~6s ──────────────────────────────────────────────
  // The governor picks up boost tokens as they appear; at t≈6s the first
  // boost is typically active. We also fire window.__mm.applyPickup('boost')
  // as a belt-and-suspenders to guarantee the FX triggers regardless of
  // exact pickup timing.
  await page.waitForTimeout(3_000);
  await page
    .evaluate(() => {
      const w = window as { __mm?: { applyPickup?: (k: string) => void } };
      w.__mm?.applyPickup?.('boost');
    })
    .catch(() => {});
  // Give boost FX one animation frame to paint.
  await page.waitForTimeout(300);
  const boostPath = resolve(outDir, '03-boost.png');
  console.log('[store-screenshots] 03-boost');
  await page.screenshot({ type: 'png', path: boostPath, timeout: 0 });
  assertPngWritten(boostPath);

  // ── moment 04: trick in-progress at ~9s ─────────────────────────────────────
  // Press ArrowUp to trigger a trick (ramp jump / wheelie input) then
  // capture while the trick overlay / camera tilt is visible.
  await page.waitForTimeout(2_700);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(300);
  const trickPath = resolve(outDir, '04-trick.png');
  console.log('[store-screenshots] 04-trick');
  await page.screenshot({ type: 'png', path: trickPath, timeout: 0 });
  assertPngWritten(trickPath);

  // ── moment 05: game-over overlay ─────────────────────────────────────────────
  // Force game-over via window.__mm.end() for a deterministic "RUN COMPLETE"
  // overlay (cleaner for store listings than a damage WIPEOUT screen).
  await page.waitForTimeout(1_000);
  await page
    .evaluate(() => {
      const w = window as { __mm?: { end?: () => void } };
      w.__mm?.end?.();
    })
    .catch(() => {});
  // Wait for the game-over overlay to appear (up to 5s).
  await page
    .locator('[data-testid="game-over"]')
    .waitFor({ state: 'visible', timeout: 5_000 })
    .catch(() => {
      console.warn(
        '[store-screenshots] game-over overlay did not appear within 5s — capturing anyway',
      );
    });
  const gameOverPath = resolve(outDir, '05-game-over.png');
  console.log('[store-screenshots] 05-game-over');
  await page.screenshot({ type: 'png', path: gameOverPath, timeout: 0 });
  assertPngWritten(gameOverPath);

  await browser.close();

  if (fatalErrors.length > 0) {
    throw new Error(
      `[store-screenshots] ${platform.id} — fatal console errors:\n${fatalErrors.join('\n')}`,
    );
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs();

  const outRoot = resolve(REPO_ROOT, 'resources', 'store-screenshots');
  const iosDest = resolve(outRoot, 'ios');
  const androidDest = resolve(outRoot, 'android');
  await mkdir(iosDest, { recursive: true });
  await mkdir(androidDest, { recursive: true });

  let server: { proc: ChildProcess; url: string } | null = null;
  let baseUrl = opts.url;

  if (opts.selfHost) {
    server = await startPreviewServer();
    baseUrl = server.url;
  }

  const errors: string[] = [];

  for (const platform of PLATFORMS) {
    const dest = platform.id === 'ios' ? iosDest : androidDest;
    try {
      await capturePlatform(platform, baseUrl, dest);
    } catch (err) {
      errors.push(String(err));
      console.error(`[store-screenshots] ERROR on ${platform.id}:`, err);
    }
  }

  if (server) server.proc.kill();

  if (errors.length > 0) {
    console.error('\n[store-screenshots] FAILED with errors:');
    for (const e of errors) console.error(' ', e);
    process.exitCode = 1;
    return;
  }

  console.log('\n[store-screenshots] All 10 screenshots captured successfully.');
  console.log(`  iOS:     ${iosDest}`);
  console.log(`  Android: ${androidDest}`);
}

main().catch((err) => {
  console.error('[store-screenshots] fatal:', err);
  process.exitCode = 1;
});
