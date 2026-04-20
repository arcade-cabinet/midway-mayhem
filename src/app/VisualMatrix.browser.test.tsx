/**
 * Visual-matrix baseline — "what the player actually sees".
 *
 * The existing Cockpit.browser.test.tsx renders the cockpit in isolation
 * and Track.browser.test.tsx renders the track without a cockpit on top.
 * Nothing asserts the REAL integrated scene (App + Cockpit + TrackContent
 * + StartPlatform + FinishBanner + feature layers + HUD) at the POV
 * camera at multiple distances.
 *
 * This test captures the integrated scene at a fixed set of distance
 * checkpoints so any new visual regression — a mesh dropping out, a
 * layer clipping into the cockpit, an orphan scale blowing up the
 * bounding box — shows up as a pixel diff on the per-slice baseline.
 *
 * Dumps go to `.test-screenshots/visual-matrix/slice-<NNN>m.png`. The
 * node-surface baseline diff job can compare against pinned reference
 * images; for now the gate is "PNG has real content (>20 KB)".
 *
 * The slices are deterministic given the world seed (42 from App.tsx),
 * so every run produces the same scene — no flaky baselines.
 */
import { render, waitFor } from '@testing-library/react';
import { commands } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { diag, driveInto, waitForDistance, waitFrames } from '@/test/integration';
import { App } from './App';

// Distance checkpoints chosen to hit the interesting features:
//   40m   — just past drop-in, still on start platform
//   80m   — first turn enters (straight → slight-left coupling)
//   120m  — mid first zone, a second archetype transition
//   180m  — past a hard turn and a dip
//   250m  — more elevation changes
//   320m  — about 2/3 through first zone
//   400m  — approaching first zone boundary (450m)
//   480m  — just INSIDE the second zone, cross-boundary capture
const SLICES_M = [40, 80, 120, 180, 250, 320, 400, 480];

describe('Visual matrix baseline', () => {
  it('captures the POV scene at every distance slice', async () => {
    // Opt into preserveDrawingBuffer via URL so toDataURL reads the last
    // committed frame instead of a cleared buffer. Prod App.tsx checks
    // the flag and enables the gl context option accordingly.
    window.history.replaceState({}, '', '/?preserve=1');

    const { container } = render(<App />);

    const canvas = await waitFor(
      () => {
        const el = container.querySelector('canvas');
        if (!el) throw new Error('canvas not rendered');
        return el;
      },
      { timeout: 10_000 },
    );
    await waitFrames(15);

    // Highest non-permadeath tier so we cover ground fast — the matrix
    // reaches 480m which at KAZOO takes ~17s, at NIGHTMARE MIDWAY ~9s.
    await driveInto(container, /NIGHTMARE MIDWAY/i);

    for (const target of SLICES_M) {
      // 40s per slice is generous for real-GPU chrome; CI swiftshader
      // needs more. Follow-up PR will scale via VITE_CI multiplier.
      await waitForDistance(target, 40_000);
      // Settle so the HUD + racing line caught up to the distance.
      await waitFrames(3);

      const snap = diag();
      expect(
        snap.running,
        `run must still be active at slice ${target}m (got running=${snap.running})`,
      ).toBe(true);
      expect(snap.gameOver, `no game-over at slice ${target}m`).toBe(false);

      const dataUrl = canvas.toDataURL('image/png');
      const filename = `.test-screenshots/visual-matrix/slice-${String(target).padStart(
        3,
        '0',
      )}m.png`;
      const result = await commands.writePngFromDataUrl(dataUrl, filename);
      expect(
        result.bytes,
        `slice ${target}m must produce a non-trivial PNG (got ${result.bytes}B)`,
      ).toBeGreaterThan(20_000);
    }
  }, 600_000);
});
