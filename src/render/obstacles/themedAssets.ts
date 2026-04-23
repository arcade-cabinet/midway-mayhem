/**
 * @module render/obstacles/themedAssets
 *
 * Canonical mapping from ObstacleKind → GLB asset descriptor.
 *
 * All GLBs are KayKit (CC0) assets baked into public/models/obstacles/.
 * This module HARD-FAILS at load time if any kind is missing from the map.
 * No fallback rendering. Per STANDARDS.md error discipline.
 *
 * Sources:
 *   cone    — KayKit_Platformer_Pack_1.0_SOURCE/cone_yellow.glb   (KayKit CC0)
 *   barrier — KayKit_Platformer_Pack_1.0_SOURCE/barrier_2x1x1.glb (KayKit CC0)
 *   gate    — KayKit_Medieval_Hexagon_Pack_1.0_SOURCE/fence_stone_straight_gate.glb (KayKit CC0)
 *   hammer  — KayKit_Platformer_Pack_1.0_SOURCE/hammer_large_red.glb  (KayKit CC0)
 *   oil     — KayKit_Medieval_Hexagon_Pack_1.0_SOURCE/barrel.glb  (KayKit CC0)
 *   critter — KayKit_Medieval_Hexagon_Pack_1.0_SOURCE/horse_A.glb (KayKit CC0)
 */
import type { ObstacleKind } from '@/ecs/traits';

export interface ObstacleAsset {
  /** Path relative to web root (Vite public/).  Matches useGLTF arg. */
  readonly path: string;
  /** Uniform scale applied to the loaded scene root. */
  readonly scale: number;
  /** Y offset in metres to land the model flush on the track surface. */
  readonly yOffset: number;
}

/**
 * Resolve a path relative to the Vite BASE_URL.
 * Works in both browser (import.meta.env.BASE_URL = '/midway-mayhem/')
 * and test environments (BASE_URL defaults to '/').
 */
function p(filename: string): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  return `${base}/models/obstacles/${filename}`;
}

/**
 * Typed record keyed by every ObstacleKind.
 *
 * NOTE: The generic constraint ensures the type checker catches any missing
 * or misspelled keys at compile time — no runtime guard required.
 */
export const OBSTACLE_ASSETS: Record<ObstacleKind, ObstacleAsset> = {
  cone: {
    path: p('cone.glb'),
    scale: 1.2,
    yOffset: 0,
  },
  barrier: {
    path: p('barrier.glb'),
    scale: 0.9,
    yOffset: 0,
  },
  gate: {
    path: p('gate.glb'),
    scale: 1.5,
    yOffset: 0,
  },
  hammer: {
    path: p('hammer.glb'),
    scale: 1.1,
    yOffset: 2.2,
  },
  oil: {
    path: p('oil.glb'),
    scale: 1.3,
    yOffset: 0,
  },
  critter: {
    path: p('critter.glb'),
    scale: 1.0,
    yOffset: 0,
  },
} as const;

// ── Hard-fail guard ──────────────────────────────────────────────────────────
// Verify every kind is present at module initialisation.
// TypeScript's exhaustive Record already enforces this at compile time, but
// the runtime check catches any serialisation / build pipeline surprises.

const EXPECTED_KINDS: ObstacleKind[] = ['barrier', 'cone', 'gate', 'oil', 'hammer', 'critter'];

for (const kind of EXPECTED_KINDS) {
  if (!(kind in OBSTACLE_ASSETS)) {
    throw new Error(`themedAssets: missing entry for ObstacleKind '${kind}'`);
  }
  const entry = OBSTACLE_ASSETS[kind];
  if (!entry.path) {
    throw new Error(`themedAssets: empty path for ObstacleKind '${kind}'`);
  }
}

/** Ordered list of all obstacle GLB paths — used for useGLTF.preload calls. */
export const ALL_OBSTACLE_PATHS = EXPECTED_KINDS.map((k) => OBSTACLE_ASSETS[k].path);
