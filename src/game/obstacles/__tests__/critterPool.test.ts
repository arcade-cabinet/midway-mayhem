/**
 * critterPool unit tests — idle-clip selection, pool construction,
 * pool population + per-slot phase offsets, seedMixerPhase memoization.
 * Uses real three.js classes (Node-compatible — no WebGL required).
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CRITTER_GLTF_IDS,
  CRITTER_KINDS,
  CRITTER_POOL_SIZE,
  CRITTER_SCALE,
  makeCritterPools,
  pickIdleClip,
  populateCritterKind,
  seedMixerPhase,
} from '@/game/obstacles/critterPool';

function makeClip(name: string, duration = 1): THREE.AnimationClip {
  return new THREE.AnimationClip(name, duration, []);
}

describe('CRITTER module constants', () => {
  it('exports the four CRITTER_KINDS', () => {
    expect([...CRITTER_KINDS].sort()).toEqual(['cow', 'horse', 'llama', 'pig']);
  });

  it('maps every kind to a gltf: prefixed asset id', () => {
    for (const k of CRITTER_KINDS) {
      expect(CRITTER_GLTF_IDS[k]).toMatch(/^gltf:critter_/);
    }
  });

  it('CRITTER_POOL_SIZE and CRITTER_SCALE are positive finite numbers', () => {
    expect(CRITTER_POOL_SIZE).toBeGreaterThan(0);
    expect(Number.isFinite(CRITTER_POOL_SIZE)).toBe(true);
    expect(CRITTER_SCALE).toBeGreaterThan(0);
  });
});

describe('pickIdleClip', () => {
  it('returns null for an empty clips array', () => {
    expect(pickIdleClip([])).toBeNull();
  });

  it('prefers a clip whose name contains "idle" (case-insensitive)', () => {
    const a = makeClip('Walk');
    const b = makeClip('Idle');
    const c = makeClip('Run');
    expect(pickIdleClip([a, b, c])).toBe(b);
  });

  it('falls back to the first clip when no "idle" match exists', () => {
    const a = makeClip('Walk');
    const b = makeClip('Run');
    expect(pickIdleClip([a, b])).toBe(a);
  });

  it('matches "IDLE" uppercase via case-insensitive test', () => {
    const a = makeClip('Walk');
    const b = makeClip('IDLE_LOOP');
    expect(pickIdleClip([a, b])).toBe(b);
  });
});

describe('makeCritterPools', () => {
  it('returns empty slots + mixers for every kind', () => {
    const p = makeCritterPools();
    for (const k of CRITTER_KINDS) {
      expect(p.slots[k]).toEqual([]);
      expect(p.mixers[k]).toEqual([]);
    }
  });

  it('returns fresh instances on each call (not shared)', () => {
    const a = makeCritterPools();
    const b = makeCritterPools();
    expect(a.slots).not.toBe(b.slots);
    expect(a.mixers).not.toBe(b.mixers);
  });
});

describe('populateCritterKind', () => {
  function fixture() {
    const scene = new THREE.Group();
    const child = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    scene.add(child);
    const clips = [makeClip('Idle', 2)];
    const pools = makeCritterPools();
    const parent = new THREE.Group();
    return { scene, clips, pools, parent };
  }

  it('populates the pool with CRITTER_POOL_SIZE clones', () => {
    const { scene, clips, pools, parent } = fixture();
    populateCritterKind('cow', scene, clips, pools, parent);
    expect(pools.slots.cow).toHaveLength(CRITTER_POOL_SIZE);
    expect(pools.mixers.cow).toHaveLength(CRITTER_POOL_SIZE);
  });

  it('scales every clone to CRITTER_SCALE', () => {
    const { scene, clips, pools, parent } = fixture();
    populateCritterKind('horse', scene, clips, pools, parent);
    for (const c of pools.slots.horse) {
      expect(c.scale.x).toBeCloseTo(CRITTER_SCALE, 6);
      expect(c.scale.y).toBeCloseTo(CRITTER_SCALE, 6);
      expect(c.scale.z).toBeCloseTo(CRITTER_SCALE, 6);
    }
  });

  it('parks clones far below the world floor (y = -9999)', () => {
    const { scene, clips, pools, parent } = fixture();
    populateCritterKind('llama', scene, clips, pools, parent);
    for (const c of pools.slots.llama) {
      expect(c.position.y).toBe(-9999);
    }
  });

  it('adds clones to the parent group', () => {
    const { scene, clips, pools, parent } = fixture();
    populateCritterKind('pig', scene, clips, pools, parent);
    expect(parent.children).toHaveLength(CRITTER_POOL_SIZE);
    for (const c of pools.slots.pig) {
      expect(parent.children).toContain(c);
    }
  });

  it('is idempotent — second call is a no-op', () => {
    const { scene, clips, pools, parent } = fixture();
    populateCritterKind('cow', scene, clips, pools, parent);
    populateCritterKind('cow', scene, clips, pools, parent);
    expect(pools.slots.cow).toHaveLength(CRITTER_POOL_SIZE);
    expect(parent.children).toHaveLength(CRITTER_POOL_SIZE);
  });

  it('throws when no clip is available (hard-fail, no silent degradation)', () => {
    const { scene, pools, parent } = fixture();
    expect(() => populateCritterKind('cow', scene, [], pools, parent)).toThrow(
      /no idle animation clip/,
    );
  });

  it('seeds each slot with a different mixer time (no lockstep breathing)', () => {
    const { scene, clips, pools, parent } = fixture();
    populateCritterKind('cow', scene, clips, pools, parent);
    const times = pools.mixers.cow.map((m) => m.time);
    const unique = new Set(times);
    // At least 2 unique values for a pool size > 1 (0.37 × i mod duration).
    if (CRITTER_POOL_SIZE > 1) {
      expect(unique.size).toBeGreaterThan(1);
    }
  });
});

describe('seedMixerPhase', () => {
  function makeFixture() {
    const obj = new THREE.Object3D();
    const mixer = new THREE.AnimationMixer(obj);
    const clips = [makeClip('Idle', 2)];
    return { obj, mixer, clips };
  }

  it('sets mixer.time to (idlePhase mod clip.duration)', () => {
    const { obj, mixer, clips } = makeFixture();
    seedMixerPhase(obj, mixer, clips, 0, 0.75);
    expect(mixer.time).toBeCloseTo(0.75, 6);
  });

  it('wraps idlePhase that exceeds the clip duration', () => {
    const { obj, mixer, clips } = makeFixture();
    // Clip duration is 2, idlePhase 2.3 should wrap to 0.3.
    seedMixerPhase(obj, mixer, clips, 0, 2.3);
    expect(mixer.time).toBeCloseTo(0.3, 5);
  });

  it('no-ops on repeated calls for the same entryIdx', () => {
    const { obj, mixer, clips } = makeFixture();
    seedMixerPhase(obj, mixer, clips, 0, 0.5);
    // Manually move the mixer to simulate frame advance
    mixer.setTime(1.4);
    seedMixerPhase(obj, mixer, clips, 0, 0.5);
    expect(mixer.time).toBeCloseTo(1.4, 6);
  });

  it('re-seeds when entryIdx changes', () => {
    const { obj, mixer, clips } = makeFixture();
    seedMixerPhase(obj, mixer, clips, 0, 0.2);
    mixer.setTime(1.9);
    seedMixerPhase(obj, mixer, clips, 1, 0.7);
    expect(mixer.time).toBeCloseTo(0.7, 6);
  });

  it('is a no-op when no clip is available', () => {
    const { obj, mixer } = makeFixture();
    mixer.setTime(0.5);
    seedMixerPhase(obj, mixer, [], 0, 0.1);
    expect(mixer.time).toBeCloseTo(0.5, 6);
  });
});
