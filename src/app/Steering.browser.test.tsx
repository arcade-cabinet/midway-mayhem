/**
 * Steering integration test — proves steer input propagates through the
 * ECS Steer trait → GameplayStats.lateral over a handful of ticks.
 *
 * Catches regressions where the input bridges (keyboard, mouse, touch,
 * governor) feed a different store than the one the tick reads from —
 * a subtle error that would leave the car running straight no matter
 * what the player does.
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { diag, driveInto, setSteer, waitFrames } from '@/test/integration';
import { App } from './App';

describe('Steering integration', () => {
  it('setSteer moves the player laterally in the commanded direction', async () => {
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

    // Let the tick settle at lateral ≈ 0 before steering.
    setSteer(0);
    await waitFrames(10);
    const centred = diag();
    expect(Math.abs(centred.lateral), `lateral at rest: ${centred.lateral}`).toBeLessThan(1);

    // Full right lock for ~40 frames should push lateral positive
    // relative to the settled-centre baseline. The threshold only asks
    // for meaningful movement (0.2m), not full-lock saturation, so the
    // test isn't sensitive to tunables.maxSteerRate changes.
    setSteer(1);
    await waitFrames(40);
    const right = diag();
    expect(right.lateral, `lateral after steer=+1: ${right.lateral}`).toBeGreaterThan(
      centred.lateral + 0.2,
    );
    expect(right.steer, `steer trait stored: ${right.steer}`).toBeGreaterThan(0);

    // Full left lock for the same duration should push lateral below
    // the post-right value (direction flipped, magnitude at least as
    // strong).
    setSteer(-1);
    await waitFrames(40);
    const left = diag();
    expect(left.lateral, `lateral after steer=-1: ${left.lateral}`).toBeLessThan(right.lateral);
    expect(left.steer, `steer trait stored: ${left.steer}`).toBeLessThan(0);
  });
});
