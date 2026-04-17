/**
 * zoneGimmicks.browser.test.tsx
 *
 * Real geometry/behavior checks for zone gimmick layers.
 * Mounts each component inside a Canvas, captures the scene via
 * SceneCapture (useThree → useEffect → callback), then traverses
 * the scene graph to verify actual geometry.
 */

import { Canvas, useThree } from '@react-three/fiber';
import { act, render, waitFor } from '@testing-library/react';
import { Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetGameState, useGameStore } from '@/game/gameState';
import { BalloonLayer } from '@/obstacles/BalloonLayer';
import { BarkerCrowd } from '@/obstacles/BarkerCrowd';
import { FireHoopGate } from '@/obstacles/FireHoopGate';
import { MirrorLayer } from '@/obstacles/MirrorLayer';

// ---------------------------------------------------------------------------

function SceneCapture({ onCapture }: { onCapture: (scene: THREE.Scene) => void }) {
  const { scene } = useThree();
  useEffect(() => {
    onCapture(scene);
  }, [scene, onCapture]);
  return null;
}

function findMeshes(scene: THREE.Scene, predicate: (m: THREE.Mesh) => boolean): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  scene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && predicate(obj as THREE.Mesh)) {
      result.push(obj as THREE.Mesh);
    }
  });
  return result;
}

// ---------------------------------------------------------------------------

