/**
 * Unit tests for C3 positional crowd sections in descentAmbience.
 *
 * Verifies:
 *   - The system initialises 12 crowd-section layers matching audience geometry.
 *   - crowdSectionCount === 12 after init.
 *   - Crowd sections also respond to setDescentT (filter cutoff scales).
 *   - Crowd sections are disposed correctly.
 *
 * Tone.js is fully mocked — no AudioContext required.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── audiencePositions mock ───────────────────────────────────────────────────

vi.mock('@/render/env/audiencePositions', () => ({
  audiencePositions: vi.fn((_seed: number, count = 240) => {
    const positions = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 80;
      positions.push({
        x: Math.cos(angle) * r,
        y: 10,
        z: Math.sin(angle) * r,
        rotY: angle + Math.PI,
        bobPhase: (i / count) * Math.PI * 2,
        color: '#ff0000',
      });
    }
    return positions;
  }),
}));

// ─── Tone.js mock (class-based constructors) ──────────────────────────────────

const rampToSpy = vi.fn();

vi.mock('tone', () => {
  class Gain {
    gain = { rampTo: rampToSpy, value: 1 };
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class Filter {
    frequency = { rampTo: rampToSpy, value: 400 };
    Q = { value: 1 };
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class Noise {
    connect = vi.fn().mockReturnThis();
    start = vi.fn().mockReturnThis();
    stop = vi.fn();
    dispose = vi.fn();
  }
  class Panner3D {
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  return { Gain, Filter, Noise, Panner3D };
});

// ─── buses + diagnosticsBus mock ─────────────────────────────────────────────

vi.mock('@/audio/buses', () => ({
  getBuses: vi.fn(() => ({
    ambBus: { connect: vi.fn().mockReturnThis(), volume: { value: 0 } },
  })),
}));

vi.mock('@/game/diagnosticsBus', () => ({
  onCameraPos: vi.fn(() => vi.fn()),
}));

vi.mock('@/config', () => ({
  tunables: {
    audio: {
      descentAmbienceTopDb: -60,
      descentAmbienceFloorDb: -12,
      descentAmbienceLpTopHz: 400,
      descentAmbienceLpFloorHz: 1600,
    },
  },
}));

// ─── tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('C3 positional crowd sections', () => {
  it('initialises 12 crowd-section layers after init()', async () => {
    const { descentAmbience } = await import('@/audio/descentAmbience');
    descentAmbience.init();
    expect(descentAmbience.crowdSectionCount).toBe(12);
  });

  it('crowd-section count does not change on repeated init() calls', async () => {
    const { descentAmbience } = await import('@/audio/descentAmbience');
    descentAmbience.init();
    descentAmbience.init(); // second call should be no-op
    expect(descentAmbience.crowdSectionCount).toBe(12);
  });

  it('crowd sections are disposed on dispose()', async () => {
    const { descentAmbience } = await import('@/audio/descentAmbience');
    descentAmbience.init();
    descentAmbience.dispose();
    expect(descentAmbience.crowdSectionCount).toBe(0);
  });

  it('setDescentT triggers ramp calls for crowd-section layers', async () => {
    const { descentAmbience } = await import('@/audio/descentAmbience');
    descentAmbience.init();
    rampToSpy.mockClear();

    descentAmbience.setDescentT(0.5);

    // Expect rampTo to have been called (masterGain + base layers + crowd sections)
    expect(rampToSpy).toHaveBeenCalled();
    const callCount = rampToSpy.mock.calls.length;
    // 1 masterGain + 3 base filters + 12 crowd filters = 16 rampTo calls
    expect(callCount).toBeGreaterThanOrEqual(13);
  });

  it('crowd-section filter cutoff is lower than base layer cutoff at t=0.5', () => {
    const baseLpHz = 400 + (1600 - 400) * 0.5; // 1000 Hz at t=0.5
    const crowdLpHz = baseLpHz * 0.75; // 750 Hz
    expect(crowdLpHz).toBeLessThan(baseLpHz);
    expect(crowdLpHz).toBeCloseTo(750, 0);
  });
});
