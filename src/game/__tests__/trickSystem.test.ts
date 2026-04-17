import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLEAN_CROWD_REWARD,
  CLEAN_SANITY_REWARD,
  TrickSystem,
  isCleanLanding,
  recognizeTrick,
} from '@/game/trickSystem';

describe('recognizeTrick', () => {
  it('recognizes BARREL_ROLL from right-right', () => {
    const result = recognizeTrick(['right', 'right']);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('BARREL_ROLL');
    expect(result!.axis).toBe('z');
    expect(Math.abs(result!.totalAngle)).toBeCloseTo(Math.PI * 2, 4);
  });

  it('recognizes BARREL_ROLL from left-left (negative Z)', () => {
    const result = recognizeTrick(['left', 'left']);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('BARREL_ROLL');
    expect(result!.totalAngle).toBeLessThan(0);
  });

  it('recognizes WHEELIE from up-up', () => {
    const result = recognizeTrick(['up', 'up']);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('WHEELIE');
    expect(result!.axis).toBe('x');
  });

  it('recognizes HANDSTAND from down-down', () => {
    const result = recognizeTrick(['down', 'down']);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('HANDSTAND');
    expect(result!.axis).toBe('x');
    expect(result!.totalAngle).toBeCloseTo(Math.PI, 4);
  });

  it('recognizes SPIN_180 from left-right', () => {
    const result = recognizeTrick(['left', 'right']);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('SPIN_180');
    expect(result!.axis).toBe('y');
    expect(result!.totalAngle).toBeCloseTo(Math.PI, 4);
  });

  it('recognizes SPIN_180 from right-left (negative Y)', () => {
    const result = recognizeTrick(['right', 'left']);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('SPIN_180');
    expect(result!.totalAngle).toBeLessThan(0);
  });

  it('returns null for unrecognized sequence', () => {
    expect(recognizeTrick(['up', 'down'])).toBeNull();
    expect(recognizeTrick(['left'])).toBeNull();
    expect(recognizeTrick([])).toBeNull();
  });

  it('uses last 2 inputs from a longer buffer', () => {
    const result = recognizeTrick(['up', 'down', 'right', 'right']);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('BARREL_ROLL');
  });
});

describe('isCleanLanding', () => {
  it('is clean when all rotations are 0', () => {
    expect(isCleanLanding(0, 0, 0)).toBe(true);
  });

  it('is clean within 15° tolerance', () => {
    const tol = (14 * Math.PI) / 180;
    expect(isCleanLanding(tol, 0, 0)).toBe(true);
    expect(isCleanLanding(0, tol, 0)).toBe(true);
    expect(isCleanLanding(0, 0, tol)).toBe(true);
  });

  it('is NOT clean beyond 15° tolerance', () => {
    const bad = (20 * Math.PI) / 180;
    expect(isCleanLanding(bad, 0, 0)).toBe(false);
  });

  it('is clean when rotation completes a full 360° (nets to 0)', () => {
    expect(isCleanLanding(Math.PI * 2, 0, 0)).toBe(true);
  });
});

