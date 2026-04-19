/**
 * diagnosticsBus unit tests — window.__mm install, hook wiring, and
 * per-frame counters. Stubs window/globalThis so we can run under
 * the node vitest project.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Pre-module globals ─────────────────────────────────────────────────────
// We stub window + globalThis BEFORE importing the module so installDiagnosticsBus
// sees a DOM-like environment.

type MutableGlobal = Record<string, unknown> & { window?: unknown };

const GLOBAL = globalThis as MutableGlobal;
const ORIG_WINDOW = GLOBAL.window;

function setSearch(search: string) {
  GLOBAL.window = {
    location: { search },
  };
}

function clearMmGlobals() {
  const g = GLOBAL;
  for (const key of [
    '__mmGetState',
    '__mmSetSteer',
    '__mmStartRun',
    '__mmEndRun',
    '__mmApplyCrash',
    '__mmApplyPickup',
    '__mmPause',
    '__mmResume',
    '__mm',
  ]) {
    g[key] = undefined;
  }
  const win = g.window as Record<string, unknown> | undefined;
  if (win) win.__mm = undefined;
}

beforeEach(() => {
  setSearch('?diag=1');
  clearMmGlobals();
});

afterEach(() => {
  clearMmGlobals();
  GLOBAL.window = ORIG_WINDOW;
});

async function freshModule() {
  vi.resetModules();
  return await import('@/game/diagnosticsBus');
}

// ─── reportFrame / reportCounts / reportScene ───────────────────────────────

describe('reportFrame', () => {
  it('first sample seeds fps from 1/dt', async () => {
    const mod = await freshModule();
    mod.installDiagnosticsBus();
    mod.reportFrame(1 / 60);
    const diag = (
      GLOBAL.window as { __mm: { diag(): { fps: number; frameTimeMs: number } } }
    ).__mm.diag();
    expect(diag.fps).toBeCloseTo(60, 5);
    expect(diag.frameTimeMs).toBeCloseTo((1 / 60) * 1000, 5);
  });

  it('EMA moves toward the new sample over repeated calls', async () => {
    const mod = await freshModule();
    mod.installDiagnosticsBus();
    mod.reportFrame(1 / 60); // seeds at 60
    for (let i = 0; i < 100; i++) mod.reportFrame(1 / 30); // pull toward 30
    const diag = (GLOBAL.window as { __mm: { diag(): { fps: number } } }).__mm.diag();
    expect(diag.fps).toBeGreaterThan(30);
    expect(diag.fps).toBeLessThan(35);
  });

  it('clamps absurdly small dt so fps does not blow up', async () => {
    const mod = await freshModule();
    mod.installDiagnosticsBus();
    mod.reportFrame(0);
    const diag = (GLOBAL.window as { __mm: { diag(): { fps: number } } }).__mm.diag();
    expect(Number.isFinite(diag.fps)).toBe(true);
    expect(diag.fps).toBeLessThanOrEqual(10_001);
  });
});

describe('reportCounts + reportScene', () => {
  it('exposes obstacle/pickup/drawCall counts via __mm.diag()', async () => {
    const mod = await freshModule();
    mod.installDiagnosticsBus();
    mod.reportCounts(7, 3, 42);
    const diag = (
      GLOBAL.window as {
        __mm: { diag(): { obstacleCount: number; pickupCount: number; drawCalls: number } };
      }
    ).__mm.diag();
    expect(diag.obstacleCount).toBe(7);
    expect(diag.pickupCount).toBe(3);
    expect(diag.drawCalls).toBe(42);
  });

  it('exposes scene info (trackPieces, meshesRendered, positions)', async () => {
    const mod = await freshModule();
    mod.installDiagnosticsBus();
    mod.reportScene({
      trackPieces: 19,
      meshesRendered: 150,
      cameraPos: [1, 2, 3],
      worldScrollerPos: [4, 5, 6],
    });
    const diag = (
      GLOBAL.window as {
        __mm: {
          diag(): {
            trackPieces: number;
            meshesRendered: number;
            cameraPos: [number, number, number];
            worldScrollerPos: [number, number, number];
          };
        };
      }
    ).__mm.diag();
    expect(diag.trackPieces).toBe(19);
    expect(diag.meshesRendered).toBe(150);
    expect(diag.cameraPos).toEqual([1, 2, 3]);
    expect(diag.worldScrollerPos).toEqual([4, 5, 6]);
  });
});

// ─── installDiagnosticsBus gating ───────────────────────────────────────────

describe('installDiagnosticsBus gating', () => {
  it('is a no-op when window is undefined', async () => {
    GLOBAL.window = undefined;
    const mod = await freshModule();
    mod.installDiagnosticsBus();
    expect(GLOBAL.__mm).toBeUndefined();
  });

  it('installs __mm unconditionally (no URL flag needed)', async () => {
    setSearch('');
    const mod = await freshModule();
    mod.installDiagnosticsBus();
    const win = GLOBAL.window as { __mm?: unknown };
    expect(win.__mm).toBeDefined();
  });

  it('installs __mm when ?diag=1 is set', async () => {
    setSearch('?diag=1');
    const mod = await freshModule();
    mod.installDiagnosticsBus();
    const win = GLOBAL.window as { __mm?: unknown };
    expect(win.__mm).toBeDefined();
  });

  it('installs __mm when ?governor=1 is set', async () => {
    setSearch('?governor=1');
    const mod = await freshModule();
    mod.installDiagnosticsBus();
    const win = GLOBAL.window as { __mm?: unknown };
    expect(win.__mm).toBeDefined();
  });
});

// ─── __mm.diag default values (no state hook wired) ─────────────────────────

describe('__mm.diag() default values', () => {
  it('falls back to safe defaults when no getState hook is wired', async () => {
    const mod = await freshModule();
    mod.installDiagnosticsBus();
    const diag = (
      GLOBAL.window as {
        __mm: {
          diag(): {
            running: boolean;
            paused: boolean;
            gameOver: boolean;
            distance: number;
            speedMps: number;
            sanity: number;
            currentZone: string;
            cleanliness: number;
            ticketsThisRun: number;
          };
        };
      }
    ).__mm.diag();
    expect(diag.running).toBe(false);
    expect(diag.paused).toBe(false);
    expect(diag.gameOver).toBe(false);
    expect(diag.distance).toBe(0);
    expect(diag.speedMps).toBe(0);
    expect(diag.sanity).toBe(100);
    expect(diag.cleanliness).toBe(1);
    expect(diag.ticketsThisRun).toBe(0);
    expect(diag.currentZone).toBe('midway-strip');
  });
});

// ─── wireDiagnosticsHooks ───────────────────────────────────────────────────

describe('wireDiagnosticsHooks', () => {
  it('routes __mm.start/end/pause/resume/crash/pickup to wired callbacks', async () => {
    const mod = await freshModule();
    mod.installDiagnosticsBus();
    const getState = vi.fn(() => ({
      running: true,
      paused: false,
      gameOver: false,
      distance: 123,
      speedMps: 20,
      hype: 0,
      sanity: 80,
      crowdReaction: 0,
      crashes: 0,
      currentZone: 'midway-strip',
      steer: 0.5,
      lateral: 0,
      dropProgress: 1,
      plunging: false,
      ticketsThisRun: 4,
      cleanliness: 0.7,
    }));
    const setSteer = vi.fn();
    const startRun = vi.fn();
    const endRun = vi.fn();
    const applyCrash = vi.fn();
    const applyPickup = vi.fn();
    const pause = vi.fn();
    const resume = vi.fn();

    mod.wireDiagnosticsHooks({
      getState: getState as unknown as Parameters<typeof mod.wireDiagnosticsHooks>[0]['getState'],
      setSteer,
      startRun,
      endRun,
      applyCrash,
      applyPickup,
      pause,
      resume,
    });

    const mm = (
      GLOBAL.window as {
        __mm: {
          diag(): { distance: number; ticketsThisRun: number };
          setSteer(v: number): void;
          start(): void;
          end(): void;
          crash(h?: boolean): void;
          pickup(k: 'ticket' | 'boost' | 'mega'): void;
          pause(): void;
          resume(): void;
        };
      }
    ).__mm;

    const d = mm.diag();
    expect(d.distance).toBe(123);
    expect(d.ticketsThisRun).toBe(4);

    mm.setSteer(0.8);
    expect(setSteer).toHaveBeenCalledWith(0.8);

    mm.setSteer(5); // clamped to 1
    expect(setSteer).toHaveBeenLastCalledWith(1);

    mm.setSteer(-5); // clamped to -1
    expect(setSteer).toHaveBeenLastCalledWith(-1);

    mm.start();
    expect(startRun).toHaveBeenCalled();

    mm.end();
    expect(endRun).toHaveBeenCalled();

    mm.crash(true);
    expect(applyCrash).toHaveBeenCalledWith(true);

    mm.pickup('mega');
    expect(applyPickup).toHaveBeenCalledWith('mega');

    mm.pause();
    expect(pause).toHaveBeenCalled();

    mm.resume();
    expect(resume).toHaveBeenCalled();
  });

  it('optional hooks (applyCrash/applyPickup/pause/resume) can be omitted', async () => {
    const mod = await freshModule();
    mod.installDiagnosticsBus();
    type GetStateFn = Parameters<typeof mod.wireDiagnosticsHooks>[0]['getState'];
    const stubState = {
      running: false,
      paused: false,
      gameOver: false,
      distance: 0,
      speedMps: 0,
      hype: 0,
      sanity: 100,
      crowdReaction: 0,
      crashes: 0,
      currentZone: 'midway-strip',
      steer: 0,
      lateral: 0,
      dropProgress: 0,
      plunging: false,
      ticketsThisRun: 0,
      cleanliness: 1,
    };
    mod.wireDiagnosticsHooks({
      getState: (() => stubState) as unknown as GetStateFn,
      setSteer: vi.fn(),
      startRun: vi.fn(),
      endRun: vi.fn(),
    });

    // These calls should silently no-op with no hook wired.
    const mm = (
      GLOBAL.window as {
        __mm: {
          crash(h?: boolean): void;
          pickup(k: string): void;
          pause(): void;
          resume(): void;
        };
      }
    ).__mm;
    expect(() => mm.crash(false)).not.toThrow();
    expect(() => mm.pickup('ticket')).not.toThrow();
    expect(() => mm.pause()).not.toThrow();
    expect(() => mm.resume()).not.toThrow();
  });
});
