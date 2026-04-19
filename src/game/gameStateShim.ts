/**
 * @module game/gameStateShim
 *
 * Zustand-compatible `useGameStore` hook + its imperative `.getState`,
 * `.subscribe`, `.setState` companions. Separated from gameState.ts so
 * the state-boundary module (read/write ECS, mutators) is purely
 * functional and reviewable without scrolling past React plumbing.
 *
 * The shim exists so existing `useGameStore(s => s.xxx)` call sites
 * compile unchanged after the v2 port dropped zustand as a dep.
 * Implementation-wise it's a thin useSyncExternalStore wrapper that
 * polls the ECS world each animation frame.
 */
import { useWorld } from 'koota/react';
import { useCallback, useSyncExternalStore } from 'react';
import { BoostState, GameplayStats, Player, RunSession } from '@/ecs/traits';
import { world } from '@/ecs/world';
import type { PieceKind } from '@/track/trackComposer';
import {
  applyCrash,
  applyPickup,
  endRun,
  type GameStateSnapshot,
  incrementRaidsSurvived,
  incrementScares,
  pause,
  readState,
  resume,
  type StartRunOptions,
  setAirborne,
  setCurrentPieceKind,
  setLateral,
  setPhotoMode,
  setSteer,
  setThrottle,
  setTrickState,
  startRun,
  tick,
} from './gameState';

export type GameStateWithActions = GameStateSnapshot & {
  startRun: (options?: StartRunOptions) => void;
  endRun: () => void;
  tick: (dt: number, now: number) => void;
  pause: () => void;
  resume: () => void;
  applyCrash: (heavy?: boolean) => void;
  applyPickup: (kind: 'ticket' | 'boost' | 'mega') => void;
  setSteer: (v: number) => void;
  setLateral: (v: number) => void;
  setThrottle: (v: number) => void;
  setCurrentPieceKind: (kind: PieceKind | null) => void;
  setPhotoMode: (v: boolean) => void;
  setAirborne: (v: boolean) => void;
  setTrickState: (active: boolean, rotY: number, rotZ: number) => void;
  incrementScares: () => void;
  incrementRaidsSurvived: () => void;
};

// Cached snapshot for useSyncExternalStore. getSnapshot MUST return the
// same reference when state hasn't changed, or React sees a "new" value
// every render and loops infinitely (React error #185).
let _cachedSnapshot: GameStateSnapshot | null = null;

function snapshotsDiffer(a: GameStateSnapshot, b: GameStateSnapshot): boolean {
  return (
    a.running !== b.running ||
    a.paused !== b.paused ||
    a.gameOver !== b.gameOver ||
    a.distance !== b.distance ||
    a.speedMps !== b.speedMps ||
    a.hype !== b.hype ||
    a.sanity !== b.sanity ||
    a.crowdReaction !== b.crowdReaction ||
    a.crashes !== b.crashes ||
    a.currentZone !== b.currentZone ||
    a.cleanliness !== b.cleanliness ||
    a.lateral !== b.lateral ||
    a.steer !== b.steer ||
    a.throttle !== b.throttle
  );
}

function getCachedSnapshot(): GameStateSnapshot {
  const next = readState(world);
  if (_cachedSnapshot === null || snapshotsDiffer(_cachedSnapshot, next)) {
    _cachedSnapshot = next;
  }
  return _cachedSnapshot;
}

function subscribeToGameState(listener: () => void): () => void {
  let rafId = 0;
  let prev = getCachedSnapshot();
  function poll() {
    const next = getCachedSnapshot();
    if (next !== prev) {
      prev = next;
      listener();
    }
    rafId = requestAnimationFrame(poll);
  }
  rafId = requestAnimationFrame(poll);
  return () => cancelAnimationFrame(rafId);
}

export function useGameStore<T>(selector: (s: GameStateWithActions) => T): T {
  const w = useWorld();
  const snapshot = useSyncExternalStore(subscribeToGameState, getCachedSnapshot);
  const full: GameStateWithActions = {
    ...snapshot,
    startRun: useCallback((opts?: StartRunOptions) => startRun(opts, w), [w]),
    endRun: useCallback(() => endRun(w), [w]),
    tick: useCallback((dt: number, now: number) => tick(dt, now, w), [w]),
    pause: useCallback(() => pause(w), [w]),
    resume: useCallback(() => resume(w), [w]),
    applyCrash: useCallback((heavy?: boolean) => applyCrash(heavy, w), [w]),
    applyPickup: useCallback((kind: 'ticket' | 'boost' | 'mega') => applyPickup(kind, w), [w]),
    setSteer: useCallback((v: number) => setSteer(v, w), [w]),
    setLateral: useCallback((v: number) => setLateral(v, w), [w]),
    setThrottle: useCallback((v: number) => setThrottle(v, w), [w]),
    setCurrentPieceKind: useCallback((kind: PieceKind | null) => setCurrentPieceKind(kind, w), [w]),
    setPhotoMode: useCallback((v: boolean) => setPhotoMode(v, w), [w]),
    setAirborne: useCallback((v: boolean) => setAirborne(v, w), [w]),
    setTrickState: useCallback(
      (active: boolean, rotY: number, rotZ: number) => setTrickState(active, rotY, rotZ, w),
      [w],
    ),
    incrementScares: useCallback(() => incrementScares(w), [w]),
    incrementRaidsSurvived: useCallback(() => incrementRaidsSurvived(w), [w]),
  };
  return selector(full);
}

