/**
 * Player-journey stage gate — EVERY step the player takes, tested in
 * isolation AND in coordination.
 *
 * The goal is zero-mystery failures. When a nightly or smoke run fails,
 * the console should already contain:
 *   - Which journey stage broke.
 *   - The live diag() snapshot at that stage.
 *   - The visual-sanity region stats (luminance, RGB, bright/dark pct)
 *     for every canonical frame region.
 *
 * Stages covered (in order):
 *   1. MOUNT         — app shell + canvas render
 *   2. TITLE         — TitleScreen + start button visible
 *   3. BEFORE_PLAY   — start-button click → new-run modal DOM attached
 *   4. AFTER_PLAY    — new-run-play click → hud-stats mounted
 *   5. DRIVING       — ECS tick active: distance advances, fps > 0
 *   6. STEERING      — setSteer → lateral changes direction
 *   7. PAUSE_RESUME  — P-pause → distance freezes → resume → distance advances
 *
 * At every stage the test also runs visual-sanity assertions against the
 * live canvas frame so broken cockpit / black screen / fish-eye FOV
 * blowout fires BEFORE the next stage silently skips.
 */
import { render, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  assertLiveFrameSanity,
  formatStats,
  snapshotWebGL,
  STANDARD_REGIONS,
  sampleRegion,
} from '@/test/visualSanity';
import { App } from './App';

beforeAll(() => {
  const url = new URL(window.location.href);
  url.searchParams.set('preserve', '1');
  url.searchParams.set('nonameonboard', '1');
  window.history.replaceState(null, '', url);
});

interface Diag {
  fps?: number;
  distance?: number;
  running?: boolean;
  gameOver?: boolean;
  paused?: boolean;
  speedMps?: number;
  lateral?: number;
  steer?: number;
  dropProgress?: number;
  currentZone?: string;
}

function diag(): Diag {
  const w = window as { __mm?: { diag?: () => Diag } };
  return w.__mm?.diag?.() ?? {};
}

