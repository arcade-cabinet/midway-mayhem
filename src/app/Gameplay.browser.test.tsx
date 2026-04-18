/**
 * Gameplay integration test — proves the full DRIVE path actually ticks.
 *
 * Mounts <App/>, clicks NEW RUN → selects a difficulty → clicks PLAY,
 * then watches the diagnostics bus over ~30 frames. Distance must
 * monotonically increase, speed must ramp up from 0, and the GameLoop
 * must be reporting a non-zero fps.
 *
 * If this test fails, the DRIVE button is broken or the game-state tick
 * isn't running — the player sees the HUD but the car never moves.
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

describe('Gameplay integration', () => {
  it('advances distance + speed after clicking through to DRIVE', async () => {
    const { container } = render(<App />);
    await waitFor(() => {
      const el = container.querySelector('canvas');
      if (!el) throw new Error('canvas not rendered');
      return el;
    });
    await waitFrames(15);

    // Open NEW RUN modal.
    const newRun = await waitFor(
      () => {
        const b = findButton(container, /^\s*NEW\s+RUN\s*$/i);
        if (!b) throw new Error('NEW RUN button not yet mounted');
        return b;
      },
      { timeout: 5_000 },
    );
    newRun.click();

    // Pick a difficulty (KAZOO = default tier).
    const kazoo = await waitFor(
      () => {
        const b = findButton(container, /KAZOO/i);
        if (!b) throw new Error('difficulty picker not yet mounted');
        return b;
      },
      { timeout: 5_000 },
    );
    kazoo.click();

    // DRIVE.
    const play = await waitFor(
      () => {
        const b = findButton(container, /▶\s*PLAY/);
        if (!b) throw new Error('PLAY button not yet mounted');
        return b;
      },
      { timeout: 5_000 },
    );
    play.click();

    // Game should now be running. The drop-in intro freezes the ECS
    // tick for ~1800ms wall-clock — wait past it before sampling. Spin
    // until dropProgress actually hits 1 (the vitest-browser rAF cadence
    // is slower than wall-clock so a fixed frame count isn't enough).
    await waitFor(
      () => {
        const d = window.__mm?.diag?.();
        const p = (d?.dropProgress as number) ?? 0;
        if (p < 1) throw new Error(`drop-in at ${p.toFixed(2)}, waiting`);
      },
      { timeout: 10_000, interval: 50 },
    );

    // Capture snapshots over ~30 more frames of actual gameplay.
    const snapshots: Array<{ distance: number; speed: number; fps: number }> = [];
    for (let i = 0; i < 30; i++) {
      await waitFrames(1);
      const d = window.__mm?.diag?.();
      snapshots.push({
        distance: (d?.distance as number) ?? 0,
        speed: (d?.speedMps as number) ?? 0,
        fps: (d?.fps as number) ?? 0,
      });
    }

    const last = snapshots[snapshots.length - 1];
    const first = snapshots[0];
    if (!last || !first) throw new Error('no snapshots captured');

    // Distance must strictly advance from 0. If the tick isn't running
    // this stays at 0 forever and the car appears frozen on the starting
    // platform — the exact bug that would have been invisible to the old
    // "canvas is visible" gates.
    expect(
      last.distance,
      `distance only reached ${last.distance}m after 30 frames`,
    ).toBeGreaterThan(0);
    expect(last.distance).toBeGreaterThan(first.distance);

    // Speed must ramp from 0 toward the cruise target.
    expect(last.speed, `speed stayed at ${last.speed} m/s`).toBeGreaterThan(0);

    // Diagnostics bus must be receiving frame samples (proves useFrame fires).
    expect(last.fps, `fps was ${last.fps}`).toBeGreaterThan(0);
  });
});
