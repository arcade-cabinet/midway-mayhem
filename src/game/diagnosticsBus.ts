import { useLoadoutStore } from '@/hooks/useLoadout';
import type { UnlockKind } from '@/persistence/schema';
import { useGameStore } from './gameState';

export interface DiagnosticsDump {
  generatedAt: number;
  fps: number;
  /** Most-recent frame delta in milliseconds (raw, not smoothed). */
  frameTimeMs: number;
  running: boolean;
  paused: boolean;
  gameOver: boolean;
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
}

const bus = {
  lastFrameTime: 0,
  fps: 0,
  /** Raw frame delta in milliseconds from the most-recent useFrame tick. */
  frameTimeMs: 0,
  obstacleCount: 0,
  pickupCount: 0,
  drawCalls: 0,
  trackPieces: 0,
  meshesRendered: 0,
  cameraPos: [0, 0, 0] as [number, number, number],
  worldScrollerPos: [0, 0, 0] as [number, number, number],
};

export function installDiagnosticsBus() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const enabled =
    import.meta.env.DEV || params.get('diag') === '1' || params.get('governor') === '1';
  if (!enabled) return;

  // biome-ignore lint/suspicious/noExplicitAny: diagnostic handle
  (window as any).__mm = {
    diag(): DiagnosticsDump {
      const s = useGameStore.getState();
      return {
        generatedAt: performance.now(),
        fps: bus.fps,
        frameTimeMs: bus.frameTimeMs,
        running: s.running,
        paused: s.paused,
        gameOver: s.gameOver,
        distance: s.distance,
        speedMps: s.speedMps,
        hype: s.hype,
        sanity: s.sanity,
        crowdReaction: s.crowdReaction,
        crashes: s.crashes,
        currentZone: s.currentZone,
        steer: s.steer,
        lateral: s.lateral,
        obstacleCount: bus.obstacleCount,
        pickupCount: bus.pickupCount,
        drawCalls: bus.drawCalls,
        trackPieces: bus.trackPieces,
        meshesRendered: bus.meshesRendered,
        cameraPos: [...bus.cameraPos] as [number, number, number],
        worldScrollerPos: [...bus.worldScrollerPos] as [number, number, number],
      };
    },
    setSteer(v: number) {
      useGameStore.getState().setSteer(Math.max(-1, Math.min(1, v)));
    },
    start() {
      useGameStore.getState().startRun();
    },
    end() {
      useGameStore.getState().endRun();
    },
    async equip(kind: UnlockKind, slug: string): Promise<void> {
      await useLoadoutStore.getState().equip(kind, slug);
    },
    getLoadout() {
      return useLoadoutStore.getState().loadout;
    },
  };
}

export function reportFrame(dt: number) {
  const fpsSample = 1 / Math.max(dt, 1e-4);
  bus.fps = bus.fps === 0 ? fpsSample : bus.fps * 0.9 + fpsSample * 0.1;
  // Raw frame delta in milliseconds — used by the perf profiler script.
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
