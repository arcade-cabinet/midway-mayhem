/**
 * @module game/gameState
 *
 * Game state: the single source of truth for the active run, implemented with
 * koota ECS traits on the singleton player entity instead of a zustand store.
 *
 * PUBLIC API:
 *   - Functional setters: startRun, endRun, applyCrash, applyPickup, tick, etc.
 *   - `useGameStore` shim: a tiny hook that re-creates the zustand selector API
 *     so all existing `useGameStore(s => s.xxx)` call sites compile unchanged.
 *
 * NO zustand in this file. The world is the state boundary.
 */
import type { World } from 'koota';
import { useWorld } from 'koota/react';
import { useCallback, useSyncExternalStore } from 'react';
import {
  BoostState,
  DropIntro,
  GameplayStats,
  PhotoMode,
  Player,
  PlungeState,
  RunCounters,
  RunSession,
  TrickState,
} from '@/ecs/traits';
import { world } from '@/ecs/world';
import type { PieceKind } from '@/track/trackComposer';
import type { ZoneId } from '@/utils/constants';
import { combo } from './comboSystem';
import { resetDeviationWindow } from './deviationWindow';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_PROFILES,
  type Difficulty,
  effectivePermadeath,
} from './difficulty';
import { applyCrashAction, applyPickupAction } from './gameStateCombat';
import { DROP_DURATION_MS, tickGameState } from './gameStateTick';
import { type OptimalPath, solveOptimalPath } from './optimalPath';
import { persistRunEnd } from './runEndPersistence';
import { buildRunPlan, type RunPlan } from './runPlan';
import { getOptimalPath, getPlan, resetRunPlanRefs, setOptimalPath, setPlan } from './runPlanRefs';
import { initRunRng, trackRng } from './runRngBus';

// RunPlan and OptimalPath live in runPlanRefs.ts (can't go in koota traits).

export { DROP_DURATION_MS };

export interface StartRunOptions {
  seed?: number;
  seedPhrase?: string | null;
  difficulty?: Difficulty;
  /** User-toggled permadeath. */
  permadeath?: boolean;
  /**
   * Initial throttle. Default 1 (auto-accelerates). Pass 0 for debug mode.
   */
  initialThrottle?: number;
}

// Re-export for convenience
export type { RunAchievementStats } from '@/persistence/achievements';
export type { OptimalPath } from './optimalPath';
export type { RunPlan } from './runPlan';

// ─── Getters (read from ECS world) ──────────────────────────────────────────

/** Snapshot of the full game state — matches the reference GameState interface. */
export interface GameStateSnapshot {
  running: boolean;
  paused: boolean;
  gameOver: boolean;
  startedAt: number;
  seed: number;
  difficulty: Difficulty;
  seedPhrase: string | null;
  permadeath: boolean;
  plan: RunPlan | null;
  optimalPath: OptimalPath | null;
  cleanliness: number;
  distance: number;
  lateral: number;
  speedMps: number;
  targetSpeedMps: number;
  steer: number;
  throttle: number;
  hype: number;
  sanity: number;
  crowdReaction: number;
  crashes: number;
  currentZone: ZoneId;
  boostUntil: number;
  megaBoostUntil: number;
  dropProgress: number;
  dropStartedAt: number;
  plunging: boolean;
  plungeStartedAt: number;
  plungeDirection: number;
  currentPieceKind: PieceKind | null;
  photoMode: boolean;
  airborne: boolean;
  trickActive: boolean;
  trickRotationY: number;
  trickRotationZ: number;
  scaresThisRun: number;
  maxComboThisRun: number;
  raidsSurvived: number;
  ticketsThisRun: number;
}

