/**
 * Pickup-flow integration test — proves collecting tickets increments
 * the run counter and mega/boost pickups boost the speed target.
 *
 * The applyPickup ECS path writes to GameplayStats.crowdReaction +
 * RunCounters.ticketsThisRun, and boost pickups extend BoostState. A
 * silent refactor could easily break any of those writes; this gate
 * catches it at the behaviour level.
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { diag, driveInto, pickup, waitFrames } from '@/test/integration';
import { App } from './App';

describe('Pickup-flow integration', () => {
  it('ticket pickups increment ticketsThisRun + crowdReaction', async () => {
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

    const baseline = diag();
    expect(baseline.ticketsThisRun).toBe(0);

    // Collect 5 tickets.
    for (let i = 0; i < 5; i++) {
      pickup('ticket');
      await waitFrames(1);
    }

    const afterFive = diag();
    expect(afterFive.ticketsThisRun).toBe(5);
    // crowdReaction bumped by ~50 × 5 × cleanBonus; at least 5×50 = 250
    // even with a pessimistic cleanBonus of 1.0.
    expect(afterFive.crowdReaction).toBeGreaterThanOrEqual(250);
  });

  it('mega pickup pushes speedMps toward the mega target', async () => {
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

    // Wait until we're past the speed-ramp-up so cruise is stable.
    await waitFor(
      () => {
        const s = diag().speedMps;
        if (s < 5) throw new Error(`speed only ${s.toFixed(1)} m/s, still ramping`);
      },
      { timeout: 8_000, interval: 100 },
    );

    const beforeMega = diag();
    const cruiseSpeed = beforeMega.speedMps;

    pickup('mega');
    // Give the tick a few frames to interpolate speed toward the new target.
    await waitFrames(20);

    const afterMega = diag();
    expect(
      afterMega.speedMps,
      `speed after mega pickup: ${afterMega.speedMps} (was ${cruiseSpeed})`,
    ).toBeGreaterThan(cruiseSpeed);
  });
});
