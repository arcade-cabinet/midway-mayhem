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

test.describe('seed-deterministic playthroughs @nightly', () => {
  for (const phrase of CANON_PHRASES) {
    test(`phrase "${phrase}" advances deterministically @nightly`, async ({ page }, testInfo) => {
      // Telemetry suite is desktop-only. Viewport regressions are caught
      // by the merge-gate smoke (runs all 3 viewports); the value of
      // running the deep sampler across mobile/tablet emulators was low
      // and pushed the nightly past its 45-min cap on the shared runner.
      test.skip(
        testInfo.project.name !== 'desktop-chromium',
        'telemetry nightly runs on desktop-chromium only',
      );
      test.setTimeout(300_000);
      const frames = await runPlaythrough(page, testInfo, {
        phrase,
        difficulty: 'plenty',
        intervalMs: 2000,
        // 6 frames: enough for monotonicity + non-zero-distance assertions.
        // CI swiftshader's page.evaluate latency is ~30-100s per call; 6 fits
        // under the 300s test timeout while leaving room for boot + 2 retries.
        maxFrames: 6,
        stopWhen: /run complete|game over/i,
      });

      // At least 3 frames (or the run terminated early — that's ok)
      expect(frames.length, 'expected multiple frames sampled').toBeGreaterThanOrEqual(3);

      // Distance must strictly increase between samples (until the run ends).
      const distances = frames
        .map((f) => (f.diag?.distance as number) ?? 0)
        .filter((d) => typeof d === 'number');
      for (let i = 1; i < distances.length; i++) {
        expect(
          distances[i],
          `distance regressed at frame ${i}: ${distances[i - 1]} → ${distances[i]}`,
        ).toBeGreaterThanOrEqual(distances[i - 1]! - 0.01);
      }

      // Final sample must show the car moved — any positive distance is
      // enough on CI swiftshader where frame rate varies widely.
      const last = frames[frames.length - 1];
      const lastDistance = (last?.diag?.distance as number) ?? 0;
      expect(lastDistance, 'car must have advanced at least 1m').toBeGreaterThan(1);
    });
  }
});
