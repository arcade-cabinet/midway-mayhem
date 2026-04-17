import { describe, expect, it, vi } from 'vitest';
import { TireSquealSystem } from '@/audio/tireSqueal';

// Mock audio/buses module so Tone.js is never touched in node tests
vi.mock('@/audio/buses', () => ({
  getBuses: () => ({
    sfxBus: { connect: vi.fn(), chain: vi.fn() },
  }),
}));

// Mock Tone.js so no audio context is created
vi.mock('tone', () => {
  class GainMock {
    gain = { rampTo: vi.fn(), value: 0 };
    connect = vi.fn().mockReturnThis();
  }
  class FilterMock {
    frequency = { rampTo: vi.fn(), value: 800 };
    connect = vi.fn().mockReturnThis();
  }
  class NoiseMock {
    connect = vi.fn().mockReturnThis();
    start = vi.fn();
  }
  return {
    Gain: GainMock,
    Filter: FilterMock,
    Noise: NoiseMock,
  };
});

/**
 * Creates a TireSquealSystem with a controllable fake clock (in seconds).
 * Returns the system and a `tick(s)` function.
 */
function makeSqueal() {
  let nowS = 0;
  const clock = () => nowS;
  const squeal = new TireSquealSystem(clock);
  squeal.init();
  const tick = (s: number) => { nowS += s; };
  return { squeal, tick };
}

describe('TireSquealSystem', () => {
  it('starts inactive', () => {
    const { squeal } = makeSqueal();
    expect(squeal.isActive).toBe(false);
  });

  it('does NOT activate for steer below start threshold', () => {
    const { squeal, tick } = makeSqueal();
    // steer = 0.5 (below 0.8)
    for (let i = 0; i < 20; i++) {
      tick(0.02);
      squeal.update(0.5, 0.02);
    }
    expect(squeal.isActive).toBe(false);
  });

  it('activates after steer > 0.8 is sustained for > 0.25s', () => {
    const { squeal, tick } = makeSqueal();
    // First call — starts the clock at t=0
    squeal.update(0.9, 0.016);
    expect(squeal.isActive).toBe(false);

    // Advance 0.3 s — past the 0.25 s threshold
    tick(0.3);
    squeal.update(0.9, 0.016);
    expect(squeal.isActive).toBe(true);
  });

  it('resets the start-delay clock if steer drops below threshold before delay elapses', () => {
    const { squeal, tick } = makeSqueal();
    squeal.update(0.9, 0.016);
    tick(0.1); // only 100ms < 250ms
    squeal.update(0.3, 0.016); // drops below threshold — clock resets
    tick(0.2);
    squeal.update(0.9, 0.016); // above again — but not yet past delay
    expect(squeal.isActive).toBe(false);
  });

  it('deactivates when steer < 0.5 for > 0.2s', () => {
    const { squeal, tick } = makeSqueal();
    // Activate first
    squeal.update(0.9, 0.016);
    tick(0.3);
    squeal.update(0.9, 0.016);
    expect(squeal.isActive).toBe(true);

    // Drop below stop threshold and wait
    squeal.update(0.3, 0.016);
    tick(0.25); // > 200ms
    squeal.update(0.3, 0.016);
    expect(squeal.isActive).toBe(false);
  });

  it('stays active if steer stays above stop threshold', () => {
    const { squeal, tick } = makeSqueal();
    // Activate
    squeal.update(0.9, 0.016);
    tick(0.3);
    squeal.update(0.9, 0.016);
    expect(squeal.isActive).toBe(true);

    // Steer drops to 0.6 — above 0.5 stop threshold
    tick(0.3);
    squeal.update(0.6, 0.016);
    expect(squeal.isActive).toBe(true);
  });

  it('exposes correct threshold constants', () => {
    expect(TireSquealSystem.START_THRESHOLD).toBe(0.8);
    expect(TireSquealSystem.START_DELAY_S).toBe(0.25);
    expect(TireSquealSystem.STOP_THRESHOLD).toBe(0.5);
    expect(TireSquealSystem.STOP_DELAY_S).toBe(0.2);
  });
});
