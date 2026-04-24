/**
 * @module game/diagnosticsBus
 *
 * Diagnostics bus — installs window.__mm.diag() and per-frame perf counters.
 * Reads game state from the ECS world (via useGameStore.getState()).
 *
 * Always on — the red-slab hunt and live debugging need __mm available on
 * the bare deployed URL with no flags. If we ever need to hide this in a
 * shipped build, reintroduce the URL gate here.
 */

import { honk } from '@/audio/honkBus';
import { combo } from './comboSystem';

export interface DiagnosticsDump {
  generatedAt: number;
  fps: number;
  /** Most-recent frame delta in milliseconds (raw, not smoothed). */
  frameTimeMs: number;
  running: boolean;
  paused: boolean;
  gameOver: boolean;
  /** Drop-in intro progress 0→1. Gameplay tick is frozen while < 1. */
  dropProgress: number;
  /** True while the cockpit plunge animation is in progress. Tick frozen. */
  plunging: boolean;
  /** Tickets earned this run from pickups (flushed to profile on endRun). */
  ticketsThisRun: number;
  /** Racing-line cleanliness EMA 0→1. 1 = on the optimal line, 0 = far off. */
  cleanliness: number;
  /** Current CROWD CHAIN combo length (0 if expired). */
  comboChain: number;
  /** Current combo multiplier (1× when chain=0, up to 8× at max chain). */
  comboMultiplier: number;
  distance: number;
  speedMps: number;
  /** Physics target speed the motion system is easing toward. */
  targetSpeedMps: number;
  /** Last throttle input: -1 = brake, 0 = coast, +1 = full throttle. */
  throttle: number;
  hype: number;
  sanity: number;
  crowdReaction: number;
  crashes: number;
  currentZone: string;
  /** Active difficulty tier for this run (kazoo | plenty | nightmare | ultra-nightmare). */
  difficulty: string;
  /** The seed phrase that generated this run. Null if the run hasn't started. */
  seedPhrase: string | null;
  /** Track archetype the player is currently over (flat | ramp | plunge | etc). Null before first piece. */
  currentPieceKind: string | null;
  /**
   * Pitch of the track segment directly under the player, in radians.
   * Negative = descending (plunge), positive = climbing (ramp). Zero on flat.
   * Populated by TrackScroller each frame via reportScene.
   */
  currentPiecePitch: number;
  /** True when the cockpit is off the track — i.e. mid-trick airborne window. */
  airborne: boolean;
  /** True while a trick animation is mid-flight. */
  trickActive: boolean;
  /** Critters scared cumulatively this run. */
  scaresThisRun: number;
  /** Highest CROWD CHAIN length reached this run. */
  maxComboThisRun: number;
  /** Completed raid events this run. */
  raidsSurvived: number;
  steer: number;
  lateral: number;
  obstacleCount: number;
  /** Per-kind obstacle counts (unconsumed only) so snapshots tell us what
   *  the player is actually seeing — critters missing vs spawned etc. */
  obstacleByKind: Record<string, number>;
  pickupCount: number;
  /** Per-kind pickup counts (balloons/boost/mega). */
  pickupByKind: Record<string, number>;
  drawCalls: number;
  trackPieces: number;
  meshesRendered: number;
  cameraPos: [number, number, number];
  worldScrollerPos: [number, number, number];
  /** ECS Score.damage — gates the `damage` game-over reason (≥3 ends the run). */
  ecsDamage: number;
  /** ECS Position.distance — drives TrackScroller's counter-rotate. */
  ecsDistance: number;
  /** ECS Position.lateral — drives collisions. */
  ecsLateral: number;
  /** ECS Score.boostRemaining — seconds left on the active boost (0 when inactive). */
  ecsBoostRemaining: number;
  /** ECS Score.cleanSeconds — consecutive seconds without a collision. */
  ecsCleanSeconds: number;
}

const bus = {
  lastFrameTime: 0,
  fps: 0,
  frameTimeMs: 0,
  obstacleCount: 0,
  obstacleByKind: {} as Record<string, number>,
  pickupCount: 0,
  pickupByKind: {} as Record<string, number>,
  drawCalls: 0,
  trackPieces: 0,
  meshesRendered: 0,
  cameraPos: [0, 0, 0] as [number, number, number],
  worldScrollerPos: [0, 0, 0] as [number, number, number],
  ecsDamage: 0,
  ecsDistance: 0,
  ecsLateral: 0,
  ecsBoostRemaining: 0,
  ecsCleanSeconds: 0,
  currentPiecePitch: 0,
};

