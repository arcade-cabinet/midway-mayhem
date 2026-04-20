/**
 * Visual-matrix regression gate. Companion to `VisualMatrix.browser.test.tsx`
 * which drives a deterministic NIGHTMARE run with the fixed seed phrase
 * "lightning-kerosene-ferris" and dumps POV captures at 8 distance
 * checkpoints into .test-screenshots/visual-matrix/slice-NNNm.png.
 *
 * This node-side test diffs each capture against a pinned baseline
 * whenever the browser test has just run in the same session. On CI,
 * node tests and browser tests run in separate jobs, so CURRENT_DIR
 * won't exist — the test skips gracefully and CI coverage relies on the
 * browser test's "PNG ≥ 20 KB" content gate instead.
 *
 * Locally: run `pnpm test:browser VisualMatrix` then `pnpm test:node --
 * visualMatrixBaseline` and the diff catches regressions (lost mesh,
 * duplicated layer, scale explosion).
 *
 * Baselines were captured on real-GPU chrome; CI's swiftshader would
 * produce different pixels, so CI intentionally doesn't run the diff.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(__dirname, '..', '__baselines__', 'visual-matrix');
const CURRENT_DIR = join(__dirname, '..', '..', '..', '.test-screenshots', 'visual-matrix');

const SLICES_M = [40, 80, 120, 180, 250, 320, 400, 480];

const PER_PIXEL_THRESHOLD = 40; // 0..255
// Higher tolerance (30%) than the mid-run baseline because each slice is
// captured at ~slice-target distance ± frame-quantum — sub-slice jitter
// in moving elements (critter walk cycles, banner animations, flower
// ornament spin, particles, slight difference in exact wall-clock frame
// offset from the distance threshold) all compound. Observed local jitter
// run-to-run is ~10-20% drift even with a fixed seed. A real regression
// (hood disappearing, StartPlatform duplication, HUD stack) will blow
// past 30% easily — the matrix catches blocking bugs, not polish.
const TOLERANCE_PCT = 30;

describe('Visual matrix regression', () => {
  for (const target of SLICES_M) {
    const name = `slice-${String(target).padStart(3, '0')}m.png`;

    it(`${name} matches pinned baseline within tolerance`, () => {
      const baselinePath = join(BASELINE_DIR, name);
      const currentPath = join(CURRENT_DIR, name);

      expect(existsSync(baselinePath), `baseline missing: ${baselinePath}`).toBe(true);

      if (!existsSync(currentPath)) {
        // Browser test hasn't run in this invocation — skip rather than fail.
        return;
      }

      const baseline = PNG.sync.read(readFileSync(baselinePath));
      const current = PNG.sync.read(readFileSync(currentPath));

      if (baseline.width !== current.width || baseline.height !== current.height) {
        throw new Error(
          `dimension mismatch for ${name}: baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}`,
        );
      }

      const total = baseline.width * baseline.height;
      let diff = 0;
      const d1 = baseline.data;
      const d2 = current.data;
      for (let i = 0; i < d1.length; i += 4) {
        const dr = Math.abs(d1[i]! - d2[i]!);
        const dg = Math.abs(d1[i + 1]! - d2[i + 1]!);
        const db = Math.abs(d1[i + 2]! - d2[i + 2]!);
        if (Math.max(dr, dg, db) > PER_PIXEL_THRESHOLD) diff++;
      }
      const pct = (diff / total) * 100;

      expect(
        pct,
        `${name}: ${diff}/${total} pixels drifted >${PER_PIXEL_THRESHOLD}/255 (${pct.toFixed(2)}% — limit ${TOLERANCE_PCT}%). If intentional, copy .test-screenshots/visual-matrix/${name} to src/app/__baselines__/visual-matrix/${name}.`,
      ).toBeLessThan(TOLERANCE_PCT);
    });
  }
});
