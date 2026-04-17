import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RaidDirector } from '@/obstacles/raidDirector';
import { createRng } from '@/utils/rng';

const NOOP_CBS = {
  onTelegraph: vi.fn(),
  onHeavyCrash: vi.fn(),
  onLightCrash: vi.fn(),
  onCrowdBonus: vi.fn(),
};

function makeCbs() {
  return {
    onTelegraph: vi.fn(),
    onHeavyCrash: vi.fn(),
    onLightCrash: vi.fn(),
    onCrowdBonus: vi.fn(),
  };
}

describe('RaidDirector', () => {
  let rd: RaidDirector;
  const t0 = 100_000; // arbitrary "now" in ms

  beforeEach(() => {
    vi.clearAllMocks();
    rd = new RaidDirector(createRng(42));
  });

  it('starts with no active raid', () => {
    expect(rd.getState()).toBeNull();
  });

  it('does not fire before scheduled time', () => {
    const cbs = makeCbs();
    rd.update(t0, 0, 0, false, true, cbs);
    expect(rd.getState()).toBeNull();
    expect(cbs.onTelegraph).not.toHaveBeenCalled();
  });

  it('fires a raid when forceNextRaidAt reaches now', () => {
    const cbs = makeCbs();
    rd.forceNextRaidAt(t0);
    rd.update(t0, 0, 0, false, true, cbs);
    expect(rd.getState()).not.toBeNull();
    expect(cbs.onTelegraph).toHaveBeenCalledOnce();
  });

  it('starts in telegraph phase with 2s duration', () => {
    const cbs = makeCbs();
    rd.forceNextRaidAt(t0);
    rd.update(t0, 0, 0, false, true, cbs);
    const state = rd.getState()!;
    expect(state.phase).toBe('telegraph');
    expect(state.telegraphDuration).toBe(2000);
  });

  it('transitions to active after telegraph duration', () => {
    const cbs = makeCbs();
    rd.forceNextRaidAt(t0);
    rd.update(t0, 0, 0, false, true, cbs);
    // Advance past telegraph
    rd.update(t0 + 2001, 0, 0, false, true, cbs);
    const state = rd.getState()!;
    expect(state.phase).toBe('active');
  });

  it('clears raid state after full active+telegraph duration', () => {
    const cbs = makeCbs();
    rd.forceNextRaidAt(t0);
    rd.update(t0, 0, 0, false, true, cbs);
    const state = rd.getState()!;
    const totalMs = state.telegraphDuration + state.activeDuration;
    // Advance past total duration
    rd.update(t0 + totalMs + 100, 0, 0, false, true, cbs);
    expect(rd.getState()).toBeNull();
  });

  it('does not update when running=false', () => {
    const cbs = makeCbs();
    rd.forceNextRaidAt(t0);
    rd.update(t0, 0, 0, false, false, cbs);
    expect(rd.getState()).toBeNull();
  });

  it('KNIVES raid initializes 5 knives', () => {
    // Use a deterministic seed that produces a KNIVES raid
    // We'll iterate seeds until we get KNIVES
    let foundKnives = false;
    for (let seed = 1; seed < 200; seed++) {
      const d = new RaidDirector(createRng(seed));
      d.forceNextRaidAt(t0);
      d.update(t0, 0, 0, false, true, NOOP_CBS);
      const s = d.getState();
      if (s?.kind === 'KNIVES') {
        expect(s.knives).toHaveLength(5);
        foundKnives = true;
        break;
      }
    }
    expect(foundKnives).toBe(true);
  });

  it('CANNONBALL raid sets cannonballLane based on player lateral', () => {
    let foundCb = false;
    for (let seed = 1; seed < 200; seed++) {
      const d = new RaidDirector(createRng(seed));
      d.forceNextRaidAt(t0);
      // Player is in right lane (lateral > 1.65)
      d.update(t0, 0, 4.0, false, true, NOOP_CBS);
      const s = d.getState();
      if (s?.kind === 'CANNONBALL') {
        expect(s.cannonballLane).toBe(2); // right lane
        foundCb = true;
        break;
      }
    }
    expect(foundCb).toBe(true);
  });

  it('TIGER raid with airborne player gives crowd bonus, not crash', () => {
    let foundTiger = false;
    for (let seed = 1; seed < 200; seed++) {
      const d = new RaidDirector(createRng(seed));
      d.forceNextRaidAt(t0);
      d.update(t0, 0, 0, false, true, NOOP_CBS);
      const s = d.getState();
      if (s?.kind === 'TIGER') {
        const cbs = makeCbs();
        // Advance to active phase
        d.update(t0 + 2001, 0, 0, true /* airborne */, true, cbs);
        // Advance past active duration
        d.update(t0 + 2001 + s.activeDuration + 100, 0, 0, true, true, cbs);
        expect(cbs.onCrowdBonus).toHaveBeenCalled();
        expect(cbs.onHeavyCrash).not.toHaveBeenCalled();
        foundTiger = true;
        break;
      }
    }
    expect(foundTiger).toBe(true);
  });

  it('reset clears state and schedules next raid', () => {
    const cbs = makeCbs();
    rd.forceNextRaidAt(t0);
    rd.update(t0, 0, 0, false, true, cbs);
    expect(rd.getState()).not.toBeNull();
    rd.reset(t0);
    expect(rd.getState()).toBeNull();
  });
});
