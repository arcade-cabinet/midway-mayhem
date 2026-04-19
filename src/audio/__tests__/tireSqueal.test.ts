/**
 * tireSqueal unit tests — debounce state machine + threshold constants.
 * Tone.js nodes are mocked so this runs under the node vitest project.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted so mock factories can reference these spies without
// triggering the hoisting-order ReferenceError.
const { gainRampTo, filterRampTo, noiseStart, reportErrorMock } = vi.hoisted(() => ({
  gainRampTo: vi.fn(),
  filterRampTo: vi.fn(),
  noiseStart: vi.fn(),
  reportErrorMock: vi.fn(),
}));

vi.mock('tone', () => {
  class Gain {
    gain = { rampTo: gainRampTo };
    connect(_: unknown) {
      return this;
    }
  }
  class Filter {
    frequency = { rampTo: filterRampTo };
    connect(_: unknown) {
      return this;
    }
  }
  class Noise {
    connect(_: unknown) {
      return this;
    }
    start = noiseStart;
  }
  return { Gain, Filter, Noise };
});

vi.mock('@/audio/buses', () => ({
  getBuses: () => ({ sfxBus: {} }),
}));

vi.mock('@/game/errorBus', () => ({
  reportError: (...a: unknown[]) => reportErrorMock(...a),
}));

import { TireSquealSystem } from '@/audio/tireSqueal';

describe('TireSquealSystem — threshold constants', () => {
  it('exposes start/stop thresholds + debounce delays', () => {
    expect(TireSquealSystem.START_THRESHOLD).toBe(0.8);
    expect(TireSquealSystem.STOP_THRESHOLD).toBe(0.5);
    expect(TireSquealSystem.START_DELAY_S).toBe(0.25);
    expect(TireSquealSystem.STOP_DELAY_S).toBe(0.2);
  });
});

describe('TireSquealSystem — state machine', () => {
  let t = 0;
  let sys: TireSquealSystem;

  beforeEach(() => {
    gainRampTo.mockReset();
    filterRampTo.mockReset();
    noiseStart.mockReset();
    reportErrorMock.mockReset();
    t = 0;
    sys = new TireSquealSystem(() => t);
  });

  function step(dtMs: number, steer: number) {
    t += dtMs / 1000;
    sys.update(steer, dtMs / 1000);
  }

  it('initializes lazily on first update and starts the noise', () => {
    expect(noiseStart).not.toHaveBeenCalled();
    step(16, 0);
    expect(noiseStart).toHaveBeenCalledTimes(1);
  });

  it('does not squeal when steer stays below START_THRESHOLD', () => {
    for (let i = 0; i < 30; i++) step(16, 0.5);
    expect(sys.isActive).toBe(false);
  });

  it('starts squealing after 0.25s above threshold', () => {
    // 0.25s of sustained |steer|>0.8 — need t to tick past overThresholdSince + 0.25
    for (let i = 0; i < 20; i++) step(16, 0.9);
    expect(sys.isActive).toBe(true);
    expect(gainRampTo).toHaveBeenCalledWith(0.35, 0.04);
  });

  it('does NOT start squealing if the threshold is crossed only briefly', () => {
    for (let i = 0; i < 10; i++) step(16, 0.9); // 160ms > 0.8
    for (let i = 0; i < 5; i++) step(16, 0.3); // drop back before 250ms
    expect(sys.isActive).toBe(false);
  });

  it('stops squealing after 0.2s below STOP_THRESHOLD', () => {
    for (let i = 0; i < 20; i++) step(16, 0.9); // start squealing
    expect(sys.isActive).toBe(true);
    gainRampTo.mockClear();
    for (let i = 0; i < 15; i++) step(16, 0.2); // ~240ms below 0.5
    expect(sys.isActive).toBe(false);
    expect(gainRampTo).toHaveBeenCalledWith(0, 0.1);
  });

  it('keeps squealing while steer stays above STOP_THRESHOLD', () => {
    for (let i = 0; i < 20; i++) step(16, 0.9);
    expect(sys.isActive).toBe(true);
    // Simulate sustained steering between start and stop thresholds
    for (let i = 0; i < 50; i++) step(16, 0.7);
    expect(sys.isActive).toBe(true);
  });

  it('modulates filter frequency while squealing (600Hz + steer*1200Hz)', () => {
    for (let i = 0; i < 20; i++) step(16, 0.9);
    filterRampTo.mockClear();
    step(16, 0.7); // Still above STOP_THRESHOLD; expect rampTo(600+0.7*1200 = 1440)
    expect(filterRampTo).toHaveBeenCalledWith(1440, 0.05);
  });

  it('resets the over-threshold timer when steer drops and rises again', () => {
    for (let i = 0; i < 10; i++) step(16, 0.9); // 160ms above
    step(16, 0.3); // reset
    for (let i = 0; i < 10; i++) step(16, 0.9); // another 160ms above
    expect(sys.isActive).toBe(false);
  });

  it('works symmetrically for negative steer (|steer| semantics)', () => {
    for (let i = 0; i < 20; i++) step(16, -0.9);
    expect(sys.isActive).toBe(true);
  });

  it('subscribe() returns a no-op unsubscribe', () => {
    const unsub = sys.subscribe();
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });
});
