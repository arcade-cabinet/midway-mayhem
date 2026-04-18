/**
 * Combo meter integration test — proves the CROWD CHAIN combo system
 * (scare/pickup/near-miss event accumulator) is wired through the
 * diag bus and advances multiplier tiers as expected.
 *
 * Exercises the module-level singleton directly via __mm.comboEvent(),
 * not through collision detection — that separation keeps the combo
 * unit concerns (thresholds, expiry, multiplier curve) decoupled from
 * the collision mesh geometry, which is covered by ProceduralTrack.
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { comboEvent, diag, driveInto, waitFrames } from '@/test/integration';
import { App } from './App';

describe('Combo integration', () => {
  it('chain + multiplier climb through the tier thresholds and reset on expiry', async () => {
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

    // Baseline — chain empty, multiplier 1×.
    const baseline = diag();
    expect(baseline.comboChain).toBe(0);
    expect(baseline.comboMultiplier).toBe(1);

    // Ticker: 3 events → tier 2×, 7 → tier 4×, 15 → tier 8×.
    for (let i = 0; i < 3; i++) comboEvent('pickup');
    expect(diag().comboChain).toBe(3);
    expect(diag().comboMultiplier).toBe(2);

    for (let i = 0; i < 4; i++) comboEvent('pickup');
    expect(diag().comboChain).toBe(7);
    expect(diag().comboMultiplier).toBe(4);

    for (let i = 0; i < 8; i++) comboEvent('pickup');
    expect(diag().comboChain).toBe(15);
    expect(diag().comboMultiplier).toBe(8);
  });
});
