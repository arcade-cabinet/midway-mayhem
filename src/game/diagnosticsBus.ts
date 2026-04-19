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
  hype: number;
  sanity: number;
  crowdReaction: number;
  crashes: number;
  currentZone: string;
  steer: number;
  lateral: number;
  obstacleCount: number;
  pickupCount: number;
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
}

const bus = {
  lastFrameTime: 0,
  fps: 0,
  frameTimeMs: 0,
  obstacleCount: 0,
  pickupCount: 0,
  drawCalls: 0,
  trackPieces: 0,
  meshesRendered: 0,
  cameraPos: [0, 0, 0] as [number, number, number],
  worldScrollerPos: [0, 0, 0] as [number, number, number],
  ecsDamage: 0,
  ecsDistance: 0,
  ecsLateral: 0,
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
        hype: s?.hype ?? 0,
        sanity: s?.sanity ?? 100,
        crowdReaction: s?.crowdReaction ?? 0,
        crashes: s?.crashes ?? 0,
        currentZone: s?.currentZone ?? 'midway-strip',
        steer: s?.steer ?? 0,
        lateral: s?.lateral ?? 0,
        obstacleCount: bus.obstacleCount,
        pickupCount: bus.pickupCount,
        drawCalls: bus.drawCalls,
        trackPieces: bus.trackPieces,
        meshesRendered: bus.meshesRendered,
        cameraPos: [...bus.cameraPos] as [number, number, number],
        worldScrollerPos: [...bus.worldScrollerPos] as [number, number, number],
        ecsDamage: bus.ecsDamage,
        ecsDistance: bus.ecsDistance,
        ecsLateral: bus.ecsLateral,
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
export function reportScene(info: {
  trackPieces: number;
  meshesRendered: number;
  cameraPos: [number, number, number];
  worldScrollerPos: [number, number, number];
}) {
  bus.trackPieces = info.trackPieces;
  bus.meshesRendered = info.meshesRendered;
  bus.cameraPos = info.cameraPos;
  bus.worldScrollerPos = info.worldScrollerPos;
}
export function reportEcsStats(info: {
  ecsDamage: number;
  ecsDistance: number;
  ecsLateral: number;
}) {
  bus.ecsDamage = info.ecsDamage;
  bus.ecsDistance = info.ecsDistance;
  bus.ecsLateral = info.ecsLateral;
}
