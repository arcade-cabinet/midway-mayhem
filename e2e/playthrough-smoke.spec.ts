/**
 * Fast merge-gate playthrough smoke. One phrase, desktop viewport only,
 * 1-second intervals × 5 frames = ~5s sampling + boot = ~20s total.
 *
 * Counterpart to `seed-playthroughs.spec.ts` which exercises 3 phrases
 * × 3 viewports × 15 frames for deep regression coverage. That suite
 * takes 4-10 minutes and has repeatedly stalled on CI runners — fine
 * as telemetry, too slow + flaky for a merge gate.
 *
 * This spec's contract is narrow:
 *   - the canonical phrase boots into gameplay
 *   - the car physically moves (distance grows between samples)
 *   - no fatal console errors surface during the run
 *
 * If this fails, autoplay itself is broken and no larger spec has a
 * chance. Keep it targeted and keep it fast.
 */
import { expect, test } from '@playwright/test';
import { runPlaythrough } from './_factory';

const SMOKE_PHRASE = 'neon-polkadot-jalopy';

test.describe('playthrough smoke — fast merge gate', () => {
  test('canonical phrase boots + advances on desktop', async ({ page }, testInfo) => {
    // Skip on non-desktop projects; smoke is desktop-only by design.
    test.skip(testInfo.project.name !== 'desktop-chromium', 'smoke runs on desktop-chromium only');
    // 90s: boot (~15s) + 5 × 1s intervals + per-frame screenshot
    // (~2-3s on swiftshader including font-loading wait) + slack.
    // First CI run timed out at 60s inside page.screenshot's
    // "waiting for fonts" phase.
    test.setTimeout(90_000);

    const frames = await runPlaythrough(page, testInfo, {
      phrase: SMOKE_PHRASE,
      difficulty: 'plenty',
      intervalMs: 1_000,
      maxFrames: 5,
    });

    expect(frames.length, 'expected 5 frames sampled').toBe(5);

    // Distance must grow between first and last samples — cheap proof
    // that autoplay committed and the car is under motion.
    const first = (frames[0]?.diag?.distance as number) ?? 0;
    const last = (frames[frames.length - 1]?.diag?.distance as number) ?? 0;
    expect(
      last,
      `expected last distance > first (${first} → ${last}); car not moving`,
    ).toBeGreaterThan(first);

    // Car covered at least 20m in the 5s window — proves the run was
    // actually progressing, not just a tiny drift.
    expect(
      last,
      `expected last distance ≥ 20m after 5s; got ${last.toFixed(2)}m`,
    ).toBeGreaterThanOrEqual(20);
  });
});