function readState(w: World): GameStateSnapshot {
  const players = w.query(
    Player,
    RunSession,
    GameplayStats,
    BoostState,
    DropIntro,
    PlungeState,
    TrickState,
    RunCounters,
    PhotoMode,
  );
  const pe = players[0];
  if (!pe) {
    return {
      running: false,
      paused: false,
      gameOver: false,
      startedAt: 0,
      seed: 0,
      difficulty: DEFAULT_DIFFICULTY,
      seedPhrase: null,
      permadeath: false,
      plan: null,
      optimalPath: null,
      cleanliness: 1,
      distance: 0,
      lateral: 0,
      speedMps: 0,
      targetSpeedMps: 0,
      steer: 0,
      throttle: 1,
      hype: 0,
      sanity: 100,
      crowdReaction: 0,
      crashes: 0,
      currentZone: 'midway-strip',
      boostUntil: 0,
      megaBoostUntil: 0,
      dropProgress: 0,
      dropStartedAt: 0,
      plunging: false,
      plungeStartedAt: 0,
      plungeDirection: 0,
      currentPieceKind: null,
      photoMode: false,
      airborne: false,
      trickActive: false,
      trickRotationY: 0,
      trickRotationZ: 0,
      scaresThisRun: 0,
      maxComboThisRun: 0,
      raidsSurvived: 0,
      ticketsThisRun: 0,
    };
  }

  const rs = pe.get(RunSession)!;
  const gs = pe.get(GameplayStats)!;
  const bs = pe.get(BoostState)!;
  const di = pe.get(DropIntro)!;
  const ps = pe.get(PlungeState)!;
  const ts = pe.get(TrickState)!;
  const rc = pe.get(RunCounters)!;
  const pm = pe.get(PhotoMode)!;

  return {
    running: rs.running,
    paused: rs.paused,
    gameOver: rs.gameOver,
    startedAt: rs.startedAt,
    seed: rs.seed,
    difficulty: rs.difficulty,
    // '' in trait = null in snapshot (koota traits can't hold null strings)
    seedPhrase: rs.seedPhrase === '' ? null : rs.seedPhrase,
    permadeath: rs.permadeath,
    plan: getPlan(),
    optimalPath: getOptimalPath(),
    cleanliness: gs.cleanliness,
    distance: gs.distance,
    lateral: gs.lateral,
    speedMps: gs.speedMps,
    targetSpeedMps: gs.targetSpeedMps,
    steer: gs.steer,
    throttle: gs.throttle,
    hype: gs.hype,
    sanity: gs.sanity,
    crowdReaction: gs.crowdReaction,
    crashes: gs.crashes,
    currentZone: gs.currentZone,
    boostUntil: bs.boostUntil,
    megaBoostUntil: bs.megaBoostUntil,
    dropProgress: di.dropProgress,
    dropStartedAt: di.dropStartedAt,
    plunging: ps.plunging,
    plungeStartedAt: ps.plungeStartedAt,
    plungeDirection: ps.plungeDirection,
    currentPieceKind: ps.currentPieceKind,
    photoMode: pm.active,
    airborne: ts.airborne,
    trickActive: ts.trickActive,
    trickRotationY: ts.trickRotationY,
    trickRotationZ: ts.trickRotationZ,
    scaresThisRun: rc.scaresThisRun,
    maxComboThisRun: rc.maxComboThisRun,
    raidsSurvived: rc.raidsSurvived,
    ticketsThisRun: rc.ticketsThisRun,
  };
}

// ─── Ensure player entity has all game-state traits ─────────────────────────

/**
 * Called once at app boot to attach all run-state traits to the player entity.
 * Safe to call multiple times — koota no-ops if a trait is already present.
 */
export function ensureGameTraits(w: World = world): void {
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  // Only attach if missing — check for RunSession as the sentinel
  if (!pe.has(RunSession)) {
    const now = performance.now();
    pe.add(
      RunSession({
        running: false,
        paused: false,
        gameOver: false,
        startedAt: 0,
        seed: 0,
        difficulty: DEFAULT_DIFFICULTY,
        seedPhrase: '',
        permadeath: false,
      }),
    );
    resetRunPlanRefs();
    pe.add(
      GameplayStats({
        distance: 0,
        lateral: 0,
        speedMps: 0,
        targetSpeedMps: 0,
        steer: 0,
        throttle: 1,
        hype: 0,
        sanity: 100,
        crowdReaction: 0,
        crashes: 0,
        currentZone: 'midway-strip',
        cleanliness: 1,
      }),
    );
    pe.add(BoostState({ boostUntil: 0, megaBoostUntil: 0 }));
    pe.add(DropIntro({ dropProgress: 0, dropStartedAt: now }));
    pe.add(
      PlungeState({
        plunging: false,
        plungeStartedAt: 0,
        plungeDirection: 0,
        currentPieceKind: null,
      }),
    );
    pe.add(
      TrickState({ airborne: false, trickActive: false, trickRotationY: 0, trickRotationZ: 0 }),
    );
    pe.add(
      RunCounters({ scaresThisRun: 0, maxComboThisRun: 0, raidsSurvived: 0, ticketsThisRun: 0 }),
    );
    pe.add(PhotoMode({ active: false }));
  }
}

