/**
 * Per-cockpit-element baseline diff. Companion to CockpitElements.browser.test.tsx
 * which dumps one PNG per element group into .test-screenshots/cockpit-elements/.
 * Diffs each against pinned baselines under src/render/cockpit/__baselines__/elements/.
 *
 * Tighter tolerance (15%) than the full-cockpit per-tier baselines (which
 * allow 1.5%) — each element here is isolated, camera-framed, and
 * deterministic, so any real drift is a structural change in the mesh or
 * its material.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(__dirname, '..', '__baselines__', 'elements');
const CURRENT_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '.test-screenshots',
  'cockpit-elements',
);

const ELEMENTS = [
  'steering-column',
  'pillars-arch',
  'dashboard',
  'hood-flower',
  'mirror-dice',
  'seat',
];

const PER_PIXEL_THRESHOLD = 32;
const TOLERANCE_PCT = 15;

describe('per-cockpit-element pinned baselines', () => {
  for (const id of ELEMENTS) {
    const name = `${id}.png`;
    it(`${name} matches pinned baseline within ${TOLERANCE_PCT}%`, () => {
      const baselinePath = join(BASELINE_DIR, name);
      const currentPath = join(CURRENT_DIR, name);
      expect(existsSync(baselinePath), `baseline missing: ${baselinePath}`).toBe(true);
      if (!existsSync(currentPath)) return;

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
        `${name}: ${diff}/${total} pixels drifted >${PER_PIXEL_THRESHOLD}/255 (${pct.toFixed(2)}% — limit ${TOLERANCE_PCT}%). If intentional, copy .test-screenshots/cockpit-elements/${name} to src/render/cockpit/__baselines__/elements/${name}.`,
      ).toBeLessThan(TOLERANCE_PCT);
    });
  }
});
