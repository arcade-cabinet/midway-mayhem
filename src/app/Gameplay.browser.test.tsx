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
import { diag, driveInto, waitFrames } from '@/test/integration';
import { App } from './App';

describe('Gameplay integration', () => {
  it('advances distance + speed after clicking through to DRIVE', async () => {
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

    // Capture snapshots over ~30 frames of gameplay after drop-in.
    const snapshots: Array<{ distance: number; speed: number; fps: number }> = [];
    for (let i = 0; i < 30; i++) {
      await waitFrames(1);
      const d = diag();
      snapshots.push({ distance: d.distance, speed: d.speedMps, fps: d.fps });
    }

    const last = snapshots[snapshots.length - 1];
    const first = snapshots[0];
    if (!last || !first) throw new Error('no snapshots captured');

    // Distance must strictly advance from 0. If the tick isn't running
    // this stays at 0 forever and the car appears frozen on the starting
    // platform — the exact bug the old "canvas is visible" gates missed.
    expect(
      last.distance,
      `distance only reached ${last.distance}m after 30 frames`,
    ).toBeGreaterThan(0);
    expect(last.distance).toBeGreaterThan(first.distance);

    // Speed ramps from 0 toward the cruise target.
    expect(last.speed, `speed stayed at ${last.speed} m/s`).toBeGreaterThan(0);

    // Diagnostics bus must be receiving frame samples (proves useFrame fires).
    expect(last.fps, `fps was ${last.fps}`).toBeGreaterThan(0);
  });
});
