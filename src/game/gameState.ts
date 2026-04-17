import { create } from 'zustand';
import { checkRunAchievements } from '@/persistence/achievements';
import { getStats, recordRun as recordLifetimeRun } from '@/persistence/lifetimeStats';
import { recordRun as recordProfileRun } from '@/persistence/profile';
import type { PieceKind } from '@/track/trackComposer';
import type { ZoneId } from '@/utils/constants';
import { TRACK } from '@/utils/constants';
import { combo } from './comboSystem';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_PROFILES,
  type Difficulty,
  effectivePermadeath,
} from './difficulty';
import { hapticsBus } from './hapticsBus';
import { type OptimalPath, optimalLateralAt, solveOptimalPath } from './optimalPath';
import { buildRunPlan, type RunPlan } from './runPlan';
import { initRunRng, trackRng } from './runRngBus';

/** Ramp piece kinds that have no side rails — plunge risk zone. */
const RAMP_KINDS: ReadonlySet<PieceKind> = new Set(['ramp', 'rampLong', 'rampLongCurved']);

/** How far beyond the lateral clamp the player must drift to trigger a plunge. */
const PLUNGE_OVERSHOOT_M = 0.5;

/**
 * Racing-line deviation window. We track the last 200 m of squared-error
 * samples; anything older is evicted. The window drives `cleanliness`.
 */
const DEVIATION_WINDOW_M = 200;
/** 0 m avg deviation → cleanliness 1.0; ≥ 3 m avg deviation → cleanliness 0.0 */
const DEVIATION_MAX_M = 3;
/** EMA smoothing factor applied each tick so the readout isn't jittery. */
const CLEANLINESS_EMA = 0.05;

/** Duration of the plunge animation in seconds. */
export const PLUNGE_DURATION_S = 1.5;

export interface StartRunOptions {
  seed?: number;
  seedPhrase?: string | null;
  difficulty?: Difficulty;
  /** User-toggled permadeath; only respected on nightmare (ultra-nightmare forces it on). */
  permadeath?: boolean;
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

export const DROP_DURATION_MS = 1800;

// ─── Deviation sliding window ────────────────────────────────────────────────
// Stores (d, lateral) samples from the last DEVIATION_WINDOW_M metres.
// Kept at module scope so it is not serialised into Zustand state (it is
// internal bookkeeping, not UI-visible state).
interface DeviationSample {
  d: number;
  lateralM: number;
}
let _deviationWindow: DeviationSample[] = [];

function resetDeviationWindow(): void {
  _deviationWindow = [];
}

/**
 * Add a sample and evict samples older than DEVIATION_WINDOW_M.
 * Returns the current raw mean-squared deviation over the window.
 */
function updateDeviationWindow(d: number, lateral: number, optPath: OptimalPath): number {
  _deviationWindow.push({ d, lateralM: lateral });
  // Evict samples that have fallen outside the sliding window
  const cutoff = d - DEVIATION_WINDOW_M;
  let i = 0;
  while (i < _deviationWindow.length && (_deviationWindow[i]?.d ?? 0) < cutoff) {
    i++;
  }
  if (i > 0) _deviationWindow = _deviationWindow.slice(i);

  if (_deviationWindow.length < 2) return 0;

  let sq = 0;
  let span = 0;
  for (let j = 1; j < _deviationWindow.length; j++) {
    const prev = _deviationWindow[j - 1];
    const cur = _deviationWindow[j];
    if (!prev || !cur) continue;
    const dM = cur.d - prev.d;
    if (dM <= 0) continue;
    const target = optimalLateralAt(optPath, cur.d);
    const err = cur.lateralM - target;
    sq += err * err * dM;
    span += dM;
  }
  return span > 0 ? sq / span : 0;
}

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
      dropProgress: 0,
      dropStartedAt: now,
      scaresThisRun: 0,
      maxComboThisRun: 0,
      raidsSurvived: 0,
      ticketsThisRun: 0,
    });
  },

  tick(dt, now) {
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
        set({ running: false, gameOver: true, plunging: false });
      }
      return;
    }

    // Speed interpolation toward target; target climbs slowly over time.
    const CRUISE = 70;
    const BOOST = 90;
    const MEGA = 120;
    let target = Math.min(CRUISE, 30 + s.distance * 0.005);
    if (now < s.boostUntil) target = BOOST;
    if (now < s.megaBoostUntil) target = MEGA;
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
    const maxComboThisRun = Math.max(get().maxComboThisRun, currentChain);

    // Racing-line cleanliness: update the deviation sliding window and smooth.
    let nextCleanliness = s.cleanliness;
    if (s.optimalPath !== null) {
      const msd = updateDeviationWindow(distance, s.lateral, s.optimalPath);
      // Normalise: 0 msd → 1.0; DEVIATION_MAX_M² msd → 0.0 (clamped).
      const raw = Math.max(0, 1 - msd / (DEVIATION_MAX_M * DEVIATION_MAX_M));
      // EMA smooth so the readout isn't jittery.
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
    });

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
      });
      hapticsBus.fire('crash-heavy');
      return;
    }

    // Game over when sanity exhausted
    if (sanity <= 0) set({ running: false, gameOver: true });
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

    // Finalize persistence asynchronously — UI does not wait for this
    const plunged = s.plunging;
    const secondsPlayed = s.startedAt > 0 ? (performance.now() - s.startedAt) / 1000 : 0;
    const summary = {
      distanceM: s.distance,
      crashes: s.crashes,
      scares: s.scaresThisRun,
      ticketsEarned: s.ticketsThisRun,
      crowd: s.crowdReaction,
      maxComboChain: s.maxComboThisRun,
      plunged,
      secondsPlayed,
    };

    Promise.resolve()
      .then(async () => {
        await recordProfileRun({ distance: s.distance, crowd: s.crowdReaction });
        await recordLifetimeRun(summary);
        const lifetime = await getStats();
        await checkRunAchievements(
          {
            distance: s.distance,
            crowd: s.crowdReaction,
            crashes: s.crashes,
            maxCombo: s.maxComboThisRun,
            scaresThisRun: s.scaresThisRun,
            raidsSurvived: s.raidsSurvived,
            plunged,
            secondsThisRun: secondsPlayed,
          },
          {
            totalDistanceCm: lifetime.totalDistanceCm,
            totalRunsCompleted: lifetime.totalRunsCompleted,
            totalScares: lifetime.totalScares,
            longestComboChain: lifetime.longestComboChain,
            maxSingleRunCrowd: lifetime.maxSingleRunCrowd,
            totalGameOversByPlunge: lifetime.totalGameOversByPlunge,
          },
        );
      })
      .catch((err: unknown) => {
        // Import reportError lazily to avoid circular dep at module init
        import('@/game/errorBus').then(({ reportError }) =>
          reportError(err, 'gameState.endRun persistence'),
        );
      });
  },

  applyCrash(heavy = false) {
    const s = get();
    // Permadeath: any collision ends the run instantly, no sanity math.
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
  },

  applyPickup(kind) {
    const s = get();
    const now = performance.now();
    // Cleanliness bonus multiplier: rewards players who follow the optimal
    // racing line. This is an additional multiplier ON TOP of the existing
    // combo chain multiplier — both stack on crowd gain events.
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
  },

  setSteer(v) {
    set({ steer: Math.max(-1, Math.min(1, v)) });
  },
  setLateral(v) {
    set({ lateral: v });
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
