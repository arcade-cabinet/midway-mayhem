import { describe, expect, it } from 'vitest';
import { ComboSystem } from '@/game/comboSystem';

/**
 * Creates a ComboSystem with a controllable fake clock.
 * Returns the system and a `tick(ms)` function to advance time.
 */
function makeCombo() {
  let nowMs = 0;
  const clock = () => nowMs;
  const combo = new ComboSystem(clock);
  const tick = (ms: number) => {
    nowMs += ms;
  };
  const setTime = (ms: number) => {
    nowMs = ms;
  };
  return { combo, tick, setTime };
}

describe('ComboSystem', () => {
  it('starts at chain 0 and multiplier 1×', () => {
    const { combo } = makeCombo();
    expect(combo.getChainLength()).toBe(0);
    expect(combo.getMultiplier()).toBe(1);
  });

  it('chain builds with each event', () => {
    const { combo } = makeCombo();
    combo.registerEvent('scare');
    expect(combo.getChainLength()).toBe(1);
    combo.registerEvent('pickup');
    expect(combo.getChainLength()).toBe(2);
    combo.registerEvent('near-miss');
    expect(combo.getChainLength()).toBe(3);
  });

  it('multiplier is 1× for chain < 3', () => {
    const { combo } = makeCombo();
    combo.registerEvent('scare');
    expect(combo.getMultiplier()).toBe(1);
    combo.registerEvent('pickup');
    expect(combo.getMultiplier()).toBe(1);
  });

  it('multiplier hits 2× at chain 3', () => {
    const { combo } = makeCombo();
    for (let i = 0; i < 3; i++) combo.registerEvent('scare');
    expect(combo.getMultiplier()).toBe(2);
  });

  it('multiplier hits 4× at chain 7', () => {
    const { combo } = makeCombo();
    for (let i = 0; i < 7; i++) combo.registerEvent('scare');
    expect(combo.getMultiplier()).toBe(4);
  });

  it('multiplier hits 8× at chain 15', () => {
    const { combo } = makeCombo();
    for (let i = 0; i < 15; i++) combo.registerEvent('scare');
    expect(combo.getMultiplier()).toBe(8);
  });

  it('multiplier stays at 8× beyond chain 15', () => {
    const { combo } = makeCombo();
    for (let i = 0; i < 20; i++) combo.registerEvent('scare');
    expect(combo.getMultiplier()).toBe(8);
    expect(combo.getChainLength()).toBe(20);
  });

  it('registerHit resets chain to 0 and multiplier to 1×', () => {
    const { combo } = makeCombo();
    for (let i = 0; i < 10; i++) combo.registerEvent('scare');
    expect(combo.getMultiplier()).toBe(4);
    combo.registerHit();
    expect(combo.getChainLength()).toBe(0);
    expect(combo.getMultiplier()).toBe(1);
  });

  it('chain expires after 3.5s of inactivity', () => {
    const { combo, tick } = makeCombo();
    combo.registerEvent('scare');
    combo.registerEvent('pickup');
    expect(combo.getChainLength()).toBe(2);

    // Advance time by 3.6 s
    tick(3600);

    expect(combo.getChainLength()).toBe(0);
    expect(combo.getMultiplier()).toBe(1);
  });

  it('chain does NOT expire before 3.5s', () => {
    const { combo, tick } = makeCombo();
    combo.registerEvent('scare');
    combo.registerEvent('pickup');
    tick(3000);
    expect(combo.getChainLength()).toBe(2);
    expect(combo.getMultiplier()).toBe(1);
  });

  it('new event resets expiry clock', () => {
    const { combo, tick } = makeCombo();
    combo.registerEvent('scare');
    tick(3000); // 3s — not yet expired
    combo.registerEvent('pickup'); // re-arms clock
    tick(3000); // another 3s from last event — still alive
    expect(combo.getChainLength()).toBe(2);
  });

  it('getLastEventAt returns 0 on fresh instance', () => {
    const { combo } = makeCombo();
    expect(combo.getLastEventAt()).toBe(0);
  });

  it('getLastEventAt is updated after event', () => {
    const { combo, tick } = makeCombo();
    tick(500);
    combo.registerEvent('near-miss');
    expect(combo.getLastEventAt()).toBe(500);
  });

  it('reset clears all state', () => {
    const { combo } = makeCombo();
    for (let i = 0; i < 10; i++) combo.registerEvent('scare');
    combo.reset();
    expect(combo.getChainLength()).toBe(0);
    expect(combo.getMultiplier()).toBe(1);
    expect(combo.getLastEventAt()).toBe(0);
  });

  it('all three event kinds contribute to the same chain', () => {
    const { combo } = makeCombo();
    combo.registerEvent('scare');
    combo.registerEvent('pickup');
    combo.registerEvent('near-miss');
    expect(combo.getChainLength()).toBe(3);
    expect(combo.getMultiplier()).toBe(2);
  });
});
