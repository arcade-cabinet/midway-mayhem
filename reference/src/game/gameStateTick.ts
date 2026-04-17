/**
 * @module game/gameStateTick
 *
 * Per-frame tick logic extracted from gameState.ts to stay under 300 LOC.
 *
 * tickGameState drives: drop-in progress, plunge timeout, speed/distance/hype,
 * zone derivation, sanity regen, combo tracking, cleanliness EMA,
 * plunge detection, and game-over-on-exhaustion.
 *
 * The caller (Zustand store) passes `set` + `get` so this module never
 * imports the store directly (no circular dependency).
 */
import type { StoreApi } from 'zustand';
import type { PieceKind } from '@/track/trackComposer';
import type { ZoneId } from '@/utils/constants';
import { TRACK } from '@/utils/constants';
import { combo } from './comboSystem';
import { CLEANLINESS_EMA, DEVIATION_MAX_M, updateDeviationWindow } from './deviationWindow';
import { hapticsBus } from './hapticsBus';
import type { OptimalPath } from './optimalPath';

/** Ramp piece kinds that have no side rails — plunge risk zone. */
export const RAMP_KINDS: ReadonlySet<PieceKind> = new Set(['ramp', 'rampLong', 'rampLongCurved']);

/** How far beyond the lateral clamp the player must drift to trigger a plunge. */
const PLUNGE_OVERSHOOT_M = 0.5;

/** Duration of the plunge animation in seconds. */
export const PLUNGE_DURATION_S = 1.5;

/** Minimal shape of GameState needed by tickGameState. */
export interface TickableState {
  running: boolean;
  paused: boolean;
  gameOver: boolean;
  dropProgress: number;
  dropStartedAt: number;
  plunging: boolean;
  plungeStartedAt: number;
  distance: number;
  lateral: number;
  speedMps: number;
  targetSpeedMps: number;
  boostUntil: number;
  megaBoostUntil: number;
  sanity: number;
  maxComboThisRun: number;
  optimalPath: OptimalPath | null;
  cleanliness: number;
  currentPieceKind: PieceKind | null;
  /** 0 = coast/decelerate; 1 = auto-accelerate (racing default). */
  throttle: number;
}

export const DROP_DURATION_MS = 1800;

type SetFn = StoreApi<TickableState>['setState'];
type GetFn = () => TickableState;

export function tickGameState(dt: number, now: number, set: SetFn, get: GetFn): void {
  const s = get();
  if (!s.running || s.paused || s.gameOver) return;

  // During drop-in, only advance dropProgress and freeze gameplay
  if (s.dropProgress < 1) {
    const p = Math.min(1, (now - s.dropStartedAt) / DROP_DURATION_MS);
    set({ dropProgress: p });
    return;
  }

  // If already plunging, check if the animation is done
  if (s.plunging) {
    const elapsed = (now - s.plungeStartedAt) / 1000;
    if (elapsed >= PLUNGE_DURATION_S) {
      set({ running: false, gameOver: true, plunging: false } as Partial<TickableState>);
    }
    return;
  }

  // Speed interpolation toward target; target climbs slowly over time.
  // throttle gates the whole acceleration model: 0 = coast to a stop (debug
  // mode), 1 = full auto-accelerate to cruise (racing default).
  const CRUISE = 70;
  const BOOST = 90;
  const MEGA = 120;
  let target = Math.min(CRUISE, 30 + s.distance * 0.005);
  if (now < s.boostUntil) target = BOOST;
  if (now < s.megaBoostUntil) target = MEGA;
  target *= s.throttle;
  const speed = s.speedMps + (target - s.speedMps) * Math.min(1, dt * 1.3);
  const distance = s.distance + speed * dt;
  const hype = (speed / MEGA) * 100;

  // Zone derivation (simple cycle every 450 units across 4 zones)
  const zIdx = Math.floor(distance / 450) % 4;
  const currentZone: ZoneId =
    (['midway-strip', 'balloon-alley', 'ring-of-fire', 'funhouse-frenzy'] as const)[zIdx] ??
    'midway-strip';

  // Sanity regen slowly
  const sanity = Math.min(100, s.sanity + dt * 2);

  const currentChain = combo.getChainLength();
  const maxComboThisRun = Math.max(s.maxComboThisRun, currentChain);

  // Racing-line cleanliness: update deviation window and smooth with EMA.
  let nextCleanliness = s.cleanliness;
  if (s.optimalPath !== null) {
    const msd = updateDeviationWindow(distance, s.lateral, s.optimalPath);
    const raw = Math.max(0, 1 - msd / (DEVIATION_MAX_M * DEVIATION_MAX_M));
    nextCleanliness = s.cleanliness + CLEANLINESS_EMA * (raw - s.cleanliness);
  }

  set({
    speedMps: speed,
    targetSpeedMps: target,
    distance,
    hype,
    sanity,
    currentZone,
    maxComboThisRun,
    cleanliness: nextCleanliness,
  } as Partial<TickableState>);

  // Plunge detection: player drove off side of a rail-free ramp
  const plungeThreshold = TRACK.LATERAL_CLAMP + PLUNGE_OVERSHOOT_M;
  if (
    !s.plunging &&
    Math.abs(s.lateral) > plungeThreshold &&
    s.currentPieceKind !== null &&
    RAMP_KINDS.has(s.currentPieceKind)
  ) {
    set({
      plunging: true,
      plungeStartedAt: now,
      plungeDirection: Math.sign(s.lateral),
    } as Partial<TickableState>);
    hapticsBus.fire('crash-heavy');
    return;
  }

  // Game over when sanity exhausted
  if (sanity <= 0) set({ running: false, gameOver: true } as Partial<TickableState>);
}