// ─── Setters (write to ECS world) ────────────────────────────────────────────

/** Full reset to defaults (for endRun / restart). */
function resetAllTraits(w: World): void {
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  const now = performance.now();
  pe.set(RunSession, {
    running: false,
    paused: false,
    gameOver: false,
    startedAt: 0,
    seed: 0,
    difficulty: DEFAULT_DIFFICULTY,
    seedPhrase: '',
    permadeath: false,
  });
  resetRunPlanRefs();
  pe.set(GameplayStats, {
    distance: 0,
    lateral: 0,
    speedMps: 0,
    targetSpeedMps: 0,
    steer: 0,
    throttle: 1,
    hype: 0,
    sanity: 100,
    crowdReaction: 0,
    crashes: 0,
    currentZone: 'midway-strip',
    cleanliness: 1,
  });
  pe.set(BoostState, { boostUntil: 0, megaBoostUntil: 0 });
  pe.set(DropIntro, { dropProgress: 0, dropStartedAt: now });
  pe.set(PlungeState, {
    plunging: false,
    plungeStartedAt: 0,
    plungeDirection: 0,
    currentPieceKind: null,
  });
  pe.set(TrickState, { airborne: false, trickActive: false, trickRotationY: 0, trickRotationZ: 0 });
  pe.set(RunCounters, {
    scaresThisRun: 0,
    maxComboThisRun: 0,
    raidsSurvived: 0,
    ticketsThisRun: 0,
  });
  pe.set(PhotoMode, { active: false });
}

export function startRun(options?: StartRunOptions, w: World = world): void {
  ensureGameTraits(w);
  const seed = options?.seed ?? Math.floor(Math.random() * 2 ** 31);
  const difficulty = options?.difficulty ?? DEFAULT_DIFFICULTY;
  const profile = DIFFICULTY_PROFILES[difficulty];
  const permadeath = effectivePermadeath(difficulty, options?.permadeath ?? false);
  initRunRng(seed);
  const plan = buildRunPlan({ seed, trackRng: trackRng() });
  setPlan(plan);
  setOptimalPath(solveOptimalPath(plan));
  resetDeviationWindow();
  const now = performance.now();
  combo.reset();

  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;

  pe.set(RunSession, {
    running: true,
    paused: false,
    gameOver: false,
    startedAt: now,
    seed,
    difficulty,
    // Encode null as '' (koota traits can't hold null strings)
    seedPhrase: options?.seedPhrase ?? '',
    permadeath,
  });
  pe.set(GameplayStats, {
    distance: 0,
    lateral: 0,
    speedMps: 0,
    targetSpeedMps: profile.targetSpeedMps,
    steer: 0,
    throttle: options?.initialThrottle ?? 1,
    hype: 0,
    sanity: 100,
    crowdReaction: 0,
    crashes: 0,
    currentZone: 'midway-strip',
    cleanliness: 1,
  });
  pe.set(BoostState, { boostUntil: 0, megaBoostUntil: 0 });
  pe.set(DropIntro, { dropProgress: 0, dropStartedAt: now });
  pe.set(PlungeState, {
    plunging: false,
    plungeStartedAt: 0,
    plungeDirection: 0,
    currentPieceKind: null,
  });
  pe.set(TrickState, { airborne: false, trickActive: false, trickRotationY: 0, trickRotationZ: 0 });
  pe.set(RunCounters, {
    scaresThisRun: 0,
    maxComboThisRun: 0,
    raidsSurvived: 0,
    ticketsThisRun: 0,
  });
  pe.set(PhotoMode, { active: false });
}

export function endRun(w: World = world): void {
  const s = readState(w);
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  pe.set(RunSession, { ...pe.get(RunSession)!, running: false, gameOver: true });
  persistRunEnd({
    distance: s.distance,
    crowd: s.crowdReaction,
    crashes: s.crashes,
    scaresThisRun: s.scaresThisRun,
    maxComboThisRun: s.maxComboThisRun,
    raidsSurvived: s.raidsSurvived,
    plunged: s.plunging,
    startedAt: s.startedAt,
  });
}

export function tick(dt: number, now: number, w: World = world): void {
  tickGameState(dt, now, w);
}

export function pause(w: World = world): void {
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  const rs = pe.get(RunSession);
  if (rs) pe.set(RunSession, { ...rs, paused: true });
}

export function resume(w: World = world): void {
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  const rs = pe.get(RunSession);
  if (rs) pe.set(RunSession, { ...rs, paused: false });
}

