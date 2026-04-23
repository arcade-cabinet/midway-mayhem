/**
 * Per-archetype baseline diff. Companion to TrackArchetypes.browser.test.tsx
 * which dumps one PNG per archetype into .test-screenshots/archetypes/.
 * Diffs each against pinned baselines under src/track/__baselines__/archetypes/.
 *
 * The archetype captures are FIXED: camera, lighting, piece orientation
 * are all deterministic per archetype — so the per-pixel tolerance can be
 * much tighter than the full-run baselines. A visible change here means
 * an archetype's geometry actually changed.
 *
 * Skips gracefully when .test-screenshots is empty (node + browser run in
 * separate jobs).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { trackArchetypes } from '@/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(__dirname, '..', '__baselines__', 'archetypes');
const CURRENT_DIR = join(__dirname, '..', '..', '..', '.test-screenshots', 'archetypes');

const PER_PIXEL_THRESHOLD = 32; // 0..255
const TOLERANCE_PCT = 15;

const VIEW_SUFFIXES = ['', '-side'] as const;

describe('per-archetype pinned baselines', () => {
  for (const arch of trackArchetypes.archetypes) {
    for (const suffix of VIEW_SUFFIXES) {
      const name = `${arch.id}${suffix}.png`;

      it(`${name} matches pinned baseline within ${TOLERANCE_PCT}%`, () => {
        const baselinePath = join(BASELINE_DIR, name);
        const currentPath = join(CURRENT_DIR, name);

        expect(existsSync(baselinePath), `baseline missing: ${baselinePath}`).toBe(true);

        if (!existsSync(currentPath)) return; // browser test ran elsewhere

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
          `${name}: ${diff}/${total} pixels drifted >${PER_PIXEL_THRESHOLD}/255 (${pct.toFixed(2)}% — limit ${TOLERANCE_PCT}%). If intentional, copy .test-screenshots/archetypes/${name} to src/track/__baselines__/archetypes/${name}.`,
        ).toBeLessThan(TOLERANCE_PCT);
      });
    }
  }
});
