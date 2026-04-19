/**
 * @module obstacles/critterPool
 *
 * Critter pool helpers: idle-clip selection, pool pre-population,
 * and per-frame idle-phase seeding.
 *
 * Separated from ObstacleSystem.tsx — critter pooling has its own
 * lifecycle (clip loading, idle-phase mixing) distinct from per-frame
 * positioning logic.
 */
import * as THREE from 'three';
import { tunables } from '@/config';
import { reportError } from '@/game/errorBus';
import type { CritterKind } from '@/utils/constants';

export const CRITTER_KINDS: readonly CritterKind[] = ['cow', 'horse', 'llama', 'pig'];
export const CRITTER_POOL_SIZE = tunables.obstacles.critterPoolSize;
/** Farm-animal GLBs ship at real-world scale (~1m). Scale up to match Kenney track (scale=10). */
export const CRITTER_SCALE = tunables.obstacles.critterScale;

export const CRITTER_GLTF_IDS: Record<CritterKind, string> = {
  cow: 'gltf:critter_cow',
  horse: 'gltf:critter_horse',
  llama: 'gltf:critter_llama',
  pig: 'gltf:critter_pig',
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
 * Hard-fails if no idle animation clip is available — each critter GLB must
 * ship with at least one animation. Silent degradation is not acceptable.
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
    const err = new Error(`Critter GLB '${kind}' has no idle animation clip`);
    reportError(err, 'ObstacleSystem.critterSetup');
    throw err;
  }

  for (let i = 0; i < CRITTER_POOL_SIZE; i++) {
    const c = scene.clone(true);
    c.scale.setScalar(CRITTER_SCALE);
    c.position.set(0, -9999, 0);
    parentGroup.add(c);
    pools.slots[kind].push(c);

    const mixer = new THREE.AnimationMixer(c);
    const action = mixer.clipAction(clip);
    action.loop = THREE.LoopRepeat;
    action.play();
    // Per-slot idle phase offset so animals don't breathe in lockstep.
    mixer.setTime((i * 0.37) % Math.max(clip.duration, 0.1));
    pools.mixers[kind].push(mixer);
  }
}

/**
 * Track which plan entry index each pool slot was last seeded for, using a
 * WeakMap keyed on the slot Object3D. This avoids re-seeding every frame and
 * eliminates the need for a sentinel property on the Object3D.
 */
const phasedForIdxMap = new WeakMap<THREE.Object3D, number>();

/**
 * When a pool slot takes over a new plan entry, seed the mixer's time to
 * the entry's baked `idlePhase`. Prevents re-seeding every frame.
 */
export function seedMixerPhase(
  slot: THREE.Object3D,
  mixer: THREE.AnimationMixer,
  clips: THREE.AnimationClip[],
  entryIdx: number,
  idlePhase: number,
): void {
  if (phasedForIdxMap.get(slot) === entryIdx) return;
  const clip = pickIdleClip(clips);
  if (clip) {
    mixer.setTime(idlePhase % Math.max(clip.duration, 0.1));
  }
  phasedForIdxMap.set(slot, entryIdx);
}
