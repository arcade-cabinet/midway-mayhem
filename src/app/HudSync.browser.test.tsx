/**
 * HUD/state sync integration test — proves the HUD readout mirrors the
 * real ECS state as the player drives.
 *
 * Drives into a run, waits past the drop-in, then samples diag() and
 * the HUD DOM text side-by-side. The DISTANCE and SANITY numbers shown
 * on screen must match the diag snapshot (within rounding), because
 * they both read from the same store. A regression where HUD falls out
 * of sync is a real user-facing bug (stale numbers, frozen stat bars).
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crash, diag, driveInto, waitForDistance, waitFrames } from '@/test/integration';
import { App } from './App';

/** Pull the first integer printed next to a label in the HUD. */
function hudNumber(root: ParentNode, label: RegExp): number | null {
  const text = (root.textContent ?? '').toUpperCase();
  // Labels render above their values separated by a newline, but textContent
  // flattens that to space-and-number. e.g. "DISTANCE 123 m".
  const re = new RegExp(`${label.source}[^0-9-]*(-?\\d+)`, 'i');
  const m = text.match(re);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

describe('HUD/state sync integration', () => {
  it('DISTANCE shown in HUD matches diag.distance after driving', async () => {
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

    await driveInto(container);
    await waitForDistance(20, 15_000);

    const snap = diag();
    const hudDistance = hudNumber(container, /DISTANCE/);
    expect(
      hudDistance,
      `HUD distance not found. Body: ${container.textContent?.slice(0, 300)}`,
    ).not.toBeNull();
    // The HUD rounds distance to integer. Allow ±1m slack to tolerate
    // the frame between the HUD render and our diag() read.
    const hudDist = hudDistance ?? 0;
    expect(Math.abs(hudDist - Math.round(snap.distance))).toBeLessThanOrEqual(1);
  });

  it('SANITY shown in HUD drops after a heavy crash', async () => {
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

    await driveInto(container);

    const sanityBefore = hudNumber(container, /SANITY/);
    expect(sanityBefore, 'expected SANITY stat in HUD').toBe(100);

    crash(true);
    await waitFrames(5);

    const sanityAfter = hudNumber(container, /SANITY/);
    expect(sanityAfter, `sanity after crash: ${sanityAfter} (was ${sanityBefore})`).not.toBeNull();
    expect(sanityAfter ?? 100).toBeLessThan(sanityBefore ?? 100);
    // Diag and HUD should agree.
    expect(Math.abs((sanityAfter ?? 100) - Math.round(diag().sanity))).toBeLessThanOrEqual(1);
  });
});
