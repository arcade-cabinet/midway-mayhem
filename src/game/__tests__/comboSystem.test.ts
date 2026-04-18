import { beforeEach, describe, expect, it } from 'vitest';
import { tunables } from '@/config';
import { ComboSystem } from '@/game/comboSystem';

describe('ComboSystem', () => {
  let now = 0;
  let combo: ComboSystem;

  beforeEach(() => {
    now = 0;
    combo = new ComboSystem(() => now);
  });

  it('starts at chain 0 with multiplier 1×', () => {
    expect(combo.getChainLength()).toBe(0);
    expect(combo.getMultiplier()).toBe(1);
  });

  it('increments chain on each registered event', () => {
    combo.registerEvent('scare');
    expect(combo.getChainLength()).toBe(1);
    combo.registerEvent('pickup');
    combo.registerEvent('near-miss');
    expect(combo.getChainLength()).toBe(3);
  });

  it('escalates multiplier per tunables.combo.chainThresholds', () => {
    for (let i = 0; i < 3; i++) combo.registerEvent('pickup');
    expect(combo.getMultiplier()).toBe(2);

    for (let i = 0; i < 4; i++) combo.registerEvent('pickup');
    expect(combo.getMultiplier()).toBe(4);

    for (let i = 0; i < 8; i++) combo.registerEvent('pickup');
    expect(combo.getMultiplier()).toBe(8);
  });

  it('resets chain to 0 on registerHit()', () => {
    for (let i = 0; i < 5; i++) combo.registerEvent('pickup');
    combo.registerHit();
    expect(combo.getChainLength()).toBe(0);
    expect(combo.getMultiplier()).toBe(1);
  });

  it('reports chain 0 once the expiry window elapses since the last event', () => {
    combo.registerEvent('pickup');
    combo.registerEvent('pickup');
    expect(combo.getChainLength()).toBe(2);
    now += tunables.combo.chainExpiryMs + 1;
    expect(combo.getChainLength()).toBe(0);
    expect(combo.getMultiplier()).toBe(1);
  });

  it('restarts chain from 1 after an expired window', () => {
    combo.registerEvent('pickup');
    now += tunables.combo.chainExpiryMs + 1;
    combo.registerEvent('pickup');
    expect(combo.getChainLength()).toBe(1);
  });

  it('reset() clears chain and last-event sentinel', () => {
    combo.registerEvent('pickup');
    combo.reset();
    expect(combo.getChainLength()).toBe(0);
    expect(combo.getLastEventAt()).toBe(0);
  });
});
