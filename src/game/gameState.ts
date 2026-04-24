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
import { resetGameOver } from '@/ecs/systems/gameOver';
import {
  BoostState,
  DropIntro,
  GameplayStats,
  PhotoMode,
  Player,
  PlungeState,
  RunCounters,
  RunSession,
  Score,
  Steer,
  TrickState,
} from '@/ecs/traits';
import { world } from '@/ecs/world';
import { isDailyRoute } from '@/track/dailyRoute';
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
import { finishAndMaybeSave, startRecording } from './replayRecorder';
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

export function readState(w: World): GameStateSnapshot {
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
      // plan + optimalPath live in runPlanRefs (module state), not ECS. Fall
      // through to whatever has been set so screens that consume the plan
      // before a player entity exists (title, pre-drop UI, isolated component
      // tests) see the real values instead of null.
      plan: getPlan(),
      optimalPath: getOptimalPath(),
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
  // stepGameOver keeps a module-level `ended` latch so onEnd fires at most
  // once per run. That latch must reset at run start — otherwise any fresh
  // run after the first game-over would never fire game-over again, and
  // the loop would tick forever. This is the ECS-side invariant that
  // accompanies App.tsx calling endRun() in the game-over handler.
  resetGameOver();
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

  // Replay recorder: start sampling for the new run. Trace is saved at
  // endRun when the run beats today's best in daily mode.
  startRecording();
}

export function endRun(w: World = world): void {
  const s = readState(w);
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  pe.set(RunSession, { ...pe.get(RunSession)!, running: false, gameOver: true });
  const balloons = pe.get(Score)?.balloons ?? 0;
  persistRunEnd({
    distance: s.distance,
    crowd: s.crowdReaction,
    crashes: s.crashes,
    balloons,
    scaresThisRun: s.scaresThisRun,
    maxComboThisRun: s.maxComboThisRun,
    raidsSurvived: s.raidsSurvived,
    plunged: s.plunging,
    startedAt: s.startedAt,
  });
  // Replay recorder: freeze the trace and save-if-best (daily mode only,
  // guarded inside finishAndMaybeSave).
  void finishAndMaybeSave(s.distance, s.crowdReaction, isDailyRoute());
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
  const clamped = Math.max(-1, Math.min(1, v));
  const players = w.query(Player);
  const pe = players[0];
  if (!pe) return;
  // Write BOTH: the Steer trait (read by gameStateTick to move the car)
  // and GameplayStats.steer (read by the diag bus for reporting). The
  // input bridges (keyboard/touch/mouse) only touch the Steer trait —
  // this programmatic setter has to update both so the trait is the
  // source of truth for motion and the snapshot reflects reality.
  w.query(Player, Steer).updateEach(([s]) => {
    s.value = clamped;
  });
  const gs = pe.get(GameplayStats);
  if (gs) pe.set(GameplayStats, { ...gs, steer: clamped });
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
//
// The zustand-compatible hook + `.getState()` / `.subscribe()` / `.setState()`
// live in `./gameStateShim` so this module stays focused on being the ECS
// read/write boundary. Re-exported here so existing call sites
// (`import { useGameStore } from '@/game/gameState'`) keep working.
export { type GameStateWithActions, useGameStore } from './gameStateShim';
