/**
 * trickSystem unit tests — input-sequence recognition, rotation animation,
 * landing deviation/clean detection, airborne-gated input buffering.
 * Pure logic; no audio/render/ECS dependencies.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLEAN_CROWD_REWARD,
  CLEAN_SANITY_REWARD,
  isCleanLanding,
  landingDeviation,
  recognizeTrick,
  type TrickInput,
  TrickSystem,
} from '@/game/trickSystem';

describe('recognizeTrick', () => {
  it('returns null on fewer than 2 inputs', () => {
    expect(recognizeTrick([])).toBeNull();
    expect(recognizeTrick(['right'])).toBeNull();
  });

  it('recognises BARREL_ROLL (right-right → +2π)', () => {
    const r = recognizeTrick(['right', 'right']);
    expect(r?.kind).toBe('BARREL_ROLL');
    expect(r?.axis).toBe('z');
    expect(r?.totalAngle).toBeCloseTo(Math.PI * 2, 6);
  });

  it('recognises BARREL_ROLL (left-left → -2π)', () => {
    const r = recognizeTrick(['left', 'left']);
    expect(r?.kind).toBe('BARREL_ROLL');
    expect(r?.totalAngle).toBeCloseTo(-Math.PI * 2, 6);
  });

  it('recognises WHEELIE (up-up → negative X)', () => {
    const r = recognizeTrick(['up', 'up']);
    expect(r?.kind).toBe('WHEELIE');
    expect(r?.axis).toBe('x');
    expect(r?.totalAngle).toBeLessThan(0);
  });

  it('recognises HANDSTAND (down-down → +π X)', () => {
    const r = recognizeTrick(['down', 'down']);
    expect(r?.kind).toBe('HANDSTAND');
    expect(r?.axis).toBe('x');
    expect(r?.totalAngle).toBeCloseTo(Math.PI, 6);
  });

  it('recognises SPIN_180 (left-right → +π Y, right-left → -π Y)', () => {
    const a = recognizeTrick(['left', 'right']);
    const b = recognizeTrick(['right', 'left']);
    expect(a?.kind).toBe('SPIN_180');
    expect(a?.axis).toBe('y');
    expect(a?.totalAngle).toBeCloseTo(Math.PI, 6);
    expect(b?.totalAngle).toBeCloseTo(-Math.PI, 6);
  });

  it('uses only the last 2 inputs from longer buffers', () => {
    const r = recognizeTrick(['up', 'down', 'right', 'right']);
    expect(r?.kind).toBe('BARREL_ROLL');
  });

  it('returns null for unknown sequences', () => {
    expect(recognizeTrick(['up', 'left'])).toBeNull();
    expect(recognizeTrick(['down', 'right'])).toBeNull();
  });
});

describe('landingDeviation', () => {
  it('returns 0 rotation as no deviation', () => {
    expect(landingDeviation(0, 0, 0, 'z')).toBe(0);
  });

  it('reads only the requested axis', () => {
    expect(landingDeviation(Math.PI / 4, 0, 0, 'z')).toBeCloseTo(Math.PI / 4, 6);
    expect(landingDeviation(0, Math.PI / 4, 0, 'x')).toBeCloseTo(Math.PI / 4, 6);
    expect(landingDeviation(0, 0, Math.PI / 4, 'y')).toBeCloseTo(Math.PI / 4, 6);
  });

  it('normalises full rotations (2π) to 0 deviation', () => {
    expect(landingDeviation(Math.PI * 2, 0, 0, 'z')).toBeCloseTo(0, 6);
    expect(landingDeviation(-Math.PI * 2, 0, 0, 'z')).toBeCloseTo(0, 6);
  });

  it('returns the absolute deviation (always ≥ 0)', () => {
    const d = landingDeviation(-Math.PI / 4, 0, 0, 'z');
    expect(d).toBeGreaterThan(0);
    expect(d).toBeCloseTo(Math.PI / 4, 6);
  });

  it('reduces values > π into the [0, π] half-turn form', () => {
    // 1.1π after %(2π) wraps to 1.1π > π → should subtract 2π → -0.9π → abs = 0.9π
    const d = landingDeviation(Math.PI * 1.1, 0, 0, 'z');
    expect(d).toBeCloseTo(Math.PI * 0.9, 6);
  });
});

describe('isCleanLanding', () => {
  it('is clean at exact neutral', () => {
    expect(isCleanLanding(0, 0, 0)).toBe(true);
  });

  it('is clean after a completed barrel roll (2π)', () => {
    expect(isCleanLanding(Math.PI * 2, 0, 0)).toBe(true);
  });

  it('is NOT clean when any axis is off by π/2', () => {
    expect(isCleanLanding(Math.PI / 2, 0, 0)).toBe(false);
    expect(isCleanLanding(0, Math.PI / 2, 0)).toBe(false);
    expect(isCleanLanding(0, 0, Math.PI / 2)).toBe(false);
  });

  it('is clean inside the 15° tolerance window', () => {
    const tenDeg = (10 * Math.PI) / 180;
    expect(isCleanLanding(tenDeg, 0, 0)).toBe(true);
  });

  it('is NOT clean just past the tolerance window', () => {
    const twentyDeg = (20 * Math.PI) / 180;
    expect(isCleanLanding(twentyDeg, 0, 0)).toBe(false);
  });
});

describe('tunable-driven rewards', () => {
  it('exports positive sanity + crowd reward constants', () => {
    expect(CLEAN_SANITY_REWARD).toBeGreaterThan(0);
    expect(CLEAN_CROWD_REWARD).toBeGreaterThan(0);
  });
});

describe('TrickSystem', () => {
  let sys: TrickSystem;
  let onClean: ReturnType<typeof vi.fn<() => void>>;
  let onBotched: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    sys = new TrickSystem();
    onClean = vi.fn<() => void>();
    onBotched = vi.fn<() => void>();
  });

  function step(nowMs: number, airborne: boolean) {
    sys.update(nowMs, airborne, {
      onCleanLanding: onClean,
      onBotchedLanding: onBotched,
    });
  }

  it('initial state is grounded, empty buffer, no trick', () => {
    const s = sys.getState();
    expect(s.airborne).toBe(false);
    expect(s.inputBuffer).toEqual([]);
    expect(s.currentTrick).toBeNull();
    expect(s.rotZ).toBe(0);
  });

  it('pushInput is ignored while grounded', () => {
    sys.pushInput('right', 0);
    sys.pushInput('right', 1);
    expect(sys.getState().inputBuffer).toEqual([]);
    expect(sys.getState().currentTrick).toBeNull();
  });

  it('pushInput buffers and triggers a trick while airborne', () => {
    step(0, true);
    sys.pushInput('right', 0);
    sys.pushInput('right', 10);
    const s = sys.getState();
    expect(s.currentTrick?.kind).toBe('BARREL_ROLL');
    expect(s.trickStartedAt).toBe(10);
  });

  it('caps the input buffer at 4 entries (oldest evicted)', () => {
    step(0, true);
    for (const i of ['up', 'down', 'left', 'right', 'up'] as TrickInput[]) {
      sys.pushInput(i, 0);
    }
    const buf = sys.getState().inputBuffer;
    expect(buf).toHaveLength(4);
    expect(buf[0]).toBe('down');
  });

  it('does not start a new trick while one is running', () => {
    step(0, true);
    sys.pushInput('right', 0);
    sys.pushInput('right', 0);
    const firstTrickStart = sys.getState().trickStartedAt;
    // Attempt to trigger another mid-animation
    sys.pushInput('up', 50);
    sys.pushInput('up', 50);
    expect(sys.getState().currentTrick?.kind).toBe('BARREL_ROLL');
    expect(sys.getState().trickStartedAt).toBe(firstTrickStart);
  });

  it('animates rotation toward trick.totalAngle across duration and snaps at end', () => {
    step(0, true);
    sys.pushInput('right', 0);
    sys.pushInput('right', 0);
    // Duration for barrel roll is 0.8s → 800ms
    step(400, true); // 50% progress (smoothstep=0.5)
    const mid = sys.getState().rotZ;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(Math.PI * 2);

    step(800, true); // complete
    // After completion: currentTrick cleared, rot snapped
    const s = sys.getState();
    expect(s.currentTrick).toBeNull();
    expect(s.rotZ).toBeCloseTo(Math.PI * 2, 6);
  });

  it('clean landing after completed barrel roll fires onCleanLanding', () => {
    step(0, true);
    sys.pushInput('right', 0);
    sys.pushInput('right', 0);
    step(800, true); // trick completes, rotZ ≈ 2π
    step(810, false); // land
    expect(onClean).toHaveBeenCalledTimes(1);
    expect(onBotched).not.toHaveBeenCalled();
    const s = sys.getState();
    expect(s.rotZ).toBe(0);
    expect(s.rotX).toBe(0);
    expect(s.rotY).toBe(0);
    expect(s.currentTrick).toBeNull();
  });

  it('incomplete trick landing is treated as botched', () => {
    step(0, true);
    sys.pushInput('right', 0);
    sys.pushInput('right', 0);
    step(200, true); // 25% progress
    step(210, false); // land mid-trick
    expect(onBotched).toHaveBeenCalledTimes(1);
    expect(onClean).not.toHaveBeenCalled();
  });

  it('landing while grounded-and-neutral does not fire callbacks', () => {
    step(0, false);
    step(100, false);
    expect(onClean).not.toHaveBeenCalled();
    expect(onBotched).not.toHaveBeenCalled();
  });

  it('reset returns system to initial state', () => {
    step(0, true);
    sys.pushInput('right', 0);
    sys.pushInput('right', 0);
    sys.reset();
    const s = sys.getState();
    expect(s.airborne).toBe(false);
    expect(s.currentTrick).toBeNull();
    expect(s.inputBuffer).toEqual([]);
    expect(s.rotZ).toBe(0);
  });

  it('getState returns a defensive copy (caller mutation does not leak)', () => {
    step(0, true);
    sys.pushInput('right', 0);
    const s = sys.getState();
    s.inputBuffer.push('up');
    expect(sys.getState().inputBuffer).not.toContain('up');
  });
});
