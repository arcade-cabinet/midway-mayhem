/**
 * @module game/debugCapture
 *
 * Debug capture: pause the game, snapshot the current frame + full game
 * state, and POST the pair to a dev-only endpoint that writes both to
 * `.capture/<timestamp>/` in the repo.
 *
 * Activation:
 *   - Keyboard:   F8   (bound in useDebugCapture)
 *   - Programmatic: `await window.__mmCapture('label?')`
 *
 * Only registers in DEV or when `?diag=1`/`?debug=1`/`?governor=1` is set.
 * In production the button/hook are no-ops.
 *
 * The capture round-trips through the Vite dev server because the browser
 * can't write to disk directly — see `scripts/vite-capture-plugin.ts` for
 * the server side.
 */

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { getReportedErrors } from '@/game/errorBus';
import { useGameStore } from '@/game/gameState';
import { useLoadoutStore } from '@/hooks/useLoadout';
import type { DiagnosticsDump } from './diagnosticsBus';

export interface CapturePayload {
  /** ISO8601 timestamp used as the capture directory name. */
  capturedAt: string;
  /** Optional human label passed by the caller (e.g. "stuck-on-ramp"). */
  label: string | null;
  /** data: URL (image/png) of the current frame. */
  frameDataUrl: string;
  /** The dump returned by window.__mm.diag() — fps, positions, counts. */
  diag: DiagnosticsDump | null;
  /** Full zustand game state snapshot (excluding function fields). */
  gameState: Record<string, unknown>;
  /** Scene inventory by object type + list of named objects. */
  scene: {
    totalObjects: number;
    byType: Record<string, number>;
    namedObjects: Array<{ name: string; type: string; visible: boolean }>;
  };
  /** THREE.WebGLRenderer.info snapshot. */
  renderer: {
    memory: { geometries: number; textures: number };
    programs: number;
    render: { calls: number; triangles: number; points: number; lines: number; frame: number };
  };
  /** Equipped loadout at capture time. */
  loadout: unknown;
  /** All errors currently on the errorBus. */
  errors: ReturnType<typeof getReportedErrors>;
  /** Viewport + DPR + URL + UA at capture time. */
  environment: {
    url: string;
    userAgent: string;
    viewportCss: { width: number; height: number };
    devicePixelRatio: number;
    language: string;
    platform: string;
  };
  /** Which HTML overlays are currently visible (by data-testid scan). */
  overlays: string[];
}

function serializeGameState(): Record<string, unknown> {
  const s = useGameStore.getState() as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === 'function') continue;
    if (k === 'plan' || k === 'optimalPath') {
      // These are huge — summarize instead.
      if (v === null) out[k] = null;
      else if (typeof v === 'object') {
        const keys = Object.keys(v as object);
        out[k] = { _summary: true, keys, length: (v as { length?: number }).length ?? null };
      } else {
        out[k] = v;
      }
      continue;
    }
    out[k] = v;
  }
  return out;
}

function inventoryScene(scene: THREE.Scene): CapturePayload['scene'] {
  const byType: Record<string, number> = {};
  const named: CapturePayload['scene']['namedObjects'] = [];
  let total = 0;
  scene.traverse((obj) => {
    total++;
    byType[obj.type] = (byType[obj.type] ?? 0) + 1;
    if (obj.name) named.push({ name: obj.name, type: obj.type, visible: obj.visible });
  });
  return { totalObjects: total, byType, namedObjects: named };
}

function snapshotRenderer(gl: THREE.WebGLRenderer): CapturePayload['renderer'] {
  const info = gl.info;
  return {
    memory: { geometries: info.memory.geometries, textures: info.memory.textures },
    programs: info.programs?.length ?? 0,
    render: {
      calls: info.render.calls,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      frame: info.render.frame,
    },
  };
}

function scanOverlays(): string[] {
  if (typeof document === 'undefined') return [];
  const matches: string[] = [];
  const selectors = [
    'error-modal',
    'new-run-modal',
    'ticket-shop',
    'achievements-panel',
    'settings-panel',
    'how-to-play-panel',
    'credits-panel',
    'stats-panel',
    'zone-banner',
    'photo-mode-overlay',
  ];
  for (const id of selectors) {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (el && (el as HTMLElement).offsetParent !== null) matches.push(id);
  }
  return matches;
}

/**
 * Called from inside a Canvas useFrame context so it has live access to
 * `gl`, `scene`, `camera`. Returns the full payload.
 */
export function buildCapturePayload(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  label: string | null,
): CapturePayload {
  // Force a fresh render so toDataURL() has a live backbuffer even without
  // preserveDrawingBuffer:true — this is the same trick PhotoMode uses.
  gl.render(scene, camera);
  const frameDataUrl = gl.domElement.toDataURL('image/png');

  // biome-ignore lint/suspicious/noExplicitAny: diag handle set by diagnosticsBus
  const diagFn = (window as any).__mm?.diag as (() => DiagnosticsDump) | undefined;
  const diag = diagFn ? diagFn() : null;

  return {
    capturedAt: new Date().toISOString(),
    label,
    frameDataUrl,
    diag,
    gameState: serializeGameState(),
    scene: inventoryScene(scene),
    renderer: snapshotRenderer(gl),
    loadout: useLoadoutStore.getState().loadout,
    errors: getReportedErrors(),
    environment: {
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      viewportCss: {
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
      },
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      language: typeof navigator !== 'undefined' ? navigator.language : '',
      platform:
        // biome-ignore lint/suspicious/noExplicitAny: userAgentData is optional in typings
        (typeof navigator !== 'undefined' &&
          (navigator as any).userAgentData?.platform) ||
        (typeof navigator !== 'undefined' ? navigator.platform : ''),
    },
    overlays: scanOverlays(),
  };
}

/**
 * R3F component. Mount inside <Canvas>. Registers `window.__mmCapture` so
 * the keyboard hook (outside Canvas) can trigger a frame-accurate capture.
 */
export function DebugCaptureBridge() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // biome-ignore lint/suspicious/noExplicitAny: debug hook
    (window as any).__mmCapture = async (label?: string) => {
      const payload = buildCapturePayload(gl, scene, camera, label ?? null);
      // Pause the sim so subsequent frames don't race past the captured moment.
      const store = useGameStore.getState();
      if (store.running && !store.paused && !store.gameOver) store.pause();
      return postCapture(payload);
    };
    return () => {
      // biome-ignore lint/suspicious/noExplicitAny: debug hook
      delete (window as any).__mmCapture;
    };
  }, [gl, scene, camera]);
  return null;
}

async function postCapture(
  payload: CapturePayload,
): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    const res = await fetch('/__capture', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return (await res.json()) as { ok: boolean; path?: string; error?: string };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