async function waitFrames(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

async function findCanvas(container: HTMLElement): Promise<HTMLCanvasElement> {
  return waitFor(
    () => {
      const el = container.querySelector('canvas');
      if (!el) throw new Error('canvas not rendered');
      return el as HTMLCanvasElement;
    },
    { timeout: 15_000 },
  );
}

/** Dump stage state to console so failures are NEVER a mystery. */
function logStage(stage: string, ctx?: CanvasRenderingContext2D): void {
  const d = diag();
  // biome-ignore lint/suspicious/noConsole: diagnostic dump is the whole point
  console.log(
    `[journey/${stage}] diag: running=${d.running} paused=${d.paused} gameOver=${d.gameOver} ` +
      `dropProgress=${d.dropProgress?.toFixed(2)} distance=${d.distance?.toFixed(1)} ` +
      `fps=${d.fps?.toFixed(1)} zone=${d.currentZone} lateral=${d.lateral?.toFixed(2)} ` +
      `steer=${d.steer?.toFixed(2)}`,
  );
  if (ctx) {
    const stats = {
      full: sampleRegion(ctx, STANDARD_REGIONS.full!),
      sky: sampleRegion(ctx, STANDARD_REGIONS.sky!),
      above: sampleRegion(ctx, STANDARD_REGIONS.above!),
      middle: sampleRegion(ctx, STANDARD_REGIONS.middle!),
      cockpit: sampleRegion(ctx, STANDARD_REGIONS.cockpit!),
      bottom: sampleRegion(ctx, STANDARD_REGIONS.bottom!),
    };
    // biome-ignore lint/suspicious/noConsole: diagnostic dump is the whole point
    console.log(`[journey/${stage}] frame stats:\n${formatStats(stats)}`);
  }
}

describe('Player journey — stage-by-stage with diag dumps', () => {
  it(
    'MOUNT → TITLE → BEFORE_PLAY → AFTER_PLAY → DRIVING → STEERING → PAUSE → RESUME',
    async () => {
      // ── Stage 1: MOUNT ─────────────────────────────────────────────────
      const { container } = render(<App />);
      const canvas = await findCanvas(container);
      await waitFrames(30);
      logStage('MOUNT');
      expect(canvas.width).toBeGreaterThan(300);
      expect(canvas.height).toBeGreaterThan(150);

      // ── Stage 2: TITLE ─────────────────────────────────────────────────
      await waitFor(
        () => {
          const title = container.querySelector('[data-testid="title-screen"]');
          if (!title) throw new Error('title-screen not mounted');
        },
        { timeout: 15_000 },
      );
      logStage('TITLE', snapshotWebGL(canvas));
      // Title stage: the full frame is the 3D scene behind the title, so
      // sanity-check the scene rendered rather than the title overlay itself.
      const titleStats = assertLiveFrameSanity(snapshotWebGL(canvas));
      expect(titleStats.full?.avgLum ?? 0).toBeGreaterThan(0.03);

      // ── Stage 3: BEFORE_PLAY — click NEW RUN ──────────────────────────
      const startBtn = await waitFor(
        () => {
          const btn = container.querySelector(
            '[data-testid="start-button"]',
          ) as HTMLButtonElement | null;
          if (!btn) throw new Error('start-button not mounted');
          return btn;
        },
        { timeout: 10_000 },
      );
      startBtn.click();
      await waitFor(
        () => {
          const modal = container.querySelector('[data-testid="new-run-modal"]');
          if (!modal) throw new Error('new-run-modal not attached after click');
        },
        { timeout: 10_000 },
      );
      logStage('BEFORE_PLAY');

      // ── Stage 4: AFTER_PLAY — click PLAY ──────────────────────────────
      const playBtn = (await waitFor(
        () => {
          const btn = container.querySelector(
            '[data-testid="new-run-play"]',
          ) as HTMLButtonElement | null;
          if (!btn) throw new Error('new-run-play not mounted');
          return btn;
        },
        { timeout: 10_000 },
      )) as HTMLButtonElement;
      playBtn.click();
      await waitFor(
        () => {
          const hud = container.querySelector('[data-testid="hud-stats"]');
          if (!hud) throw new Error('hud-stats not mounted after PLAY');
        },
        { timeout: 15_000 },
      );
      await waitFrames(10);
      logStage('AFTER_PLAY', snapshotWebGL(canvas));

      // ── Stage 5: DRIVING — wait past drop-in, then observe distance advance ──
      // AFTER_PLAY commits running=true immediately but the drop-in camera
      // animation plays first (dropProgress 0→1). Distance only starts
      // accumulating once dropProgress hits 1. Wait for that, then prove
      // the tick is live by watching distance strictly increase.
      await waitFor(
        () => {
          const p = diag().dropProgress ?? 0;
          if (p < 1) throw new Error(`drop-in at ${p.toFixed(2)}, waiting`);
        },
        { timeout: 30_000, interval: 100 },
      );
      const d0 = diag().distance ?? 0;
      await waitFrames(60);
      const d1 = diag().distance ?? 0;
      const stageCtx = snapshotWebGL(canvas);
      logStage('DRIVING', stageCtx);
      assertLiveFrameSanity(stageCtx);
      expect(d1, `distance ${d1} did not advance from ${d0} in 60 frames`).toBeGreaterThan(d0);
      expect(diag().running, 'running flag not true during DRIVING stage').toBe(true);

      // ── Stage 6: STEERING — commanded steer changes lateral direction ─
      const w = window as {
        __mm?: { setSteer?: (v: number) => void };
      };
      if (w.__mm?.setSteer) {
        w.__mm.setSteer(1);
        await waitFrames(30);
        const right = diag().lateral ?? 0;
        w.__mm.setSteer(-1);
        await waitFrames(30);
        const left = diag().lateral ?? 0;
        logStage('STEERING');
        expect(
          left,
          `lateral after left-steer (${left}) should be < right-steer (${right})`,
        ).toBeLessThan(right);
        w.__mm.setSteer(0);
      }

      // ── Stage 7: PAUSE → RESUME ───────────────────────────────────────
      const wPause = window as {
        __mm?: { pause?: () => void; resume?: () => void };
      };
      if (wPause.__mm?.pause && wPause.__mm?.resume) {
        wPause.__mm.pause();
        await waitFrames(5);
        const pausedAt = diag().distance ?? 0;
        await waitFrames(30);
        const afterPause = diag().distance ?? 0;
        logStage('PAUSED');
        expect(
          Math.abs(afterPause - pausedAt),
          `distance advanced while paused (${pausedAt} → ${afterPause})`,
        ).toBeLessThan(0.5);

        wPause.__mm.resume();
        await waitFrames(60);
        const resumed = diag().distance ?? 0;
        logStage('RESUMED');
        expect(
          resumed,
          `distance ${resumed} did not advance after resume from ${afterPause}`,
        ).toBeGreaterThan(afterPause);
      }
    },
    240_000,
  );
});