describe('Zone gimmick shape tests', () => {
  beforeEach(() => {
    resetGameState();
    // biome-ignore lint/suspicious/noExplicitAny: test cleanup
    (window as any).__mmBalloonSpawner = undefined;
    // biome-ignore lint/suspicious/noExplicitAny: test cleanup
    (window as any).__mmMirrorDuplicator = undefined;
    // biome-ignore lint/suspicious/noExplicitAny: test cleanup
    (window as any).__mmFireHoops = undefined;
  });

  afterEach(() => {
    resetGameState();
    // biome-ignore lint/suspicious/noExplicitAny: test cleanup
    (window as any).__mmBalloonSpawner = undefined;
    // biome-ignore lint/suspicious/noExplicitAny: test cleanup
    (window as any).__mmMirrorDuplicator = undefined;
  });

  // -------------------------------------------------------------------------
  // BalloonLayer: pool builds 32 SphereGeometry meshes
  // -------------------------------------------------------------------------
  it('BalloonLayer: SphereGeometry pool has >= 32 balloon meshes', async () => {
    useGameStore.setState({
      running: false,
      dropProgress: 1,
      currentZone: 'balloon-alley',
      distance: 0,
    });

    let capturedScene: THREE.Scene | null = null;

    const TestScene = () => (
      <Canvas gl={{ antialias: false }}>
        <SceneCapture
          onCapture={(s) => {
            capturedScene = s;
          }}
        />
        <Suspense fallback={null}>
          <BalloonLayer />
        </Suspense>
      </Canvas>
    );

    const { unmount } = render(<TestScene />);

    await waitFor(() => expect(capturedScene).toBeTruthy(), { timeout: 10_000 });

    // Wait for pool-building useFrame to fire
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
    });

    const scene = capturedScene!;

    const sphereMeshes = findMeshes(scene, (m) => {
      if (!(m.geometry instanceof THREE.SphereGeometry)) return false;
      const params = (m.geometry as THREE.SphereGeometry).parameters;
      return Math.abs(params.radius - 0.6) < 0.05;
    });

    // Pool size = MAX_BALLOONS = 32
    expect(sphereMeshes.length).toBeGreaterThanOrEqual(32);

    unmount();
  });

  // -------------------------------------------------------------------------
  // FireHoopGate: TorusGeometry with radius > 2 + emissive material
  // -------------------------------------------------------------------------
  it('FireHoopGate: TorusGeometry radius>2 with emissive MeshStandardMaterial', async () => {
    useGameStore.setState({
      running: true,
      dropProgress: 1,
      currentZone: 'ring-of-fire',
      distance: 900,
    });

    let capturedScene: THREE.Scene | null = null;

    const TestScene = () => (
      <Canvas gl={{ antialias: false }}>
        <SceneCapture
          onCapture={(s) => {
            capturedScene = s;
          }}
        />
        <Suspense fallback={null}>
          <FireHoopGate />
        </Suspense>
      </Canvas>
    );

    const { unmount } = render(<TestScene />);

    await waitFor(() => expect(capturedScene).toBeTruthy(), { timeout: 10_000 });

    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
    });

    const scene = capturedScene!;

    // TORUS_GEO = TorusGeometry(3.2, 0.3, 16, 48)
    const torusMeshes = findMeshes(scene, (m) => {
      if (!(m.geometry instanceof THREE.TorusGeometry)) return false;
      const params = (m.geometry as THREE.TorusGeometry).parameters;
      return params.radius > 2.0;
    });

    expect(torusMeshes.length).toBeGreaterThanOrEqual(1);

    for (const m of torusMeshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      expect(mat.emissiveIntensity).toBeGreaterThan(0);
    }

    unmount();
  });

  // -------------------------------------------------------------------------
  // MirrorLayer: outside funhouse zone → zero slot count
  // -------------------------------------------------------------------------
  it('MirrorLayer: no visible copies outside funhouse-frenzy zone', async () => {
    useGameStore.setState({
      running: true,
      dropProgress: 1,
      currentZone: 'balloon-alley',
      distance: 0,
    });

    let capturedScene: THREE.Scene | null = null;

    const TestScene = () => (
      <Canvas gl={{ antialias: false }}>
        <SceneCapture
          onCapture={(s) => {
            capturedScene = s;
          }}
        />
        <Suspense fallback={null}>
          <MirrorLayer />
        </Suspense>
      </Canvas>
    );

    const { unmount } = render(<TestScene />);

    await waitFor(() => expect(capturedScene).toBeTruthy(), { timeout: 10_000 });

    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
    });

    // biome-ignore lint/suspicious/noExplicitAny: diagnostics
    expect((window as any).__mmDiag_mirrors ?? 0).toBe(0);

    unmount();
  });

  // -------------------------------------------------------------------------
  // MirrorLayer: in funhouse but no duplicator → all slots at -9999
  // -------------------------------------------------------------------------
  it('MirrorLayer: all mesh slots at y=-9999 when no duplicator in funhouse zone', async () => {
    useGameStore.setState({
      running: true,
      dropProgress: 1,
      currentZone: 'funhouse-frenzy',
      distance: 1350,
    });

    let capturedScene: THREE.Scene | null = null;

    const TestScene = () => (
      <Canvas gl={{ antialias: false }}>
        <SceneCapture
          onCapture={(s) => {
            capturedScene = s;
          }}
        />
        <Suspense fallback={null}>
          <MirrorLayer />
        </Suspense>
      </Canvas>
    );

    const { unmount } = render(<TestScene />);

    await waitFor(() => expect(capturedScene).toBeTruthy(), { timeout: 10_000 });

    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
    });

    const scene = capturedScene!;

    // Mirror slots are BoxGeometry width=1.2
    const mirrorMeshes = findMeshes(scene, (m) => {
      return (
        m.geometry instanceof THREE.BoxGeometry &&
        Math.abs((m.geometry as THREE.BoxGeometry).parameters.width - 1.2) < 0.05
      );
    });

    // Without a duplicator, all slots stay at -9999
    for (const m of mirrorMeshes) {
      expect(m.position.y).toBeLessThan(-100);
    }

    unmount();
  });

  // -------------------------------------------------------------------------
  // BarkerCrowd: >= 6 primitive meshes built in the pool
  // -------------------------------------------------------------------------
  it('BarkerCrowd: >= 6 primitive meshes in pool (body/head/arm/legs per barker)', async () => {
    useGameStore.setState({
      running: true,
      dropProgress: 1,
      currentZone: 'midway-strip',
      distance: 0,
    });

    let capturedScene: THREE.Scene | null = null;

    const TestScene = () => (
      <Canvas gl={{ antialias: false }}>
        <SceneCapture
          onCapture={(s) => {
            capturedScene = s;
          }}
        />
        <Suspense fallback={null}>
          <BarkerCrowd />
        </Suspense>
      </Canvas>
    );

    const { unmount } = render(<TestScene />);

    await waitFor(() => expect(capturedScene).toBeTruthy(), { timeout: 10_000 });

    // BarkerCrowd builds pool on first useFrame tick
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    });

    const scene = capturedScene!;

    const barkerMeshes = findMeshes(scene, (m) => {
      return m.geometry instanceof THREE.BoxGeometry || m.geometry instanceof THREE.SphereGeometry;
    });

    // Each barker has: body (Box), head (Sphere), arm (Box), legL (Box), legR (Box) = 5 meshes
    // With ~36 barkers from d=10..900 step 25 → ~180 meshes total, but we need >= 6
    expect(barkerMeshes.length).toBeGreaterThanOrEqual(6);

    unmount();
  });

  // -------------------------------------------------------------------------
  // BarkerCrowd: groups at -9999 when outside midway-strip zone
  // -------------------------------------------------------------------------
  it('BarkerCrowd: barker groups at y=-9999 when not in midway-strip zone', async () => {
    useGameStore.setState({
      running: true,
      dropProgress: 1,
      currentZone: 'balloon-alley',
      distance: 500,
    });

    let capturedScene: THREE.Scene | null = null;

    const TestScene = () => (
      <Canvas gl={{ antialias: false }}>
        <SceneCapture
          onCapture={(s) => {
            capturedScene = s;
          }}
        />
        <Suspense fallback={null}>
          <BarkerCrowd />
        </Suspense>
      </Canvas>
    );

    const { unmount } = render(<TestScene />);

    await waitFor(() => expect(capturedScene).toBeTruthy(), { timeout: 10_000 });

    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    });

    const scene = capturedScene!;

    // Find all anonymous groups that have both a Box and Sphere child (barker groups)
    const parkedGroups: THREE.Group[] = [];
    scene.traverse((obj) => {
      if (!(obj as THREE.Group).isGroup) return;
      const g = obj as THREE.Group;
      const hasBox = g.children.some(
        (c) => (c as THREE.Mesh).isMesh && (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry,
      );
      const hasSphere = g.children.some(
        (c) =>
          (c as THREE.Mesh).isMesh && (c as THREE.Mesh).geometry instanceof THREE.SphereGeometry,
      );
      if (hasBox && hasSphere) parkedGroups.push(g);
    });

    // All barker groups should be parked at -9999 when not in midway zone
    expect(parkedGroups.length).toBeGreaterThan(0);
    for (const g of parkedGroups) {
      expect(g.position.y).toBeLessThan(-100);
    }

    unmount();
  });
});
