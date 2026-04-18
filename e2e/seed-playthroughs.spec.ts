/**
 * Seed-deterministic playthroughs — run the same phrases every time,
 * dumping per-interval JSON diagnostics + PNG screenshots so any
 * regression in track generation, obstacle placement, or rendering is
 * visible as a diff against a prior dump.
 *
 * Each playthrough emits to test-results/<project>/<test-id>/playthrough/
 * <phrase>/frame-NN.{png,json} plus a summary.json. The dumps are the
 * canonical proof that "seed X at t=Ns looks like THIS".
 */
import { expect, test } from '@playwright/test';
import { runPlaythrough } from './_factory';

const CANON_PHRASES = [
  // Canon phrases chosen for zone coverage — each runs long enough to
  // traverse at least two zone bands. Keep them stable forever.
  'neon-polkadot-jalopy', // canonical brand phrase
  'molten-checkered-parade',
  'cosmic-harlequin-bozo',
] as const;

test.describe('seed-deterministic playthroughs', () => {
  for (const phrase of CANON_PHRASES) {
    test(`phrase "${phrase}" advances deterministically`, async ({ page }, testInfo) => {
      // Mobile emulator runs too slowly for full 30-interval playthroughs.
      test.skip(
        testInfo.project.name === 'mobile-portrait',
        'mobile playthroughs covered by dedicated short specs',
      );
      test.setTimeout(240_000);
      const frames = await runPlaythrough(page, testInfo, {
        phrase,
        difficulty: 'plenty',
        intervalMs: 2000,
        maxFrames: 15,
        stopWhen: /run complete|game over/i,
      });

      // At least 3 frames (or the run terminated early — that's ok)
      expect(frames.length, 'expected multiple frames sampled').toBeGreaterThanOrEqual(3);

      // Distance must strictly increase between samples (until the run ends).
      const distances = frames
        .map((f) => (f.diag?.distance as number) ?? 0)
        .filter((d) => typeof d === 'number');
      // Compare successive pairs: each d[i+1] >= d[i] (monotonic; plunge
      // recoveries may freeze briefly but shouldn't regress).
      for (let i = 1; i < distances.length; i++) {
        expect(
          distances[i],
          `distance regressed at frame ${i}: ${distances[i - 1]} → ${distances[i]}`,
        ).toBeGreaterThanOrEqual(distances[i - 1]! - 0.01);
      }

      // Final sample should be meaningfully far from origin unless run ended.
      const last = frames[frames.length - 1];
      const lastDistance = (last?.diag?.distance as number) ?? 0;
      expect(
        lastDistance,
        'expected final distance > 50m (proves the car actually moved)',
      ).toBeGreaterThan(50);
    });
  }
});
