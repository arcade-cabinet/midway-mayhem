/**
 * H3 — pixel-exact cockpit diff on deterministic region.
 *
 * Companion to cockpitBaselines.test.ts. Uses 0% tolerance + 0 per-pixel
 * threshold, but only checks a bounded inner region (inner 40% of the frame)
 * where the cockpit hood, steering wheel, and A-pillars are geometrically
 * deterministic — no postFX noise, no animated gauges, no blur bleeding from
 * frame edges.
 *
 * One tier only: desktop (1280×720). Phone/tablet viewports introduce
 * form-factor layout variance that would cause false positives on the strict
 * zero-tolerance check.
 *
 * When to update:
 *   If this test flags a regression, inspect the diff visually first.
 *   If the change is intentional, copy
 *     .test-screenshots/cockpit/desktop.png
 *   to
 *     src/render/cockpit/__baselines__/desktop.png
 *   and commit with a screenshot in the PR showing the intended change.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(__dirname, '..', '__baselines__');
const CURRENT_DIR = join(__dirname, '..', '..', '..', '..', '..', '.test-screenshots', 'cockpit');

/** We only check the desktop tier for pixel-exact comparison. */
const TIER = 'desktop';

/**
 * Inner region: centre 40% of the frame in each axis.
 * At 1280×720 → x: [384, 896), y: [216, 504).
 * This bounds the hood cowl, steering wheel hub, and the two A-pillars —
 * all of which are purely geometry-driven with no postFX noise.
 */
const REGION_FRACTION = 0.4;

interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function innerRegion(width: number, height: number): Region {
  const marginX = Math.round((width * (1 - REGION_FRACTION)) / 2);
  const marginY = Math.round((height * (1 - REGION_FRACTION)) / 2);
  return {
    x0: marginX,
    y0: marginY,
    x1: width - marginX,
    y1: height - marginY,
  };
}

function loadPng(path: string): PNG {
  const buf = readFileSync(path);
  return PNG.sync.read(buf);
}

interface ExactDiffStats {
  totalPixels: number;
  differentPixels: number;
  firstDiffX: number;
  firstDiffY: number;
}

/**
 * Pixel-exact comparison within the bounding region.
 * Any channel difference > 0 counts as a changed pixel.
 * Returns stats and the coordinates of the first differing pixel for diagnosis.
 */
function compareExact(baseline: PNG, current: PNG, region: Region): ExactDiffStats {
  const { x0, y0, x1, y1 } = region;
  const width = baseline.width;
  let differentPixels = 0;
  let firstDiffX = -1;
  let firstDiffY = -1;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * width + x) * 4;
      const dr = Math.abs(baseline.data[idx]! - current.data[idx]!);
      const dg = Math.abs(baseline.data[idx + 1]! - current.data[idx + 1]!);
      const db = Math.abs(baseline.data[idx + 2]! - current.data[idx + 2]!);
      if (dr + dg + db > 0) {
        differentPixels++;
        if (firstDiffX < 0) {
          firstDiffX = x;
          firstDiffY = y;
        }
      }
    }
  }

  const totalPixels = (x1 - x0) * (y1 - y0);
  return { totalPixels, differentPixels, firstDiffX, firstDiffY };
}

describe('cockpit pixel-exact diff — deterministic inner region (H3)', () => {
  it(`${TIER}: inner 40% region matches baseline pixel-for-pixel`, () => {
    const baselinePath = join(BASELINE_DIR, `${TIER}.png`);
    const currentPath = join(CURRENT_DIR, `${TIER}.png`);

    expect(existsSync(baselinePath), `baseline PNG missing: ${baselinePath}`).toBe(true);

    if (!existsSync(currentPath)) {
      // Skip if the browser test hasn't run yet.
      // In CI, Cockpit.browser.test.tsx always runs before this Node test.
      return;
    }

    const baseline = loadPng(baselinePath);
    const current = loadPng(currentPath);

    if (baseline.width !== current.width || baseline.height !== current.height) {
      throw new Error(
        `[${TIER}] dimensions mismatch — baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}`,
      );
    }

    const region = innerRegion(baseline.width, baseline.height);
    const stats = compareExact(baseline, current, region);

    expect(
      stats.differentPixels,
      [
        `[${TIER}] pixel-exact: ${stats.differentPixels}/${stats.totalPixels} pixels differ`,
        `in inner 40% region (${region.x0},${region.y0})→(${region.x1},${region.y1}).`,
        stats.firstDiffX >= 0 ? `First diff at (${stats.firstDiffX}, ${stats.firstDiffY}).` : '',
        `If this is an intentional visual change, update the baseline:`,
        `  cp .test-screenshots/cockpit/${TIER}.png src/render/cockpit/__baselines__/${TIER}.png`,
      ]
        .filter(Boolean)
        .join(' '),
    ).toBe(0);
  });
});