export function installDiagnosticsBus() {
  if (typeof window === 'undefined') return;

  // biome-ignore lint/suspicious/noExplicitAny: diagnostic handle
  (window as any).__mm = {
    diag(): DiagnosticsDump {
      // Dynamic import to avoid circular dep at module evaluation time.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const gs = (globalThis as Record<string, unknown>).__mmGetState as
        | (() => import('./gameState').GameStateSnapshot)
        | undefined;
      const s = gs ? gs() : null;
      return {
        generatedAt: performance.now(),
        fps: bus.fps,
        frameTimeMs: bus.frameTimeMs,
        running: s?.running ?? false,
        paused: s?.paused ?? false,
        gameOver: s?.gameOver ?? false,
        dropProgress: s?.dropProgress ?? 0,
        plunging: s?.plunging ?? false,
        ticketsThisRun: s?.ticketsThisRun ?? 0,
        cleanliness: s?.cleanliness ?? 1,
        comboChain: combo.getChainLength(),
        comboMultiplier: combo.getMultiplier(),
        distance: s?.distance ?? 0,
        speedMps: s?.speedMps ?? 0,
        targetSpeedMps: s?.targetSpeedMps ?? 0,
        throttle: s?.throttle ?? 0,
        hype: s?.hype ?? 0,
        sanity: s?.sanity ?? 100,
        crowdReaction: s?.crowdReaction ?? 0,
        crashes: s?.crashes ?? 0,
        currentZone: s?.currentZone ?? 'midway-strip',
        difficulty: s?.difficulty ?? 'plenty',
        seedPhrase: s?.seedPhrase ?? null,
        currentPieceKind: s?.currentPieceKind ?? null,
        airborne: s?.airborne ?? false,
        trickActive: s?.trickActive ?? false,
        scaresThisRun: s?.scaresThisRun ?? 0,
        maxComboThisRun: s?.maxComboThisRun ?? 0,
        raidsSurvived: s?.raidsSurvived ?? 0,
        steer: s?.steer ?? 0,
        lateral: s?.lateral ?? 0,
        obstacleCount: bus.obstacleCount,
        obstacleByKind: { ...bus.obstacleByKind },
        pickupCount: bus.pickupCount,
        pickupByKind: { ...bus.pickupByKind },
        drawCalls: bus.drawCalls,
        trackPieces: bus.trackPieces,
        meshesRendered: bus.meshesRendered,
        cameraPos: [...bus.cameraPos] as [number, number, number],
        worldScrollerPos: [...bus.worldScrollerPos] as [number, number, number],
        ecsDamage: bus.ecsDamage,
        ecsDistance: bus.ecsDistance,
        ecsLateral: bus.ecsLateral,
        ecsBoostRemaining: bus.ecsBoostRemaining,
        ecsCleanSeconds: bus.ecsCleanSeconds,
        currentPiecePitch: bus.currentPiecePitch,
      };
    },
    setSteer(v: number) {
      const fn = (globalThis as Record<string, unknown>).__mmSetSteer as
        | ((v: number) => void)
        | undefined;
      fn?.(Math.max(-1, Math.min(1, v)));
    },
    start() {
      const fn = (globalThis as Record<string, unknown>).__mmStartRun as (() => void) | undefined;
      fn?.();
    },
    end() {
      const fn = (globalThis as Record<string, unknown>).__mmEndRun as (() => void) | undefined;
      fn?.();
    },
    crash(heavy = false) {
      const fn = (globalThis as Record<string, unknown>).__mmApplyCrash as
        | ((heavy: boolean) => void)
        | undefined;
      fn?.(heavy);
    },
    pickup(kind: 'ticket' | 'boost' | 'mega') {
      const fn = (globalThis as Record<string, unknown>).__mmApplyPickup as
        | ((kind: 'ticket' | 'boost' | 'mega') => void)
        | undefined;
      fn?.(kind);
    },
    pause() {
      const fn = (globalThis as Record<string, unknown>).__mmPause as (() => void) | undefined;
      fn?.();
    },
    resume() {
      const fn = (globalThis as Record<string, unknown>).__mmResume as (() => void) | undefined;
      fn?.();
    },
    comboEvent(kind: 'scare' | 'pickup' | 'near-miss') {
      combo.registerEvent(kind);
    },
    honk() {
      return honk();
    },
    dumpObstacles(): Array<Record<string, number | string | boolean>> {
      // Walks whatever the wireDiagnosticsHooks getObstacles hook returns.
      const fn = (globalThis as Record<string, unknown>).__mmGetObstacles as
        | (() => Array<Record<string, number | string | boolean>>)
        | undefined;
      return fn ? fn() : [];
    },
  };
}

