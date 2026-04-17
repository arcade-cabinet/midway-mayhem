/**
 * @module obstacles/critterPool
 *
 * Critter pool helpers: idle-clip selection, pool pre-population,
 * and per-frame idle-phase seeding.
 *
 * Separated from ObstacleSystem.tsx to keep that file under 300 LOC.
 */

import * as THREE from 'three';
import { assetUrl } from '@/assets/manifest';
import { reportError } from '@/game/errorBus';
import type { CritterKind } from '@/utils/constants';

export const CRITTER_KINDS: readonly CritterKind[] = ['cow', 'horse', 'llama', 'pig'];
export const CRITTER_POOL_SIZE = 10;
/** Farm-animal GLBs ship at real-world scale (~1m). Scale up to match Kenney track (scale=10). */
export const CRITTER_SCALE = 3.5;

export const CRITTER_GLTF_IDS: Record<CritterKind, string> = {
  cow: 'gltf:critter_cow',
  horse: 'gltf:critter_horse',
  llama: 'gltf:critter_llama',
  pig: 'gltf:critter_pig',
};

/** Preload all critter GLBs via useGLTF.preload (called at module init). */
export const CRITTER_ASSET_URLS: Record<CritterKind, string> = {
  cow: assetUrl('gltf:critter_cow'),
  horse: assetUrl('gltf:critter_horse'),
  llama: assetUrl('gltf:critter_llama'),
  pig: assetUrl('gltf:critter_pig'),
};

/**
 * Pick the idle animation clip from a GLB's animations array. Prefers a
 * clip whose name contains "idle" (case-insensitive); falls back to the
 * first clip since every critter GLB in this project ships with exactly
 * one looping idle clip.
 */
export function pickIdleClip(clips: THREE.AnimationClip[]): THREE.AnimationClip | null {
  if (clips.length === 0) return null;
  const idle = clips.find((c) => /idle/i.test(c.name));
  return idle ?? clips[0] ?? null;
}

export interface CritterPools {
  slots: Record<CritterKind, THREE.Object3D[]>;
  mixers: Record<CritterKind, THREE.AnimationMixer[]>;
}

export function makeCritterPools(): CritterPools {
  return {
    slots: { cow: [], horse: [], llama: [], pig: [] },
    mixers: { cow: [], horse: [], llama: [], pig: [] },
  };
}

/**
 * Populate a critter pool for one kind if not already populated.
 * Appends clones + mixers into `pools`. Adds clones to `parentGroup`.
 *
 * Returns true if the pool was newly populated (so caller can mark it done).
 */
export function populateCritterKind(
  kind: CritterKind,
  scene: THREE.Object3D,
  animations: THREE.AnimationClip[],
  pools: CritterPools,
  parentGroup: THREE.Group,
): void {
  if (pools.slots[kind].length > 0) return;

  const clip = pickIdleClip(animations);
  if (!clip) {
    reportError(
      new Error(`Critter GLB '${kind}' has no idle animation clip`),
      'ObstacleSystem.critterSetup',
    );
  }

  for (let i = 0; i < CRITTER_POOL_SIZE; i++) {
    const c = scene.clone(true);
    c.scale.setScalar(CRITTER_SCALE);
    c.position.set(0, -9999, 0);
    parentGroup.add(c);
    pools.slots[kind].push(c);

    const mixer = new THREE.AnimationMixer(c);
    if (clip) {
      const action = mixer.clipAction(clip);
      action.loop = THREE.LoopRepeat;
      action.play();
      // Per-slot idle phase offset so animals don't breathe in lockstep.
      mixer.setTime((i * 0.37) % Math.max(clip.duration, 0.1));
    }
    pools.mixers[kind].push(mixer);
  }
}

/**
 * When a pool slot takes over a new plan entry, seed the mixer's time to
 * the entry's baked `idlePhase`. Prevents re-seeding every frame via a
 * sentinel property attached to the slot object.
 */
export function seedMixerPhase(
  slot: THREE.Object3D,
  mixer: THREE.AnimationMixer,
  clips: THREE.AnimationClip[],
  entryIdx: number,
  idlePhase: number,
): void {
  // biome-ignore lint/suspicious/noExplicitAny: sentinel attachment
  const slotAny = slot as any;
  if (slotAny.__mmPhasedForIdx === entryIdx) return;
  const clip = pickIdleClip(clips);
  if (clip) {
    mixer.setTime(idlePhase % Math.max(clip.duration, 0.1));
  }
  slotAny.__mmPhasedForIdx = entryIdx;
}
