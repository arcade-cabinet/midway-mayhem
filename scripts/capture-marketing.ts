/**
 * capture-marketing.ts — Playwright headless marketing screenshot capture.
 *
 * Usage:
 *   pnpm capture:marketing
 *
 * Produces 12 PNGs in docs/media/marketing/:
 *   3 poses × 4 zones = 12 screenshots
 *
 * Poses:
 *   cockpit-pov        — driver's-eye-view looking down track
 *   over-shoulder      — elevated trailing 3rd-person
 *   low-dramatic-side  — low angle, side profile, dramatic
 *
 * The script spins up `vite preview` (reusing the production dist build),
 * waits for the server, navigates to ?skip=1&diag=1&governor=1, then
 * injects window.__mmCapture = { pose, zone } to position the camera before
 * each screenshot.
 */

import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { type Browser, chromium, type Page } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'media', 'marketing');
const BASE_URL = 'http://localhost:4175/midway-mayhem/';
const VIEWPORT = { width: 1920, height: 1080 };

const ZONES = ['midway-strip', 'balloon-alley', 'ring-of-fire', 'funhouse-frenzy'] as const;
const POSES = ['cockpit-pov', 'over-shoulder', 'low-dramatic-side'] as const;

type Zone = (typeof ZONES)[number];
type Pose = (typeof POSES)[number];

interface Capture {
  pose: Pose;
  zone: Zone;
  filename: string;
}

function buildCaptures(): Capture[] {
  const captures: Capture[] = [];
  for (const zone of ZONES) {
    for (const pose of POSES) {
      captures.push({
        pose,
        zone,
        filename: `${zone}--${pose}.png`,
      });
    }
  }
  return captures;
}

// ---------------------------------------------------------------------------
// Build check
// ---------------------------------------------------------------------------

function ensureDist() {
  const distIndex = path.join(ROOT, 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) {
    execFileSync('pnpm', ['build'], { cwd: ROOT, stdio: 'inherit' });
  }
}

// ---------------------------------------------------------------------------
// Preview server
// ---------------------------------------------------------------------------

async function startPreview(): Promise<() => void> {
  const proc = spawn('pnpm', ['preview'], {
    cwd: ROOT,
    stdio: 'pipe',
    detached: false,
  });

  // Wait for server to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Preview server timed out')), 30_000);
    const checkReady = (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes('4175') || msg.includes('Local:')) {
        clearTimeout(timeout);
        resolve();
      }
    };
    proc.stdout?.on('data', checkReady);
    proc.stderr?.on('data', checkReady);
    proc.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== null && code !== 0) reject(new Error(`Preview exited with code ${code}`));
    });
  });

  return () => {
    proc.kill('SIGTERM');
  };
}

// ---------------------------------------------------------------------------
// Camera injection helpers
// ---------------------------------------------------------------------------

// Camera positions/rotations per pose (in Three.js coordinate system)
const CAMERA_POSES: Record<
  Pose,
  { position: [number, number, number]; lookAt: [number, number, number] }
> = {
  'cockpit-pov': {
    position: [0, 1.2, 0.6],
    lookAt: [0, 0.8, -20],
  },
  'over-shoulder': {
    position: [2.5, 4.5, 5.0],
    lookAt: [0, 0.5, -10],
  },
  'low-dramatic-side': {
    position: [8.0, 0.4, -5.0],
    lookAt: [0, 0.8, -10],
  },
};

// Zone distances where the game should be at for each zone
const ZONE_DISTANCES: Record<Zone, number> = {
  'midway-strip': 100,
  'balloon-alley': 600,
  'ring-of-fire': 1100,
  'funhouse-frenzy': 1600,
};

async function injectCaptureMode(page: Page, zone: Zone, pose: Pose): Promise<void> {
  const camConfig = CAMERA_POSES[pose];
  const targetDistance = ZONE_DISTANCES[zone];

  await page.evaluate(
    ({ zone: z, pose: p, position, lookAt, distance }) => {
      // biome-ignore lint/suspicious/noExplicitAny: capture injection
      const w = window as any;
      w.__mmCapture = { pose: p, zone: z, position, lookAt, distance };

      // Fast-forward to the target zone by setting game state directly
      try {
        const store = w.__mmStore;
        if (store) {
          store.setState({ distance, currentZone: z, dropProgress: 1 });
        }
      } catch {
        /* state not available yet */
      }
    },
    {
      zone,
      pose,
      position: camConfig.position,
      lookAt: camConfig.lookAt,
      distance: targetDistance,
    },
  );
}

// ---------------------------------------------------------------------------
// Main capture loop
// ---------------------------------------------------------------------------

async function capture(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  ensureDist();

  let stopPreview: (() => void) | null = null;
  let browser: Browser | null = null;

  try {
    stopPreview = await startPreview();

    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--use-angle=default',
        '--enable-features=WebGL,WebGL2',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--use-gl=angle',
        '--mute-audio',
        '--disable-background-timer-throttling',
      ],
    });

    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    // Navigate to game in skip+governor+diag mode
    await page.goto(`${BASE_URL}?skip=1&governor=1&diag=1`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    // Wait for game to boot and HUD to appear
    await page.waitForSelector('[data-testid="hud"]', { timeout: 20_000 });

    // Let it run for a couple of seconds to get past drop-in
    await page.waitForTimeout(3000);

    const captures = buildCaptures();
    let _captured = 0;

    for (const cap of captures) {
      await injectCaptureMode(page, cap.zone, cap.pose);

      // Wait a frame for the camera to update
      await page.waitForTimeout(300);

      const outPath = path.join(OUT_DIR, cap.filename);
      await page.screenshot({
        path: outPath,
        type: 'png',
        fullPage: false,
        clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
      });
      _captured++;
    }

    await context.close();
  } finally {
    await browser?.close();
    stopPreview?.();
  }
}

capture().catch((err) => {
  console.error('[capture] FAILED:', err);
  process.exit(1);
});
