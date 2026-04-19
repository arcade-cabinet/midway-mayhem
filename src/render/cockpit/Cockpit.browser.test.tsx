/**
 * Cockpit visual gate. Mounts the cockpit against each form factor tier so
 * every scale / hood offset combination gets a baseline screenshot that
 * human reviewers can eyeball.
 *
 * The cockpit provides its own camera (PerspectiveCamera makeDefault), so
 * this test builds a bare Canvas rather than using the generic Scene
 * harness (which installs a camera of its own).
 */
import { Canvas, useThree } from '@react-three/fiber';
import { render, waitFor } from '@testing-library/react';
import { createWorld } from 'koota';
import { WorldProvider } from 'koota/react';
import { useEffect } from 'react';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — vitest v4 re-export chain loses static types; runtime is fine
import { commands } from 'vitest/browser';
import { spawnPlayer } from '@/ecs/systems/playerMotion';
import { Cockpit } from './Cockpit';
import type { FormTier } from './useFormFactor';

interface Handle {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
}

declare global {
  interface Window {
    __mmCockpitTest?: Handle | undefined;
  }
}

function Capture() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    window.__mmCockpitTest = { gl, scene, camera };
    return () => {
      if (window.__mmCockpitTest?.gl === gl) window.__mmCockpitTest = undefined;
    };
  }, [gl, scene, camera]);
  return null;
}

const TIERS: FormTier[] = ['phone-portrait', 'phone-landscape', 'tablet-portrait', 'desktop'];

async function waitFrames(n: number) {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

describe('Cockpit — responsive visual gate', () => {
  for (const tier of TIERS) {
    it(`renders cockpit at ${tier}`, async () => {
      const world = createWorld();
      spawnPlayer(world);
      render(
        <WorldProvider world={world}>
          <div
            data-testid="cockpit-scene"
            style={{ width: 1280, height: 720, position: 'relative' }}
          >
            <Canvas
              dpr={1}
              gl={{ antialias: false, preserveDrawingBuffer: true }}
              style={{ width: '100%', height: '100%', display: 'block' }}
            >
              <Capture />
              <color attach="background" args={['#0b0f1a']} />
              <ambientLight intensity={0.55} color="#ffd6a8" />
              <directionalLight position={[6, 10, 4]} intensity={1.2} color="#fff1db" />
              <Cockpit tier={tier} />
            </Canvas>
          </div>
        </WorldProvider>,
      );

      await waitFor(() => expect(window.__mmCockpitTest).toBeTruthy());
      await waitFrames(6);

      const h = window.__mmCockpitTest!;
      h.gl.render(h.scene, h.camera);
      expect(h.gl.info.render.triangles).toBeGreaterThan(200);
      const canvas = h.gl.domElement;
      expect(canvas.width).toBeGreaterThanOrEqual(1280);
      const dataUrl = canvas.toDataURL('image/png');
      const result = await commands.writePngFromDataUrl(
        dataUrl,
        `.test-screenshots/cockpit/${tier}.png`,
      );
      expect(result.bytes).toBeGreaterThan(5_000);

      // ── Scene-graph invariants (catch the POC-era hood-swallow bug) ──
      // Rule #2 from project memory: hood must sit strictly forward of
      // the camera near-plane + clearance. The camera is a child of the
      // cockpit group; hood too. We assert world-space invariants so a
      // future refactor that repositions either mesh still passes only
      // if the outcome is still correct.
      const cam = h.camera;
      const hood = findByName(h.scene, 'hood');
      expect(hood, 'hood mesh exists').toBeDefined();
      const hoodBounds = worldBounds(hood!);
      const camWorld = new THREE.Vector3();
      cam.getWorldPosition(camWorld);
      const forwardGap = camWorld.z - hoodBounds.maxZ; // camera at +z, hood at -z; gap must be ≥ 0.3m
      expect(
        forwardGap,
        `hood must be ≥0.3m forward of camera (got ${forwardGap.toFixed(3)}m on ${tier})`,
      ).toBeGreaterThanOrEqual(0.3);
      // Hood must not span the cabin horizontally — max lateral half-extent ≤ 1.1m
      // (pillar inner face is at x=±1.1; hood wider than that clips).
      const hoodHalfWidth = Math.max(Math.abs(hoodBounds.minX), Math.abs(hoodBounds.maxX));
      expect(
        hoodHalfWidth,
        `hood half-width must stay ≤1.1m to clear A-pillars (got ${hoodHalfWidth.toFixed(3)}m on ${tier})`,
      ).toBeLessThanOrEqual(1.1);

      // NDC ray-grid invariant: the hood must not block the upper half of
      // the viewport. The bottom half is allowed (cockpit look), upper is
      // where the track sits.
      const cockpitGroup = findByName(h.scene, 'cockpit');
      expect(cockpitGroup, 'cockpit group exists').toBeDefined();
      const isHoodHit = (hit: THREE.Intersection) => {
        let p: THREE.Object3D | null = hit.object;
        while (p) {
          if (p.name === 'hood') return true;
          p = p.parent;
        }
        return false;
      };
      const upperHits: Array<[number, number]> = [];
      for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) {
        for (const y of [0.2, 0.5, 0.8]) {
          const rc = new THREE.Raycaster();
          rc.setFromCamera({ x, y } as THREE.Vector2, cam);
          rc.near = 0.1;
          rc.far = 100;
          if (rc.intersectObject(cockpitGroup!, true).some(isHoodHit)) {
            upperHits.push([x, y]);
          }
        }
      }
      expect(
        upperHits,
        `hood must not occupy upper-half viewport on ${tier}, hit NDC ${JSON.stringify(upperHits)}`,
      ).toHaveLength(0);
    });
  }
});

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

