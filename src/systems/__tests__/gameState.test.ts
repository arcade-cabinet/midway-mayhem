import { beforeEach, describe, expect, it } from 'vitest';
import { PLUNGE_DURATION_S, DROP_DURATION_MS, resetGameState, useGameStore } from '../gameState';
import { TRACK } from '../../utils/constants';

// Jump past the drop-in animation so distance-based tests can tick gameplay
function skipDropIn() {
  const s = useGameStore.getState();
  useGameStore.setState({ dropProgress: 1, dropStartedAt: s.dropStartedAt - DROP_DURATION_MS });
}

describe('gameState store', () => {
  beforeEach(() => resetGameState());

  it('starts in a clean idle state', () => {
    const s = useGameStore.getState();
    expect(s.running).toBe(false);
    expect(s.distance).toBe(0);
    expect(s.speedMps).toBe(0);
    expect(s.crashes).toBe(0);
    expect(s.sanity).toBe(100);
  });

  it('startRun flips running=true and seeds the run', () => {
    useGameStore.getState().startRun(12345);
    const s = useGameStore.getState();
    expect(s.running).toBe(true);
    expect(s.seed).toBe(12345);
    expect(s.startedAt).toBeGreaterThan(0);
  });

  it('tick advances distance when running', () => {
    useGameStore.getState().startRun(1);
    skipDropIn();
    const before = useGameStore.getState().distance;
    useGameStore.getState().tick(0.5, performance.now());
    const after = useGameStore.getState().distance;
    expect(after).toBeGreaterThan(before);
  });

  it('tick is no-op when paused', () => {
    useGameStore.getState().startRun(1);
    skipDropIn();
    useGameStore.getState().pause();
    const before = useGameStore.getState().distance;
    useGameStore.getState().tick(0.5, performance.now());
    expect(useGameStore.getState().distance).toBe(before);
  });

  it('drop-in freezes distance for first ~1.8s', () => {
    useGameStore.getState().startRun(1);
    const t0 = useGameStore.getState().dropStartedAt;
    useGameStore.getState().tick(0.5, t0 + 500);
    expect(useGameStore.getState().distance).toBe(0);
    expect(useGameStore.getState().dropProgress).toBeGreaterThan(0);
    expect(useGameStore.getState().dropProgress).toBeLessThan(1);

    useGameStore.getState().tick(0.5, t0 + DROP_DURATION_MS + 100);
    expect(useGameStore.getState().dropProgress).toBe(1);
    useGameStore.getState().tick(0.5, t0 + DROP_DURATION_MS + 600);
    expect(useGameStore.getState().distance).toBeGreaterThan(0);
  });

  it('applyCrash reduces sanity and increments crash counter', () => {
    useGameStore.getState().startRun(1);
    const before = useGameStore.getState().sanity;
    useGameStore.getState().applyCrash(false);
    const after = useGameStore.getState().sanity;
    expect(after).toBeLessThan(before);
    expect(useGameStore.getState().crashes).toBe(1);
  });

  it('heavy crash reduces sanity more than light', () => {
    useGameStore.getState().startRun(1);
    useGameStore.getState().applyCrash(false);
    const afterLight = useGameStore.getState().sanity;
    resetGameState();
    useGameStore.getState().startRun(1);
    useGameStore.getState().applyCrash(true);
    const afterHeavy = useGameStore.getState().sanity;
    expect(afterHeavy).toBeLessThan(afterLight);
  });

  it('gameOver becomes true when sanity hits zero', () => {
    useGameStore.getState().startRun(1);
    // Pound with heavy crashes
    for (let i = 0; i < 10; i++) useGameStore.getState().applyCrash(true);
    expect(useGameStore.getState().gameOver).toBe(true);
    expect(useGameStore.getState().running).toBe(false);
  });

  it('applyPickup rewards crowd reaction', () => {
    useGameStore.getState().startRun(1);
    useGameStore.getState().applyPickup('ticket');
    expect(useGameStore.getState().crowdReaction).toBeGreaterThan(0);
    const afterTicket = useGameStore.getState().crowdReaction;
    useGameStore.getState().applyPickup('mega');
    expect(useGameStore.getState().crowdReaction).toBeGreaterThan(afterTicket);
  });

  it('boost pickup sets boostUntil in the future', () => {
    useGameStore.getState().startRun(1);
    const now = performance.now();
    useGameStore.getState().applyPickup('boost');
    expect(useGameStore.getState().boostUntil).toBeGreaterThan(now);
  });

  it('setSteer clamps to [-1, 1]', () => {
    useGameStore.getState().setSteer(5);
    expect(useGameStore.getState().steer).toBe(1);
    useGameStore.getState().setSteer(-5);
    expect(useGameStore.getState().steer).toBe(-1);
    useGameStore.getState().setSteer(0.3);
    expect(useGameStore.getState().steer).toBe(0.3);
  });

  describe('plunge detection', () => {
    it('does not plunge on a non-ramp piece even when lateral exceeds clamp', () => {
      useGameStore.getState().startRun(1);
      skipDropIn();
      // Drive player off-side on a straight piece — should NOT plunge
      useGameStore.getState().setCurrentPieceKind('straight');
      useGameStore.getState().setLateral(TRACK.LATERAL_CLAMP + 1.5);
      useGameStore.getState().tick(0.016, performance.now());
      expect(useGameStore.getState().plunging).toBe(false);
    });

    it('triggers plunge when lateral exceeds clamp+0.5 on a rampLong piece', () => {
      useGameStore.getState().startRun(1);
      skipDropIn();
      useGameStore.getState().setCurrentPieceKind('rampLong');
      // Place player just past the plunge threshold
      const threshold = TRACK.LATERAL_CLAMP + 0.6;
      useGameStore.getState().setLateral(threshold);
      const now = performance.now();
      useGameStore.getState().tick(0.016, now);
      const s = useGameStore.getState();
      expect(s.plunging).toBe(true);
      expect(s.plungeStartedAt).toBeGreaterThan(0);
      expect(s.plungeDirection).toBe(1); // positive lateral → positive direction
    });

    it('triggers plunge on ramp piece', () => {
      useGameStore.getState().startRun(1);
      skipDropIn();
      useGameStore.getState().setCurrentPieceKind('ramp');
      useGameStore.getState().setLateral(-(TRACK.LATERAL_CLAMP + 0.6));
      useGameStore.getState().tick(0.016, performance.now());
      const s = useGameStore.getState();
      expect(s.plunging).toBe(true);
      expect(s.plungeDirection).toBe(-1); // negative lateral
    });

    it('triggers plunge on rampLongCurved piece', () => {
      useGameStore.getState().startRun(1);
      skipDropIn();
      useGameStore.getState().setCurrentPieceKind('rampLongCurved');
      useGameStore.getState().setLateral(TRACK.LATERAL_CLAMP + 0.6);
      useGameStore.getState().tick(0.016, performance.now());
      expect(useGameStore.getState().plunging).toBe(true);
    });

    it('does not plunge when lateral is within safe bounds on a ramp', () => {
      useGameStore.getState().startRun(1);
      skipDropIn();
      useGameStore.getState().setCurrentPieceKind('rampLong');
      // Stay just inside the threshold
      useGameStore.getState().setLateral(TRACK.LATERAL_CLAMP - 0.1);
      useGameStore.getState().tick(0.016, performance.now());
      expect(useGameStore.getState().plunging).toBe(false);
    });

    it('freezes gameplay while plunging', () => {
      useGameStore.getState().startRun(1);
      skipDropIn();
      useGameStore.getState().setCurrentPieceKind('rampLong');
      useGameStore.getState().setLateral(TRACK.LATERAL_CLAMP + 0.6);
      const now = performance.now();
      useGameStore.getState().tick(0.016, now);
      expect(useGameStore.getState().plunging).toBe(true);
      const distBefore = useGameStore.getState().distance;
      // Tick again — distance should NOT advance while plunging
      useGameStore.getState().tick(0.5, now + 500);
      expect(useGameStore.getState().distance).toBe(distBefore);
    });

    it('ends run with gameOver after plunge duration elapses', () => {
      useGameStore.getState().startRun(1);
      skipDropIn();
      useGameStore.getState().setCurrentPieceKind('rampLong');
      useGameStore.getState().setLateral(TRACK.LATERAL_CLAMP + 0.6);
      const now = performance.now();
      useGameStore.getState().tick(0.016, now);
      expect(useGameStore.getState().plunging).toBe(true);
      // Advance past the plunge duration
      const afterPlunge = now + PLUNGE_DURATION_S * 1000 + 100;
      useGameStore.getState().tick(0.016, afterPlunge);
      const s = useGameStore.getState();
      expect(s.plunging).toBe(false);
      expect(s.gameOver).toBe(true);
      expect(s.running).toBe(false);
    });
  });
});
