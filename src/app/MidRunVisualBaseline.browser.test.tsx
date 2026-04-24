/**
 * Mid-run visual baseline — the missing link in Phase 4 of the cockpit
 * hero pass. Cockpit.browser.test.tsx already pins a BARE-COCKPIT
 * baseline at 4 form-factor tiers, but the cockpit alone misses the
 * actual game: track, obstacles, HDRI, HUD, zone props.
 *
 * This test mounts the real <App/>, clicks through to DRIVE, waits
 * past drop-in + 120m of progress (well into zone 1 but short of
 * zone 2), then captures a screenshot and dumps it to
 * `.test-screenshots/mid-run/desktop.png`. Post-run the Node
 * `midRunBaseline.test.ts` diffs it against the pinned baseline.
 *
 * If this test fails, the live game's rendering has regressed — the
 * kind of thing that happened silently in #119/#134 before we had any
 * visual gate.
 */
import { render, waitFor } from '@testing-library/react';
import { commands } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { diag, driveInto, waitForDistance, waitFrames } from '@/test/integration';
import { App } from './App';

describe('Mid-run visual baseline', () => {
  it('captures a live-game frame at distance ≥ 120m for pixel-diff regression', async () => {
    // Opt into preserveDrawingBuffer for the duration of this test so
    // canvas.toDataURL() below returns the last rendered frame instead
    // of a cleared buffer. Prod / CI E2E leaves the flag off to avoid
    // swiftshader ReadPixels stalls.
    window.history.replaceState({}, '', '/?preserve=1');

    const { container } = render(<App />);

    // Canvas mounts.
    const canvas = await waitFor(
      () => {
        const el = container.querySelector('canvas');
        if (!el) throw new Error('canvas not rendered');
        return el;
      },
      { timeout: 10_000 },
    );
    await waitFrames(15);

    // Click through title → new run → play, wait past drop-in intro.
    await driveInto(container);

    // Drive forward until we've cleared the start platform and have
    // some track + obstacles visible. 120m is far enough that the
    // hood + dashboard + at least one obstacle band is in frame.
    await waitForDistance(120, 20_000);

    // One extra settle frame so the HUD numbers caught up.
    await waitFrames(2);

    const snap = diag();
    expect(snap.running, 'run must still be active when we capture').toBe(true);
    expect(snap.gameOver, 'no game-over during baseline capture').toBe(false);
    expect(snap.distance, `distance was ${snap.distance}`).toBeGreaterThanOrEqual(120);

    // Write the screenshot. Node-side test diffs it against pinned baseline.
    const dataUrl = canvas.toDataURL('image/png');
    const result = await commands.writePngFromDataUrl(
      dataUrl,
      `.test-screenshots/mid-run/desktop.png`,
    );
    expect(result.bytes, 'mid-run PNG must have real content').toBeGreaterThan(20_000);
  });
});
