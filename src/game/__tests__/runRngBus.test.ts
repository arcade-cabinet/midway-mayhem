/**
 * runRngBus unit tests — process-global dual-channel PRNG lifecycle.
 * Covers init/reset, hard-fail-before-init, determinism, channel
 * independence, and master seed accessor.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  _resetRunRng,
  eventsRng,
  getMasterSeed,
  getRunRng,
  initRunRng,
  trackRng,
} from '@/game/runRngBus';

describe('runRngBus', () => {
  beforeEach(() => {
    _resetRunRng();
  });

  it('getRunRng throws before initRunRng', () => {
    expect(() => getRunRng()).toThrow(/before initRunRng/);
  });

  it('trackRng and eventsRng both throw before init', () => {
    expect(() => trackRng()).toThrow(/before initRunRng/);
    expect(() => eventsRng()).toThrow(/before initRunRng/);
  });

  it('getMasterSeed is 0 before init', () => {
    expect(getMasterSeed()).toBe(0);
  });

  it('initRunRng stores the master seed (coerced to uint32)', () => {
    initRunRng(42);
    expect(getMasterSeed()).toBe(42);
  });

  it('coerces negative master seeds through uint32 cast', () => {
    initRunRng(-1);
    // -1 >>> 0 === 0xffffffff === 4294967295
    expect(getMasterSeed()).toBe(0xffffffff);
  });

  it('returns the same RunRng instance on repeated getRunRng calls', () => {
    initRunRng(7);
    const a = getRunRng();
    const b = getRunRng();
    expect(a).toBe(b);
  });

  it('is deterministic: same master seed → same sequence on both channels', () => {
    initRunRng(12345);
    const t1 = [trackRng().next(), trackRng().next(), trackRng().next()];
    const e1 = [eventsRng().next(), eventsRng().next(), eventsRng().next()];

    _resetRunRng();
    initRunRng(12345);
    const t2 = [trackRng().next(), trackRng().next(), trackRng().next()];
    const e2 = [eventsRng().next(), eventsRng().next(), eventsRng().next()];

    expect(t1).toEqual(t2);
    expect(e1).toEqual(e2);
  });

  it('track and events channels are independent — burning one does not shift the other', () => {
    initRunRng(999);
    const eventsBefore = eventsRng().next();

    _resetRunRng();
    initRunRng(999);
    // Burn the track channel heavily this time.
    for (let i = 0; i < 100; i++) trackRng().next();
    const eventsAfter = eventsRng().next();

    expect(eventsAfter).toBeCloseTo(eventsBefore, 10);
  });

  it('different master seeds produce different sequences', () => {
    initRunRng(1);
    const a = trackRng().next();
    _resetRunRng();
    initRunRng(2);
    const b = trackRng().next();
    expect(a).not.toBe(b);
  });

  it('_resetRunRng clears both state slots', () => {
    initRunRng(42);
    expect(getMasterSeed()).toBe(42);
    _resetRunRng();
    expect(getMasterSeed()).toBe(0);
    expect(() => getRunRng()).toThrow(/before initRunRng/);
  });

  it('reinitialising with a new seed replaces the previous channels', () => {
    initRunRng(100);
    const firstInstance = getRunRng();
    initRunRng(200);
    const secondInstance = getRunRng();
    expect(secondInstance).not.toBe(firstInstance);
    expect(getMasterSeed()).toBe(200);
  });
});
