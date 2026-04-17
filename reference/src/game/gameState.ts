import { create } from 'zustand';
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
import { initRunRng, trackRng } from './runRngBus';

// PLUNGE_DURATION_S and RAMP_KINDS live in gameStateTick.ts
export { PLUNGE_DURATION_S } from './gameStateTick';

export interface StartRunOptions {
  seed?: number;
  seedPhrase?: string | null;
  difficulty?: Difficulty;
  /** User-toggled permadeath; only respected on nightmare (ultra-nightmare forces it on). */
  permadeath?: boolean;
  /**
   * Initial throttle. Default 1 (racing: car auto-accelerates). Pass 0 for
   * debug "visit midway" mode so the car stays put until the player hits ↑.
   */
  initialThrottle?: number;
}

export interface GameState {
  // session
  running: boolean;
  paused: boolean;
  gameOver: boolean;
  startedAt: number;
  seed: number;
  difficulty: Difficulty;
  /** Human-readable phrase the seed came from, if any (for UI + replay). */
  seedPhrase: string | null;
  /** Effective permadeath (any crash = instant run-end). */
  permadeath: boolean;
  /** Pre-baked run plan (every spawn for this entire run). Null until started. */
  plan: RunPlan | null;
  /** Optimal racing-line path solved from the plan at run start. Null until started. */
  optimalPath: OptimalPath | null;
  /**
   * Racing-line cleanliness [0..1]. 1.0 = perfect line, 0.0 = ≥3 m avg deviation.
   * Updated every physics tick from a 200 m sliding window of squared deviation.
   * Smoothed with a 0.05 EMA factor so the readout is not jittery.
   */
  cleanliness: number;

  // player
  distance: number;
  lateral: number; // player X offset from track centerline, meters
  speedMps: number;
  targetSpeedMps: number;
  steer: number; // normalized [-1,1]
  /**
   * Throttle gate for the auto-acceleration target. 1 = car drives itself
   * (the default racing behavior); 0 = car coasts/decelerates. Used by the
   * `?debug=1` "visit midway" mode so the player can hold position and
   * inspect scene elements without being whisked down the track.
   */
  throttle: number;

  // derived gameplay stats (branded names)
  hype: number; // speed-as-percent
  sanity: number; // 0..100 health-like; reduces on hit
  crowdReaction: number; // score
  crashes: number;
  currentZone: ZoneId;

  // boost state
  boostUntil: number; // performance.now() epoch
  megaBoostUntil: number;

  // trick system (Feature C)
  airborne: boolean;
  trickActive: boolean;
  trickRotationY: number;
  trickRotationZ: number;

  // drop-in intro: cockpit hangs from big-top rigging, then drops to track
  // value goes 0 → 1 over DROP_DURATION_MS; gameplay stats frozen until >= 1
  dropProgress: number;
  dropStartedAt: number;

  // plunge: player drove off the side of a rail-free ramp
  plunging: boolean;
  plungeStartedAt: number;
  /** Lateral direction at the moment of plunge (sign of lateral offset). */
  plungeDirection: number;
  /** The current piece kind under the player when plunge was triggered. */
  currentPieceKind: PieceKind | null;

  // photo mode
  photoMode: boolean;

  // per-run counters for achievements/lifetime stats (reset on startRun)
  scaresThisRun: number;
  maxComboThisRun: number;
  raidsSurvived: number;
  ticketsThisRun: number;

  // actions
  startRun(options?: StartRunOptions): void;
  incrementScares(): void;
  incrementRaidsSurvived(): void;
  tick(dt: number, now: number): void;
  pause(): void;
  resume(): void;
  endRun(): void;
  applyCrash(heavy?: boolean): void;
  applyPickup(kind: 'ticket' | 'boost' | 'mega'): void;
  setSteer(v: number): void;
  setLateral(v: number): void;
  setThrottle(v: number): void;
  /** Called each frame by TrackSystem to report which piece the player is on. */
  setCurrentPieceKind(kind: PieceKind | null): void;
  setPhotoMode(v: boolean): void;
  setAirborne(v: boolean): void;
  setTrickState(active: boolean, rotY: number, rotZ: number): void;
}

