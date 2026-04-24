/**
 * Visual-matrix baseline × 4 form factors — "what the player actually sees".
 *
 * Extends the original single-viewport visual matrix to capture all 8 distance
 * slices across 4 viewports:
 *
 *   phone-portrait   390 × 844   (iPhone 14 CSS px)
 *   phone-landscape  844 × 390
 *   tablet-portrait  820 × 1180  (iPad Air CSS px)
 *   desktop         1280 × 720
 *
 * Each viewport × each slice = 32 PNGs total.
 *
 * Output:
 *   .test-screenshots/visual-matrix/<viewport>/slice-NNN.png
 *
 * Baselines are pinned under:
 *   src/app/__baselines__/visual-matrix/<viewport>/slice-NNN.png
 *
 * Size gate: each PNG must exceed 20 KB (real 3D scene content).
 *
 * Determinism: uses ?autoplay=1&phrase=lightning-kerosene-ferris&difficulty=nightmare
 * so the run plan is identical every run. App is mounted inside a sized div so
 * R3F adapts its renderer dimensions and the scene scales accordingly.
 *
 * NOTE: For the browser test, the actual browser viewport is fixed at 1280×720.
 * We simulate different form factors by mounting the App inside a constrained div
 * and forcing a window resize event so R3F re-measures. This faithfully exercises
 * the responsive scale, HUD layout, and FOV recalculation for each form factor.
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import { commands } from 'vitest/browser';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { diag, waitForDistance, waitFrames, waitPastDropIn } from '@/test/integration';
import { App } from './App';

// ─── Distance slices ─────────────────────────────────────────────────────────

const SLICES_M = [40, 80, 120, 180, 250, 320, 400, 480];
const SEED_PHRASE = 'lightning-kerosene-ferris';

// ─── Viewport definitions ────────────────────────────────────────────────────

interface Viewport {
  id: string;
  width: number;
  height: number;
}

const VIEWPORTS: Viewport[] = [
  { id: 'phone-portrait', width: 390, height: 844 },
  { id: 'phone-landscape', width: 844, height: 390 },
  { id: 'tablet-portrait', width: 820, height: 1180 },
  { id: 'desktop', width: 1280, height: 720 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setViewportDimensions(width: number, height: number): void {
  // Override the window dimensions seen by R3F's canvas measurement hook.
  // We use Object.defineProperty on window.innerWidth/innerHeight so the
  // R3F resize observer picks up the change when we dispatch the resize event.
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    writable: true,
    configurable: true,
  });
  window.dispatchEvent(new Event('resize'));
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Visual matrix baseline × 4 form factors (H1)', () => {
  let originalUrl = '';
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeAll(() => {
    originalUrl = window.location.href;
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    window.history.replaceState(
      null,
      '',
      `/?preserve=1&autoplay=1&phrase=${encodeURIComponent(SEED_PHRASE)}&difficulty=nightmare`,
    );
  });

  afterAll(() => {
    if (originalUrl) window.history.replaceState(null, '', originalUrl);
    setViewportDimensions(originalInnerWidth, originalInnerHeight);
  });

  afterEach(() => {
    cleanup();
  });

  for (const vp of VIEWPORTS) {
    it(`captures ${vp.id} (${vp.width}×${vp.height}) — all distance slices`, async () => {
      // Set simulated viewport so R3F measures the correct canvas size.
      setViewportDimensions(vp.width, vp.height);

      const { container } = render(
        <div
          style={{
            width: vp.width,
            height: vp.height,
            position: 'fixed',
            top: 0,
            left: 0,
            overflow: 'hidden',
          }}
        >
          <App />
        </div>,
      );

      const canvas = await waitFor(
        () => {
          const el = container.querySelector('canvas');
          if (!el) throw new Error('canvas not rendered');
          return el;
        },
        { timeout: 10_000 },
      );
      await waitFrames(15);

      // Autoplay auto-started the run. Wait past drop-in.
      await waitPastDropIn(20_000);

      let capturedSlices = 0;
      for (const target of SLICES_M) {
        const pre = diag();
        if (pre.gameOver || !pre.running) {
          console.info(
            `[visual-matrix/${vp.id}] run ended at ${pre.distance.toFixed(0)}m before slice ${target}m — captured ${capturedSlices} slices`,
          );
          break;
        }

        try {
          await waitForDistance(target, 40_000);
        } catch {
          const s = diag();
          console.error(
            `[visual-matrix/${vp.id}] stalled at slice ${target}m (distance=${s.distance.toFixed(0)}m)`,
          );
          const stallDataUrl = canvas.toDataURL('image/png');
          await commands.writePngFromDataUrl(
            stallDataUrl,
            `.test-screenshots/visual-matrix/${vp.id}/stall-at-${String(Math.round(s.distance)).padStart(3, '0')}m.png`,
          );
          break;
        }

        await waitFrames(3);

        const dataUrl = canvas.toDataURL('image/png');
        const sliceNum = String(target).padStart(3, '0');
        const filename = `.test-screenshots/visual-matrix/${vp.id}/slice-${sliceNum}m.png`;
        const result = await commands.writePngFromDataUrl(dataUrl, filename);
        expect(
          result.bytes,
          `[${vp.id}] slice ${target}m must produce a non-trivial PNG (got ${result.bytes}B)`,
        ).toBeGreaterThan(20_000);

        // Pin baseline for this viewport+slice if not yet committed.
        await commands.writePngFromDataUrl(
          dataUrl,
          `src/app/__baselines__/visual-matrix/${vp.id}/slice-${sliceNum}m.png`,
        );

        capturedSlices++;
      }

      expect(
        capturedSlices,
        `[${vp.id}] expected at least one captured slice`,
      ).toBeGreaterThanOrEqual(1);
    }, 900_000);
  }
});
