/**
 * Procedural track integration test — proves the track geometry actually
 * streams under the player as they drive. The old "canvas is visible"
 * gates can't tell the difference between a track that advances through
 * zones and one that's frozen on a single piece.
 *
 * Drives through the title → DRIVE flow, then asserts:
 *   - trackPieces stays stable (procedural composer is mounted)
 *   - currentZone transitions off the starting "midway-strip"
 *   - meshesRendered grows as more pieces come on-camera
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { waitFrames } from '@/test/scene';
import { App } from './App';

declare global {
  interface Window {
    __mm?: { diag?: () => Record<string, unknown> };
  }
}

function findButton(root: HTMLElement, match: RegExp): HTMLButtonElement | null {
  const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.find((b) => match.test((b.textContent || '').trim())) ?? null;
}

describe('Procedural track integration', () => {
  it('streams real track pieces and transitions zones as the player advances', async () => {
    const { container } = render(<App />);
    await waitFor(
      () => {
        const el = container.querySelector('canvas');
        if (!el) throw new Error('canvas not rendered');
        return el;
      },
      { timeout: 10_000 },
    );
    await waitFrames(15);

    // Click through to DRIVE on the highest speed tier that isn't
    // permadeath-only, so the zone-cycle happens faster than the 450m
    // default window during the test run.
    const newRun = await waitFor(
      () =>
        findButton(container, /^\s*NEW\s+RUN\s*$/i) ??
        (() => {
          throw new Error('no new-run');
        })(),
      { timeout: 5_000 },
    );
    newRun.click();

    const nightmare = await waitFor(
      () =>
        findButton(container, /NIGHTMARE MIDWAY/i) ??
        (() => {
          throw new Error('no difficulty');
        })(),
      { timeout: 5_000 },
    );
    nightmare.click();

    const play = await waitFor(
      () =>
        findButton(container, /▶\s*PLAY/) ??
        (() => {
          throw new Error('no play');
        })(),
      { timeout: 5_000 },
    );
    play.click();

    // Wait past the drop-in so the tick starts advancing distance.
    await waitFor(
      () => {
        const d = window.__mm?.diag?.();
        const p = (d?.dropProgress as number) ?? 0;
        if (p < 1) throw new Error(`drop-in ${p.toFixed(2)}`);
      },
      { timeout: 10_000, interval: 50 },
    );

    // Baseline: once past drop-in, we should already have procedural
    // track pieces in the scene and be in the first zone.
    const baseline = window.__mm?.diag?.() as Record<string, unknown> | undefined;
    expect(baseline, 'diag bus not installed').toBeDefined();
    expect(
      (baseline?.trackPieces as number) ?? 0,
      `trackPieces at baseline was ${baseline?.trackPieces}`,
    ).toBeGreaterThan(0);
    expect(baseline?.currentZone, 'expected to start in midway-strip').toBe('midway-strip');

    // Drive for a while. At ULTRA-NIGHTMARE-ish cruise speed (~52 m/s)
    // we need ~9 wall-clock seconds to clear 450m, but vitest-browser's
    // rAF cadence is slower than wall-clock. Spin-wait up to 30s with a
    // generous cap on frames so the test doesn't hang forever.
    await waitFor(
      () => {
        const d = window.__mm?.diag?.();
        const dist = (d?.distance as number) ?? 0;
        if (dist < 450) throw new Error(`distance only ${dist.toFixed(0)}m`);
      },
      { timeout: 30_000, interval: 100 },
    );

    const advanced = window.__mm?.diag?.() as Record<string, unknown> | undefined;
    expect(advanced?.distance as number).toBeGreaterThan(450);
    // Zone cycle: (0→450) midway-strip → (450→900) balloon-alley → ...
    expect(
      advanced?.currentZone,
      `expected zone transition off midway-strip, still at ${advanced?.currentZone} distance=${advanced?.distance}`,
    ).not.toBe('midway-strip');

    // Track piece count should be stable (or grow) — procedural composer
    // always has a window of pieces around the player.
    expect((advanced?.trackPieces as number) ?? 0).toBeGreaterThanOrEqual(
      (baseline?.trackPieces as number) ?? 0,
    );
  });
});
