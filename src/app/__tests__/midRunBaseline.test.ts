/**
 * Mid-run visual regression gate. Companion to the browser-side
 * `MidRunVisualBaseline.browser.test.tsx` which captures a PNG at
 * distance≥120m into `.test-screenshots/mid-run/desktop.png`.
 *
 * Higher tolerance than the cockpit-only baseline (PR #149): mid-run
 * frames include procedural content affected by RNG seed drift, HUD
 * digits, zone transitions, and environment HDRI sampling — all sources
 * of legitimate pixel jitter that still doesn't mean the game broke.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(__dirname, '..', '__baselines__', 'mid-run-desktop.png');
const CURRENT = join(__dirname, '..', '..', '..', '.test-screenshots', 'mid-run', 'desktop.png');

/** Higher per-pixel threshold than cockpit: mid-run frames have AA
 *  + HDRI sample jitter. */
const PER_PIXEL_THRESHOLD = 40; // 0..255
/** Looser tolerance since content is procedurally generated. */
const TOLERANCE_PCT = 8;

describe('Mid-run visual regression — Phase 4 live-game gate', () => {
  it('captured frame matches pinned baseline within tolerance', () => {
    expect(existsSync(BASELINE), `baseline missing: ${BASELINE}`).toBe(true);

    if (!existsSync(CURRENT)) {
      // Browser test hasn't run in this invocation — skip rather than fail.
      return;
    }

    const baseline = PNG.sync.read(readFileSync(BASELINE));
    const current = PNG.sync.read(readFileSync(CURRENT));

    if (baseline.width !== current.width || baseline.height !== current.height) {
      throw new Error(
        `dimension mismatch: baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}`,
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
      `${diff}/${total} pixels drifted >${PER_PIXEL_THRESHOLD}/255 (${pct.toFixed(2)}% — limit ${TOLERANCE_PCT}%). If intentional, copy .test-screenshots/mid-run/desktop.png to src/app/__baselines__/mid-run-desktop.png.`,
    ).toBeLessThan(TOLERANCE_PCT);
  });
});
