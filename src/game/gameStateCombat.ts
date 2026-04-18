/**
 * @module game/gameStateCombat
 *
 * applyCrash and applyPickup — combat state transitions.
 * Reads/writes ECS traits on the player entity instead of zustand set/get.
 */
import type { World } from 'koota';
import { BoostState, GameplayStats, Player, RunCounters, RunSession } from '@/ecs/traits';
import { hapticsBus } from './hapticsBus';

export function applyCrashAction(heavy: boolean, w: World): void {
  const players = w.query(Player, RunSession, GameplayStats);
  const pe = players[0];
  if (!pe) {
    throw new Error('[gameStateCombat] applyCrashAction: no active player entity');
  }

  const rs = pe.get(RunSession)!;
  const gs = pe.get(GameplayStats)!;

  if (rs.permadeath) {
    pe.set(GameplayStats, {
      ...gs,
      sanity: 0,
      crashes: gs.crashes + 1,
      speedMps: gs.speedMps * 0.55,
    });
    pe.set(RunSession, { ...rs, gameOver: true, running: false });
    hapticsBus.fire('game-over');
    return;
  }

  const sanity = Math.max(0, gs.sanity - (heavy ? 25 : 10));
  pe.set(GameplayStats, {
    ...gs,
    sanity,
    crashes: gs.crashes + 1,
    speedMps: gs.speedMps * 0.55,
  });
  pe.set(RunSession, {
    ...rs,
    gameOver: sanity <= 0,
    running: sanity > 0,
  });
  hapticsBus.fire(heavy ? 'crash-heavy' : 'crash-light');
  if (sanity <= 0) hapticsBus.fire('game-over');
}

export function applyPickupAction(kind: 'ticket' | 'boost' | 'mega', w: World): void {
  const players = w.query(Player, GameplayStats, BoostState, RunCounters);
  const pe = players[0];
  if (!pe) {
    throw new Error('[gameStateCombat] applyPickupAction: no active player entity');
  }

  const gs = pe.get(GameplayStats)!;
  const bs = pe.get(BoostState)!;
  const rc = pe.get(RunCounters)!;
  const now = performance.now();
  const cleanBonus = 1 + gs.cleanliness * 0.5;

  if (kind === 'ticket') {
    pe.set(GameplayStats, {
      ...gs,
      crowdReaction: gs.crowdReaction + Math.round(50 * cleanBonus),
    });
    pe.set(RunCounters, { ...rc, ticketsThisRun: rc.ticketsThisRun + 1 });
    hapticsBus.fire('pickup-ticket');
  } else if (kind === 'boost') {
    pe.set(BoostState, { ...bs, boostUntil: now + 2200 });
    pe.set(GameplayStats, {
      ...gs,
      crowdReaction: gs.crowdReaction + Math.round(25 * cleanBonus),
    });
    hapticsBus.fire('boost');
  } else if (kind === 'mega') {
    pe.set(BoostState, { ...bs, megaBoostUntil: now + 3500 });
    pe.set(GameplayStats, {
      ...gs,
      crowdReaction: gs.crowdReaction + Math.round(200 * cleanBonus),
    });
    hapticsBus.fire('mega-boost');
  }
}