describe('TrickSystem', () => {
  let ts: TrickSystem;
  const t0 = 1000;

  beforeEach(() => {
    ts = new TrickSystem();
  });

  it('starts not airborne', () => {
    expect(ts.getState().airborne).toBe(false);
  });

  it('accepts input only when airborne', () => {
    ts.pushInput('right', t0);
    expect(ts.getState().inputBuffer).toHaveLength(0);

    ts.update(t0, true, { onCleanLanding: vi.fn(), onBotchedLanding: vi.fn() });
    ts.pushInput('right', t0);
    expect(ts.getState().inputBuffer).toHaveLength(1);
  });

  it('starts a trick on matching sequence', () => {
    ts.update(t0, true, { onCleanLanding: vi.fn(), onBotchedLanding: vi.fn() });
    ts.pushInput('right', t0);
    ts.pushInput('right', t0);
    expect(ts.getState().currentTrick).not.toBeNull();
    expect(ts.getState().currentTrick!.kind).toBe('BARREL_ROLL');
  });

  it('animates rotation toward totalAngle over duration', () => {
    ts.update(t0, true, { onCleanLanding: vi.fn(), onBotchedLanding: vi.fn() });
    ts.pushInput('right', t0);
    ts.pushInput('right', t0);
    const trick = ts.getState().currentTrick!;
    // Advance halfway through animation
    const mid = t0 + trick.duration * 500; // halfway in ms
    ts.update(mid, true, { onCleanLanding: vi.fn(), onBotchedLanding: vi.fn() });
    // Rotation should be partway to totalAngle (smooth step at 0.5 = 0.5)
    const rot = ts.getState().rotZ;
    expect(Math.abs(rot)).toBeGreaterThan(0);
    expect(Math.abs(rot)).toBeLessThan(Math.abs(trick.totalAngle));
  });

  it('calls onCleanLanding when landing within tolerance after full rotation', () => {
    const onClean = vi.fn();
    const onBotched = vi.fn();

    // Get airborne
    ts.update(t0, true, { onCleanLanding: onClean, onBotchedLanding: onBotched });
    ts.pushInput('right', t0);
    ts.pushInput('right', t0);
    const trick = ts.getState().currentTrick!;
    // Advance past the animation end
    const tEnd = t0 + trick.duration * 1000 + 100;
    ts.update(tEnd, true, { onCleanLanding: onClean, onBotchedLanding: onBotched });
    expect(ts.getState().currentTrick).toBeNull();
    // After trick completes with full rotation (nets to 2π ≈ 0)
    // rotZ should be at totalAngle = 2π
    expect(ts.getState().rotZ).toBeCloseTo(Math.PI * 2, 1);

    // Land
    ts.update(tEnd + 100, false, { onCleanLanding: onClean, onBotchedLanding: onBotched });
    expect(onClean).toHaveBeenCalled();
    expect(onBotched).not.toHaveBeenCalled();
  });

  it('calls onBotchedLanding when landing with partial rotation', () => {
    const onClean = vi.fn();
    const onBotched = vi.fn();

    ts.update(t0, true, { onCleanLanding: onClean, onBotchedLanding: onBotched });
    ts.pushInput('right', t0);
    ts.pushInput('right', t0);
    // Land mid-animation (rotation is partial — not clean)
    const tMid = t0 + 200; // only 200ms in, trick takes 800ms
    ts.update(tMid, true, { onCleanLanding: onClean, onBotchedLanding: onBotched });
    ts.update(tMid + 16, false, { onCleanLanding: onClean, onBotchedLanding: onBotched });
    expect(onBotched).toHaveBeenCalled();
    expect(onClean).not.toHaveBeenCalled();
  });

  it('caps input buffer at 4 entries', () => {
    ts.update(t0, true, { onCleanLanding: vi.fn(), onBotchedLanding: vi.fn() });
    for (let i = 0; i < 10; i++) ts.pushInput('up', t0 + i);
    expect(ts.getState().inputBuffer.length).toBeLessThanOrEqual(4);
  });

  it('resets cleanly', () => {
    ts.update(t0, true, { onCleanLanding: vi.fn(), onBotchedLanding: vi.fn() });
    ts.pushInput('right', t0);
    ts.pushInput('right', t0);
    ts.reset();
    expect(ts.getState().airborne).toBe(false);
    expect(ts.getState().inputBuffer).toHaveLength(0);
    expect(ts.getState().currentTrick).toBeNull();
  });

  it('CLEAN_CROWD_REWARD and CLEAN_SANITY_REWARD are positive', () => {
    expect(CLEAN_CROWD_REWARD).toBeGreaterThan(0);
    expect(CLEAN_SANITY_REWARD).toBeGreaterThan(0);
  });
});
