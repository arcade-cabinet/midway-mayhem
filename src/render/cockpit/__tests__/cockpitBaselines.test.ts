/**
 * Cockpit visual-regression gate (Phase 4). Compares the current
 * browser-test render output against the pinned baseline PNGs in
 * `src/render/cockpit/__baselines__/`.
 *
 * How it works:
 *   1. `Cockpit.browser.test.tsx` writes a fresh PNG per form-factor
 *      tier to `.test-screenshots/cockpit/<tier>.png` (runtime, gitignored).
 *   2. This Node test reads both files and compares them pixel-by-pixel
 *      via pngjs + a simple perceptual-tolerance check — the test fails
 *      if more than TOLERANCE_PCT of pixels differ beyond PER_PIXEL_THRESHOLD.
 *
 * Why Node + pngjs rather than in-browser canvas:
 *   - The browser test runs in Chromium with preserveDrawingBuffer and a
 *     live r3f canvas; introducing a second render there fights with
 *     the first. Node-side diffing keeps the browser test fast + pure.
 *   - pngjs is pure JS, no native deps, works in vitest's Node pool.
 *
 * When the baseline needs to update: copy
 *   `.test-screenshots/cockpit/<tier>.png`
 * to
 *   `src/render/cockpit/__baselines__/<tier>.png`
 * and commit. Rule: NEVER update a baseline without a screenshot in the
 * PR showing the intended visual change.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(__dirname, '..', '__baselines__');
const CURRENT_DIR = join(__dirname, '..', '..', '..', '..', '.test-screenshots', 'cockpit');

const TIERS = ['phone-portrait', 'phone-landscape', 'tablet-portrait', 'desktop'] as const;

/** Max absolute difference per color channel before a pixel counts as "changed". */
const PER_PIXEL_THRESHOLD = 24; // 0..255 scale; ~10% drift tolerated
/** Max percentage of pixels that may exceed PER_PIXEL_THRESHOLD. */
const TOLERANCE_PCT = 1.5; // allow 1.5% pixels to drift (aliasing, AA jitter)

interface DiffStats {
  totalPixels: number;
  differentPixels: number;
  diffPct: number;
}

function loadPng(path: string): PNG {
  const buf = readFileSync(path);
  return PNG.sync.read(buf);
}

function comparePng(baseline: PNG, current: PNG): DiffStats {
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return { totalPixels: 0, differentPixels: -1, diffPct: 100 };
  }
  const len = baseline.data.length;
  const totalPixels = baseline.width * baseline.height;
  let differentPixels = 0;
  for (let i = 0; i < len; i += 4) {
    const dr = Math.abs(baseline.data[i]! - current.data[i]!);
    const dg = Math.abs(baseline.data[i + 1]! - current.data[i + 1]!);
    const db = Math.abs(baseline.data[i + 2]! - current.data[i + 2]!);
    const maxDiff = Math.max(dr, dg, db);
    if (maxDiff > PER_PIXEL_THRESHOLD) differentPixels++;
  }
  return {
    totalPixels,
    differentPixels,
    diffPct: (differentPixels / totalPixels) * 100,
  };
}

describe('cockpit visual regression — Phase 4 baseline gate', () => {
  for (const tier of TIERS) {
    it(`${tier} matches pinned baseline within ${TOLERANCE_PCT}%`, () => {
      const baselinePath = join(BASELINE_DIR, `${tier}.png`);
      const currentPath = join(CURRENT_DIR, `${tier}.png`);

      expect(existsSync(baselinePath), `baseline PNG missing: ${baselinePath}`).toBe(true);

      if (!existsSync(currentPath)) {
        // Skip if the browser test hasn't run yet — this file is a
        // POST-browser check. In CI the browser test runs first.
        return;
      }

      const baseline = loadPng(baselinePath);
      const current = loadPng(currentPath);
      const stats = comparePng(baseline, current);

      if (stats.differentPixels < 0) {
        throw new Error(
          `[${tier}] dimensions mismatch — baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}`,
        );
      }

      expect(
        stats.diffPct,
        `[${tier}] ${stats.differentPixels}/${stats.totalPixels} pixels exceeded threshold (${stats.diffPct.toFixed(2)}% — limit ${TOLERANCE_PCT}%). If intentional, copy .test-screenshots/cockpit/${tier}.png to src/render/cockpit/__baselines__/${tier}.png.`,
      ).toBeLessThan(TOLERANCE_PCT);
    });
  }
});
