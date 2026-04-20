/**
 * Track-package regression gate. Companion to TrackPackage.browser.test.tsx
 * which dumps three isolated track renders (side / plan / pov) into
 * .test-screenshots/track-package/. Diffs each against pinned baselines
 * under src/track/__baselines__/track-package/.
 *
 * Same diff approach + tolerance as visualMatrixBaseline: 30% per-pixel
 * delta absorbs run-to-run jitter from anti-aliasing and HDRI sampling.
 * A real geometry regression (descent collapses, archetype renders the
 * wrong piece) drifts WELL past 30%.
 *
 * On CI: skips gracefully when .test-screenshots is missing (browser +
 * node tests run in separate jobs). Local dev catches drifts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(__dirname, '..', '__baselines__', 'track-package');
const CURRENT_DIR = join(__dirname, '..', '..', '..', '.test-screenshots', 'track-package');

const VIEWS = ['side', 'plan', 'pov'] as const;

const PER_PIXEL_THRESHOLD = 40; // 0..255
const TOLERANCE_PCT = 30;

describe('Track package — pinned baseline diff', () => {
  for (const view of VIEWS) {
    const name = `${view}.png`;

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
        `${name}: ${diff}/${total} pixels drifted >${PER_PIXEL_THRESHOLD}/255 (${pct.toFixed(2)}% — limit ${TOLERANCE_PCT}%). If intentional, copy .test-screenshots/track-package/${name} to src/track/__baselines__/track-package/${name}.`,
      ).toBeLessThan(TOLERANCE_PCT);
    });
  }
});
