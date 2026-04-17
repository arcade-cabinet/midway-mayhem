import { beforeEach, describe, expect, it } from 'vitest';
import { resetGameState, useGameStore } from '../gameState';

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
    const before = useGameStore.getState().distance;
    useGameStore.getState().tick(0.5, performance.now());
    const after = useGameStore.getState().distance;
    expect(after).toBeGreaterThan(before);
  });

  it('tick is no-op when paused', () => {
    useGameStore.getState().startRun(1);
    useGameStore.getState().pause();
    const before = useGameStore.getState().distance;
    useGameStore.getState().tick(0.5, performance.now());
    expect(useGameStore.getState().distance).toBe(before);
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
});