const DEFAULTS = {
  running: false,
  paused: false,
  gameOver: false,
  startedAt: 0,
  seed: 0,
  difficulty: DEFAULT_DIFFICULTY,
  seedPhrase: null,
  permadeath: false,
  plan: null as RunPlan | null,
  optimalPath: null as OptimalPath | null,
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
  currentZone: 'midway-strip' as ZoneId,
  boostUntil: 0,
  megaBoostUntil: 0,
  dropProgress: 0,
  dropStartedAt: 0,
  plunging: false,
  plungeStartedAt: 0,
  plungeDirection: 0,
  currentPieceKind: null as PieceKind | null,
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

export { DROP_DURATION_MS };

export const useGameStore = create<GameState>((set, get) => ({
  ...DEFAULTS,

  startRun(options?: StartRunOptions) {
    const seed = options?.seed ?? Math.floor(Math.random() * 2 ** 31);
    const difficulty = options?.difficulty ?? DEFAULT_DIFFICULTY;
    const profile = DIFFICULTY_PROFILES[difficulty];
    const permadeath = effectivePermadeath(difficulty, options?.permadeath ?? false);
    // Re-seed the run-scoped PRNG from the master seed so both track and
    // events channels are deterministic for this run.
    initRunRng(seed);
    // Pre-bake the ENTIRE run: obstacles, pickups, balloons, mirrors, fire
    // hoops, start platform, finish banner. All drawn from trackRng so burning
    // events entropy during play does not perturb the world.
    const plan = buildRunPlan({ seed, trackRng: trackRng() });
    // Solve optimal racing-line path once at run start.
    const optimalPath = solveOptimalPath(plan);
    resetDeviationWindow();
    const now = performance.now();
    combo.reset();
    set({
      ...DEFAULTS,
      running: true,
      paused: false,
      gameOver: false,
      seed,
      seedPhrase: options?.seedPhrase ?? null,
      difficulty,
      permadeath,
      plan,
      optimalPath,
      cleanliness: 1,
      startedAt: now,
      targetSpeedMps: profile.targetSpeedMps,
      speedMps: 0,
      throttle: options?.initialThrottle ?? 1,
      dropProgress: 0,
      dropStartedAt: now,
      scaresThisRun: 0,
      maxComboThisRun: 0,
      raidsSurvived: 0,
      ticketsThisRun: 0,
    });
  },

  tick(dt, now) {
    tickGameState(dt, now, set, get);
  },

  pause() {
    set({ paused: true });
  },

  resume() {
    set({ paused: false });
  },

  endRun() {
    const s = get();
    set({ running: false, gameOver: true });
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
  },

  applyCrash(heavy = false) {
    applyCrashAction(heavy, set, get);
  },

  applyPickup(kind) {
    applyPickupAction(kind, set, get);
  },

  setSteer(v) {
    set({ steer: Math.max(-1, Math.min(1, v)) });
  },
  setLateral(v) {
    set({ lateral: v });
  },
  setThrottle(v) {
    set({ throttle: Math.max(0, Math.min(1, v)) });
  },
  setCurrentPieceKind(kind) {
    set({ currentPieceKind: kind });
  },
  setPhotoMode(v) {
    set({ photoMode: v });
  },
  setAirborne(v) {
    set({ airborne: v });
  },
  setTrickState(active, rotY, rotZ) {
    set({ trickActive: active, trickRotationY: rotY, trickRotationZ: rotZ });
  },
  incrementScares() {
    set((s) => ({ scaresThisRun: s.scaresThisRun + 1 }));
  },
  incrementRaidsSurvived() {
    set((s) => ({ raidsSurvived: s.raidsSurvived + 1 }));
  },
}));

export function resetGameState() {
  useGameStore.setState({ ...DEFAULTS });
  combo.reset();
  resetDeviationWindow();
}

// Re-export for convenience — callers can destructure from gameState directly
export type { RunAchievementStats } from '@/persistence/achievements';
