/**
 * gameStateCombat unit tests — applyCrash + applyPickup transitions on
 * an isolated koota world.
 *
 * Spins up a minimal world with just the traits these functions touch
 * (Player, RunSession, GameplayStats, BoostState, RunCounters), runs
 * the action, and reads the traits back. No App mount required.
 */
import { createWorld } from 'koota';
import { describe, expect, it } from 'vitest';
import { BoostState, GameplayStats, Player, RunCounters, RunSession } from '@/ecs/traits';
import { applyCrashAction, applyPickupAction } from '@/game/gameStateCombat';

function makeWorld(opts: { permadeath?: boolean; sanity?: number; cleanliness?: number } = {}) {
  const w = createWorld();
  const e = w.spawn(Player);
  e.add(
    RunSession({
      running: true,
      paused: false,
      gameOver: false,
      startedAt: 0,
      seed: 0,
      difficulty: 'kazoo',
      seedPhrase: '',
      permadeath: opts.permadeath ?? false,
    }),
  );
  e.add(
    GameplayStats({
      distance: 0,
      lateral: 0,
      speedMps: 30,
      targetSpeedMps: 30,
      steer: 0,
      throttle: 1,
      hype: 0,
      sanity: opts.sanity ?? 100,
      crowdReaction: 0,
      crashes: 0,
      currentZone: 'midway-strip',
      cleanliness: opts.cleanliness ?? 1,
    }),
  );
  e.add(BoostState({ boostUntil: 0, megaBoostUntil: 0 }));
  e.add(
    RunCounters({
      scaresThisRun: 0,
      maxComboThisRun: 0,
      raidsSurvived: 0,
      ticketsThisRun: 0,
    }),
  );
  return { world: w, entity: e };
}

describe('applyCrashAction', () => {
  it('heavy crash drops sanity by 25 and increments crashes', () => {
    const { world, entity } = makeWorld({ sanity: 100 });
    applyCrashAction(true, world);
    const gs = entity.get(GameplayStats)!;
    expect(gs.sanity).toBe(75);
    expect(gs.crashes).toBe(1);
  });

  it('light crash drops sanity by 10', () => {
    const { world, entity } = makeWorld({ sanity: 100 });
    applyCrashAction(false, world);
    const gs = entity.get(GameplayStats)!;
    expect(gs.sanity).toBe(90);
  });

  it('crash bleeds speed by 45%', () => {
    const { world, entity } = makeWorld();
    const before = entity.get(GameplayStats)!.speedMps;
    applyCrashAction(false, world);
    const after = entity.get(GameplayStats)!.speedMps;
    expect(after).toBeCloseTo(before * 0.55, 5);
  });

  it('sanity clamps at 0 and flips the run to gameOver', () => {
    const { world, entity } = makeWorld({ sanity: 5 });
    applyCrashAction(true, world);
    const gs = entity.get(GameplayStats)!;
    const rs = entity.get(RunSession)!;
    expect(gs.sanity).toBe(0);
    expect(rs.gameOver).toBe(true);
    expect(rs.running).toBe(false);
  });

  it('permadeath run ends instantly on first crash regardless of sanity', () => {
    const { world, entity } = makeWorld({ permadeath: true, sanity: 100 });
    applyCrashAction(false, world);
    const gs = entity.get(GameplayStats)!;
    const rs = entity.get(RunSession)!;
    expect(gs.sanity).toBe(0);
    expect(rs.gameOver).toBe(true);
    expect(rs.running).toBe(false);
  });

  it('throws when no player entity exists', () => {
    const w = createWorld();
    expect(() => applyCrashAction(false, w)).toThrow(/no active player/);
  });
});

describe('applyPickupAction', () => {
  it('ticket pickup bumps crowdReaction + ticketsThisRun', () => {
    const { world, entity } = makeWorld();
    applyPickupAction('ticket', world);
    const gs = entity.get(GameplayStats)!;
    const rc = entity.get(RunCounters)!;
    // With cleanliness=1 the cleanBonus is 1.5, so 50 × 1.5 = 75.
    expect(gs.crowdReaction).toBe(75);
    expect(rc.ticketsThisRun).toBe(1);
  });

  it('boost pickup sets boostUntil in the future', () => {
    const { world, entity } = makeWorld();
    const now = performance.now();
    applyPickupAction('boost', world);
    const bs = entity.get(BoostState)!;
    expect(bs.boostUntil).toBeGreaterThan(now);
  });

  it('mega pickup sets megaBoostUntil and bumps crowdReaction by ~300', () => {
    const { world, entity } = makeWorld();
    applyPickupAction('mega', world);
    const bs = entity.get(BoostState)!;
    const gs = entity.get(GameplayStats)!;
    expect(bs.megaBoostUntil).toBeGreaterThan(performance.now());
    // 200 × 1.5 cleanBonus = 300.
    expect(gs.crowdReaction).toBe(300);
  });

  it('cleanliness modulates the crowdReaction payout', () => {
    const dirty = makeWorld({ cleanliness: 0 });
    applyPickupAction('ticket', dirty.world);
    expect(dirty.entity.get(GameplayStats)!.crowdReaction).toBe(50); // 50 × 1.0
  });
});
