/**
 * @module game/gameStateCombat
 *
 * applyCrash and applyPickup extracted from gameState.ts to keep that file
 * under 300 LOC. Both are pure Zustand action helpers — they take `set`/`get`
 * and call hapticsBus so the store method stays a one-liner delegation.
 */
import type { StoreApi } from 'zustand';
import { hapticsBus } from './hapticsBus';

/** Minimal GameState slice needed by combat helpers. */
interface CombatState {
  permadeath: boolean;
  sanity: number;
  crashes: number;
  speedMps: number;
  cleanliness: number;
  crowdReaction: number;
  ticketsThisRun: number;
  boostUntil: number;
  megaBoostUntil: number;
  gameOver: boolean;
  running: boolean;
}

type SetFn = StoreApi<CombatState>['setState'];
type GetFn = () => CombatState;

export function applyCrashAction(heavy: boolean, set: SetFn, get: GetFn): void {
  const s = get();
  if (s.permadeath) {
    set({
      sanity: 0,
      crashes: s.crashes + 1,
      speedMps: s.speedMps * 0.55,
      gameOver: true,
      running: false,
    });
    hapticsBus.fire('game-over');
    return;
  }
  const sanity = Math.max(0, s.sanity - (heavy ? 25 : 10));
  set({
    sanity,
    crashes: s.crashes + 1,
    speedMps: s.speedMps * 0.55,
    gameOver: sanity <= 0,
    running: sanity > 0,
  });
  hapticsBus.fire(heavy ? 'crash-heavy' : 'crash-light');
  if (sanity <= 0) hapticsBus.fire('game-over');
}

export function applyPickupAction(kind: 'ticket' | 'boost' | 'mega', set: SetFn, get: GetFn): void {
  const s = get();
  const now = performance.now();
  const cleanBonus = 1 + s.cleanliness * 0.5;
  if (kind === 'ticket') {
    set({
      crowdReaction: s.crowdReaction + Math.round(50 * cleanBonus),
      ticketsThisRun: s.ticketsThisRun + 1,
    });
    hapticsBus.fire('pickup-ticket');
  } else if (kind === 'boost') {
    set({ boostUntil: now + 2200, crowdReaction: s.crowdReaction + Math.round(25 * cleanBonus) });
    hapticsBus.fire('boost');
  } else if (kind === 'mega') {
    set({
      megaBoostUntil: now + 3500,
      crowdReaction: s.crowdReaction + Math.round(200 * cleanBonus),
    });
    hapticsBus.fire('mega-boost');
  }
}