/**
 * Called from inside App.tsx (which has access to the world) to wire up the
 * imperative __mm.* functions used by the diagnostics bus.
 * Must be called after the player entity is spawned.
 */
export interface DiagHooks {
  getState: () => import('./gameState').GameStateSnapshot;
  setSteer: (v: number) => void;
  startRun: () => void;
  endRun: () => void;
  applyCrash?: (heavy: boolean) => void;
  applyPickup?: (kind: 'ticket' | 'boost' | 'mega') => void;
  pause?: () => void;
  resume?: () => void;
  getObstacles?: () => Array<Record<string, number | string | boolean>>;
}

export function wireDiagnosticsHooks(hooks: DiagHooks): void {
  const g = globalThis as Record<string, unknown>;
  g.__mmGetState = hooks.getState;
  g.__mmSetSteer = hooks.setSteer;
  g.__mmStartRun = hooks.startRun;
  g.__mmEndRun = hooks.endRun;
  if (hooks.applyCrash) g.__mmApplyCrash = hooks.applyCrash;
  if (hooks.applyPickup) g.__mmApplyPickup = hooks.applyPickup;
  if (hooks.pause) g.__mmPause = hooks.pause;
  if (hooks.resume) g.__mmResume = hooks.resume;
  if (hooks.getObstacles) g.__mmGetObstacles = hooks.getObstacles;
}

/**
 * Returns the pitch of the track segment directly under the player, in
 * radians. Updated by TrackScroller every frame via reportScene. Zero when
 * no frame has been reported yet (pre-run or no track sampled).
 *
 * Intentionally a direct bus read — the full diag() dump triggers a
 * gameState snapshot which is too expensive for per-frame cockpit use.
 */
export function getCurrentPiecePitch(): number {
  return bus.currentPiecePitch;
}

export function reportFrame(dt: number) {
  const fpsSample = 1 / Math.max(dt, 1e-4);
  bus.fps = bus.fps === 0 ? fpsSample : bus.fps * 0.9 + fpsSample * 0.1;
  bus.frameTimeMs = dt * 1000;
}
export function reportCounts(obstacles: number, pickups: number, drawCalls: number) {
  bus.obstacleCount = obstacles;
  bus.pickupCount = pickups;
  bus.drawCalls = drawCalls;
}
export function reportObstacleKinds(byKind: Record<string, number>) {
  bus.obstacleByKind = { ...byKind };
}
export function reportPickupKinds(byKind: Record<string, number>) {
  bus.pickupByKind = { ...byKind };
}
type SceneListener = (cameraPos: [number, number, number]) => void;
const sceneListeners: Set<SceneListener> = new Set();

/**
 * Subscribe to per-frame camera-position updates emitted by TrackScroller.
 * Returns an unsubscribe function. Used by descentAmbience to track descent Y.
 */
export function onCameraPos(fn: SceneListener): () => void {
  sceneListeners.add(fn);
  return () => sceneListeners.delete(fn);
}

/** Synchronous snapshot of the most-recent camera world position. */
export function getCameraPos(): [number, number, number] {
  return [...bus.cameraPos] as [number, number, number];
}

export function reportScene(info: {
  trackPieces: number;
  meshesRendered: number;
  cameraPos: [number, number, number];
  worldScrollerPos: [number, number, number];
  /** Pitch of the segment directly under the player — cockpit pitch-look uses this. */
  currentPiecePitch?: number;
}) {
  bus.trackPieces = info.trackPieces;
  bus.meshesRendered = info.meshesRendered;
  bus.cameraPos = info.cameraPos;
  bus.worldScrollerPos = info.worldScrollerPos;
  if (info.currentPiecePitch !== undefined) bus.currentPiecePitch = info.currentPiecePitch;
  if (sceneListeners.size > 0) {
    for (const fn of sceneListeners) fn(info.cameraPos);
  }
}
export function reportEcsStats(info: {
  ecsDamage: number;
  ecsDistance: number;
  ecsLateral: number;
  ecsBoostRemaining: number;
  ecsCleanSeconds: number;
}) {
  bus.ecsDamage = info.ecsDamage;
  bus.ecsDistance = info.ecsDistance;
  bus.ecsLateral = info.ecsLateral;
  bus.ecsBoostRemaining = info.ecsBoostRemaining;
  bus.ecsCleanSeconds = info.ecsCleanSeconds;
}