export function applyCrash(heavy = false, w: World = world): void {
  applyCrashAction(heavy, w);
}

export function applyPickup(kind: 'ticket' | 'boost' | 'mega', w: World = world): void {
  applyPickupAction(kind, w);
}

export function setSteer(v: number, w: World = world): void {
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  const gs = pe.get(GameplayStats);
  if (gs) pe.set(GameplayStats, { ...gs, steer: Math.max(-1, Math.min(1, v)) });
}

export function setLateral(v: number, w: World = world): void {
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  const gs = pe.get(GameplayStats);
  if (gs) pe.set(GameplayStats, { ...gs, lateral: v });
}

export function setThrottle(v: number, w: World = world): void {
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  const gs = pe.get(GameplayStats);
  if (gs) pe.set(GameplayStats, { ...gs, throttle: Math.max(0, Math.min(1, v)) });
}

export function setCurrentPieceKind(kind: PieceKind | null, w: World = world): void {
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  const ps = pe.get(PlungeState);
  if (ps) pe.set(PlungeState, { ...ps, currentPieceKind: kind });
}

export function setPhotoMode(v: boolean, w: World = world): void {
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  pe.set(PhotoMode, { active: v });
}

export function setAirborne(v: boolean, w: World = world): void {
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  const ts = pe.get(TrickState);
  if (ts) pe.set(TrickState, { ...ts, airborne: v });
}

export function setTrickState(active: boolean, rotY: number, rotZ: number, w: World = world): void {
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  const ts = pe.get(TrickState);
  if (ts)
    pe.set(TrickState, { ...ts, trickActive: active, trickRotationY: rotY, trickRotationZ: rotZ });
}

export function incrementScares(w: World = world): void {
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  const rc = pe.get(RunCounters);
  if (rc) pe.set(RunCounters, { ...rc, scaresThisRun: rc.scaresThisRun + 1 });
}

export function incrementRaidsSurvived(w: World = world): void {
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  const rc = pe.get(RunCounters);
  if (rc) pe.set(RunCounters, { ...rc, raidsSurvived: rc.raidsSurvived + 1 });
}

export function resetGameState(w: World = world): void {
  resetAllTraits(w);
  combo.reset();
  resetDeviationWindow();
}

// ─── useGameStore shim ───────────────────────────────────────────────────────

/**
 * Drop-in replacement for the zustand `useGameStore` hook.
 *
 * All existing `useGameStore(s => s.xxx)` selector patterns continue to work
 * because the selector receives a `GameStateSnapshot` (same shape as the
 * reference GameState) plus the action functions as methods. React will
 * re-render whenever any trait on the player entity changes.
 *
 * Implementation: uses koota's `useWorld()` + React's useCallback so it
 * doesn't allocate on every render. The snapshot is built fresh each call
 * because koota mutations are synchronous and the hook is only called when
 * a trait update triggers a re-render.
 */
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

/**
 * React hook that returns a selected slice of game state.
 * Mirrors the zustand `useGameStore(selector)` API exactly.
 *
 * Usage:
 *   const distance = useGameStore(s => s.distance);
 *   const { startRun } = useGameStore(s => ({ startRun: s.startRun }));
 */
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

// Stable RAF-backed subscribe fn — fires the listener whenever the
// cached snapshot's fields shift.
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

  // Reactive snapshot — re-renders this component whenever any tracked
  // field in the ECS-backed state mutates.
  const snapshot = useSyncExternalStore(subscribeToGameState, getCachedSnapshot);

  // Build the full state object with action methods bound to the world.
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

/**
 * Imperative (non-React) access to game state. For use outside React tree
 * (RAF loops, event handlers, tests). Returns a snapshot; not reactive.
 */
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

/**
 * Subscribe to state changes. Mimics zustand's `subscribe` for the few
 * call sites that use it imperatively (useGameSystems zone watcher).
 * Polls via a RAF-style interval using a stored snapshot.
 */
useGameStore.subscribe = (
  listener: (state: GameStateWithActions, prev: GameStateWithActions) => void,
): (() => void) => {
  let prev = useGameStore.getState();
  let rafId = 0;
  function poll() {
    const next = useGameStore.getState();
    // Only fire if meaningful fields changed
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

/**
 * Imperative state setter (zustand-compat). Merges partial updates
 * onto the relevant ECS traits. Accepts either a plain object or a
 * function updater `prev => Partial<GameStateSnapshot>` (zustand pattern).
 */
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