/** Imperative (non-React) snapshot of the full state + bound actions. */
useGameStore.getState = (): GameStateWithActions => {
  const w = world;
  return {
    ...readState(w),
    startRun: (opts?: StartRunOptions) => startRun(opts, w),
    endRun: () => endRun(w),
    tick: (dt: number, now: number) => tick(dt, now, w),
    pause: () => pause(w),
    resume: () => resume(w),
    applyCrash: (heavy?: boolean) => applyCrash(heavy, w),
    applyPickup: (kind: 'ticket' | 'boost' | 'mega') => applyPickup(kind, w),
    setSteer: (v: number) => setSteer(v, w),
    setLateral: (v: number) => setLateral(v, w),
    setThrottle: (v: number) => setThrottle(v, w),
    setCurrentPieceKind: (kind: PieceKind | null) => setCurrentPieceKind(kind, w),
    setPhotoMode: (v: boolean) => setPhotoMode(v, w),
    setAirborne: (v: boolean) => setAirborne(v, w),
    setTrickState: (active: boolean, rotY: number, rotZ: number) =>
      setTrickState(active, rotY, rotZ, w),
    incrementScares: () => incrementScares(w),
    incrementRaidsSurvived: () => incrementRaidsSurvived(w),
  };
};

/** zustand-compat subscribe — poll-based. Used by useGameSystems zone watcher. */
useGameStore.subscribe = (
  listener: (state: GameStateWithActions, prev: GameStateWithActions) => void,
): (() => void) => {
  let prev = useGameStore.getState();
  let rafId = 0;
  function poll() {
    const next = useGameStore.getState();
    if (
      next.running !== prev.running ||
      next.gameOver !== prev.gameOver ||
      next.currentZone !== prev.currentZone ||
      next.distance !== prev.distance
    ) {
      listener(next, prev);
      prev = next;
    }
    rafId = requestAnimationFrame(poll);
  }
  poll();
  return () => cancelAnimationFrame(rafId);
};

/** zustand-compat setState — merges partial updates onto ECS traits. */
useGameStore.setState = (
  partialOrUpdater:
    | Partial<GameStateSnapshot>
    | ((prev: GameStateSnapshot) => Partial<GameStateSnapshot>),
): void => {
  const w = world;
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  const partial =
    typeof partialOrUpdater === 'function' ? partialOrUpdater(readState(w)) : partialOrUpdater;

  if (
    partial.running !== undefined ||
    partial.paused !== undefined ||
    partial.gameOver !== undefined ||
    partial.startedAt !== undefined ||
    partial.seed !== undefined ||
    partial.difficulty !== undefined ||
    partial.seedPhrase !== undefined ||
    partial.permadeath !== undefined
  ) {
    const rs = pe.get(RunSession);
    if (rs) {
      pe.set(RunSession, {
        running: partial.running ?? rs.running,
        paused: partial.paused ?? rs.paused,
        gameOver: partial.gameOver ?? rs.gameOver,
        startedAt: partial.startedAt ?? rs.startedAt,
        seed: partial.seed ?? rs.seed,
        difficulty: partial.difficulty ?? rs.difficulty,
        // Encode null as '' (koota traits can't hold null strings)
        seedPhrase: partial.seedPhrase !== undefined ? (partial.seedPhrase ?? '') : rs.seedPhrase,
        permadeath: partial.permadeath ?? rs.permadeath,
      });
    }
  }

  const gsFields = [
    'distance',
    'lateral',
    'speedMps',
    'targetSpeedMps',
    'steer',
    'throttle',
    'hype',
    'sanity',
    'crowdReaction',
    'crashes',
    'currentZone',
    'cleanliness',
  ] as const;
  if (gsFields.some((f) => f in partial)) {
    const gs = pe.get(GameplayStats);
    if (gs) {
      pe.set(GameplayStats, {
        distance: partial.distance ?? gs.distance,
        lateral: partial.lateral ?? gs.lateral,
        speedMps: partial.speedMps ?? gs.speedMps,
        targetSpeedMps: partial.targetSpeedMps ?? gs.targetSpeedMps,
        steer: partial.steer ?? gs.steer,
        throttle: partial.throttle ?? gs.throttle,
        hype: partial.hype ?? gs.hype,
        sanity: partial.sanity ?? gs.sanity,
        crowdReaction: partial.crowdReaction ?? gs.crowdReaction,
        crashes: partial.crashes ?? gs.crashes,
        currentZone: partial.currentZone ?? gs.currentZone,
        cleanliness: partial.cleanliness ?? gs.cleanliness,
      });
    }
  }

  if (partial.boostUntil !== undefined || partial.megaBoostUntil !== undefined) {
    const bs = pe.get(BoostState);
    if (bs) {
      pe.set(BoostState, {
        boostUntil: partial.boostUntil ?? bs.boostUntil,
        megaBoostUntil: partial.megaBoostUntil ?? bs.megaBoostUntil,
      });
    }
  }
};