function findByName(root: THREE.Object3D, name: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!found && o.name === name) found = o;
  });
  return found;
}

function worldBounds(o: THREE.Object3D): Bounds {
  // Walk leaf meshes, project their local AABB corners to world-space, and
  // union everything. Avoids relying on Box3.setFromObject which doesn't
  // always honor grand-parent transforms on still-loading scenes.
  const bounds: Bounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
  };
  o.updateMatrixWorld(true);
  o.traverse((child) => {
    // biome-ignore lint/suspicious/noExplicitAny: duck-typed three mesh
    const mesh = child as any;
    if (!mesh.isMesh || !mesh.geometry) return;
    mesh.geometry.computeBoundingBox?.();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return;
    // Sample the 8 corners in local space and transform to world.
    const corners = [
      [bb.min.x, bb.min.y, bb.min.z],
      [bb.min.x, bb.min.y, bb.max.z],
      [bb.min.x, bb.max.y, bb.min.z],
      [bb.min.x, bb.max.y, bb.max.z],
      [bb.max.x, bb.min.y, bb.min.z],
      [bb.max.x, bb.min.y, bb.max.z],
      [bb.max.x, bb.max.y, bb.min.z],
      [bb.max.x, bb.max.y, bb.max.z],
    ];
    for (const [lx, ly, lz] of corners) {
      // biome-ignore lint/suspicious/noExplicitAny: minimal test-local vec
      const v = { x: lx, y: ly, z: lz } as any;
      const m = mesh.matrixWorld.elements;
      const wx = m[0] * v.x + m[4] * v.y + m[8] * v.z + m[12];
      const wy = m[1] * v.x + m[5] * v.y + m[9] * v.z + m[13];
      const wz = m[2] * v.x + m[6] * v.y + m[10] * v.z + m[14];
      if (wx < bounds.minX) bounds.minX = wx;
      if (wx > bounds.maxX) bounds.maxX = wx;
      if (wy < bounds.minY) bounds.minY = wy;
      if (wy > bounds.maxY) bounds.maxY = wy;
      if (wz < bounds.minZ) bounds.minZ = wz;
      if (wz > bounds.maxZ) bounds.maxZ = wz;
    }
  });
  return bounds;
}
