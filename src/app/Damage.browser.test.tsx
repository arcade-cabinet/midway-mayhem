/**
 * Damage-flow integration test — proves crashes decrement sanity and
 * enough heavy crashes trigger game-over.
 *
 * The old browser smoke tests have no way to know whether applyCrash()
 * actually propagates through the ECS trait write → HUD read → game-
 * over detector. This drives a run to active state, fires heavy crashes,
 * and asserts sanity drops + gameOver eventually flips.
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crash, diag, driveInto, waitFrames } from '@/test/integration';
import { App } from './App';

describe('Damage-flow integration', () => {
  it('crashes decrement sanity, enough crashes flip gameOver', async () => {
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
    expect(baseline.sanity).toBe(100);
    expect(baseline.crashes).toBe(0);
    expect(baseline.gameOver).toBe(false);

    // Fire one heavy crash — sanity drops, crash count increments.
    crash(true);
    await waitFrames(5);
    const afterOne = diag();
    expect(afterOne.sanity, `sanity after one heavy crash: ${afterOne.sanity}`).toBeLessThan(100);
    expect(afterOne.crashes).toBeGreaterThan(0);

    // Hammer crashes until game over. 20 heavy crashes ought to more
    // than exhaust the 100-sanity budget even with regen ticking back.
    for (let i = 0; i < 20; i++) {
      if (diag().gameOver) break;
      crash(true);
      await waitFrames(2);
    }

    const final = diag();
    expect(
      final.gameOver,
      `gameOver never flipped after 20 heavy crashes — sanity ${final.sanity}, crashes ${final.crashes}`,
    ).toBe(true);
  });
});
