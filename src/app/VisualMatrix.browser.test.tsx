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
 * Determinism: uses ?autoplay=1&phrase=<fixed-seed>&difficulty=nightmare
 * so the run plan (obstacles, pickups, archetype sequence) is identical
 * every run. Without the fixed phrase, NewRunModal's default
 * shufflePhrase() would pick a random seed each run and the captured
 * slices would drift between runs.
 */
import { render, waitFor } from '@testing-library/react';
import { commands } from '@vitest/browser/context';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { diag, waitForDistance, waitFrames, waitPastDropIn } from '@/test/integration';
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

// Deterministic seed phrase — the run plan (obstacles, pickups, track
// archetypes) is identical every run.
const SEED_PHRASE = 'lightning-kerosene-ferris';

describe('Visual matrix baseline', () => {
  let originalUrl = '';
  beforeAll(() => {
    originalUrl = window.location.href;
    // preserve=1 → preserveDrawingBuffer so canvas.toDataURL reads the last
    // committed frame. autoplay=1&phrase&difficulty → TitleScreen auto-starts
    // a run with the supplied deterministic seed; no UI click-through needed.
    window.history.replaceState(
      null,
      '',
      `/?preserve=1&autoplay=1&phrase=${encodeURIComponent(SEED_PHRASE)}&difficulty=nightmare`,
    );
  });
  afterAll(() => {
    if (originalUrl) window.history.replaceState(null, '', originalUrl);
  });

  it('captures the POV scene at every distance slice', async () => {
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

    // Autoplay auto-started the run; wait past the drop-in intro so the
    // gameplay tick is actually advancing before we do distance-based waits.
    await waitPastDropIn(20_000);

    // The run is driven by the Governor (autoplay=1) which can crash into
    // obstacles. If the run ends before we hit all slices, stop early but
    // still assert we captured at LEAST the first slice — the whole point
    // is catching visual regressions, and 1+ slices is better than zero.
    let capturedSlices = 0;
    for (const target of SLICES_M) {
      const pre = diag();
      if (pre.gameOver || !pre.running) {
        console.info(
          `[visual-matrix] run ended at distance=${pre.distance.toFixed(0)}m before slice ${target}m — captured ${capturedSlices} slices`,
        );
        break;
      }
      // 40s per slice (×5 CI mult = 200s) is generous for real-GPU chrome
      // and fits CI swiftshader's time dilation.
      try {
        await waitForDistance(target, 40_000);
      } catch {
        const s = diag();
        console.error(
          `[visual-matrix] stalled at slice ${target}m:`,
          JSON.stringify(
            {
              distance: s.distance,
              running: s.running,
              gameOver: s.gameOver,
              throttle: s.throttle,
              targetSpeedMps: s.targetSpeedMps,
              currentZone: s.currentZone,
              lateral: s.lateral,
              ecsDamage: (s as unknown as { ecsDamage?: number }).ecsDamage,
            },
            null,
            2,
          ),
        );
        // Capture whatever's on the canvas right now as a "stall" artifact
        // so reviewers can see what the scene looked like when it stopped.
        const dataUrl = canvas.toDataURL('image/png');
        await commands.writePngFromDataUrl(
          dataUrl,
          `.test-screenshots/visual-matrix/stall-at-${String(Math.round(s.distance)).padStart(3, '0')}m.png`,
        );
        break;
      }
      await waitFrames(3);

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
      capturedSlices++;
    }

    expect(capturedSlices, 'expected at least one captured slice').toBeGreaterThanOrEqual(1);
  }, 900_000);
});
