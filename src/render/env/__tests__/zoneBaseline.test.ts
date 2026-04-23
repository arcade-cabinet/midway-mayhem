/**
 * Per-zone pinned baseline diff — node-side companion to ZoneVisuals.browser.test.tsx.
 *
 * Reads the PNG files written by the browser test from .test-screenshots/zones/
 * and diffs each against the pinned baseline in
 * src/render/env/__baselines__/zones/.
 *
 * A per-pixel colour channel delta > 32/255 counts as a "drifted" pixel.
 * The test fails if more than 15% of pixels drift — the same tolerance used
 * by the track archetype baseline gate.
 *
 * Skips gracefully when .test-screenshots/zones/ is empty (node + browser
 * run in separate CI jobs). The baseline pinning workflow is:
 *   1. Run pnpm test:browser — writes .test-screenshots/zones/zone-<id>.png
 *   2. Visually review the PNGs
 *   3. Copy to src/render/env/__baselines__/zones/ to pin them
 *   4. Future runs of pnpm test:node will detect regressions
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import type { ZoneId } from '@/utils/constants';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(__dirname, '..', '__baselines__', 'zones');
const CURRENT_DIR = join(__dirname, '..', '..', '..', '..', '.test-screenshots', 'zones');

const PER_PIXEL_THRESHOLD = 32; // 0..255 — same as trackArchetypeBaseline
const TOLERANCE_PCT = 15;

const ZONES: ZoneId[] = ['midway-strip', 'balloon-alley', 'ring-of-fire', 'funhouse-frenzy'];

describe('per-zone pinned baselines', () => {
  for (const zoneId of ZONES) {
    const name = `zone-${zoneId}.png`;

    it(`${name} matches pinned baseline within ${TOLERANCE_PCT}%`, () => {
      const baselinePath = join(BASELINE_DIR, name);
      const currentPath = join(CURRENT_DIR, name);

      // Baseline must exist — if not, run pnpm test:browser first, review
      // .test-screenshots/zones/<name>, then copy it to __baselines__/zones/
      // to activate the gate.
      expect(
        existsSync(baselinePath),
        `Baseline missing: ${baselinePath}\n` +
          `Run pnpm test:browser, review .test-screenshots/zones/${name}, ` +
          `then copy it to src/render/env/__baselines__/zones/${name} to pin.`,
      ).toBe(true);

      // Current screenshot may be absent when running node-only (skip silently).
      if (!existsSync(currentPath)) return;

      const baseline = PNG.sync.read(readFileSync(baselinePath));
      const current = PNG.sync.read(readFileSync(currentPath));

      if (baseline.width !== current.width || baseline.height !== current.height) {
        throw new Error(
          `Dimension mismatch for ${name}: ` +
            `baseline ${baseline.width}×${baseline.height} vs ` +
            `current ${current.width}×${current.height}`,
        );
      }

      const total = baseline.width * baseline.height;
      let diff = 0;
      const d1 = baseline.data;
      const d2 = current.data;
      for (let i = 0; i < d1.length; i += 4) {
        const dr = Math.abs((d1[i] ?? 0) - (d2[i] ?? 0));
        const dg = Math.abs((d1[i + 1] ?? 0) - (d2[i + 1] ?? 0));
        const db = Math.abs((d1[i + 2] ?? 0) - (d2[i + 2] ?? 0));
        if (Math.max(dr, dg, db) > PER_PIXEL_THRESHOLD) diff++;
      }
      const pct = (diff / total) * 100;

      expect(
        pct,
        `${name}: ${diff}/${total} pixels drifted >${PER_PIXEL_THRESHOLD}/255 ` +
          `(${pct.toFixed(2)}% — limit ${TOLERANCE_PCT}%). ` +
          `If intentional, copy .test-screenshots/zones/${name} to ` +
          `src/render/env/__baselines__/zones/${name}.`,
      ).toBeLessThan(TOLERANCE_PCT);
    });
  }
});
