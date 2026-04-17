/**
 * hoodClipping.browser.test.tsx
 *
 * Guards against the hood-swallows-camera bug from the POC prototype.
 * The hood must NOT intrude into the camera near plane (near = 0.1).
 *
 * Tests:
 *   1. Hood bounding box closest point to camera > 0.5m (clear of near=0.1).
 *   2. Hood world-space z is strictly negative (ahead of camera at origin).
 */

import { Canvas, useThree } from '@react-three/fiber';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Cockpit } from '@/cockpit/Cockpit';
import { resetGameState, useGameStore } from '@/game/gameState';

const CAMERA_POS = new THREE.Vector3(0, 1.45, 0.9);

interface SceneRef {
  scene: THREE.Scene;
}

function SceneCapture({ onCapture }: { onCapture: (c: SceneRef) => void }) {
  const { scene } = useThree();
  useEffect(() => {
    onCapture({ scene });
  }, [scene, onCapture]);
  return null;
}

describe('hood clipping guard', () => {
  beforeEach(() => resetGameState());
  afterEach(() => resetGameState());

  it('hood bounding box closest point > 0.5m from camera', async () => {
    let capturedScene: THREE.Scene | null = null;

    const TestScene = () => (
      <Canvas
        gl={{ antialias: false }}
        camera={{
          position: CAMERA_POS.toArray() as [number, number, number],
          fov: 75,
          near: 0.1,
          far: 1000,
        }}
      >
        <SceneCapture
          onCapture={(c) => {
            capturedScene = c.scene;
          }}
        />
        <ambientLight intensity={1} />
        <Cockpit />
      </Canvas>
    );

    const { unmount } = render(<TestScene />);
    useGameStore.setState({ dropProgress: 1 });

    await waitFor(() => expect(capturedScene).toBeTruthy(), { timeout: 10_000 });
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    });

    const scene = capturedScene!;

    // Find the hood: largest-radius SphereGeometry at negative z
    let hoodMesh: THREE.Mesh | null = null;
    let hoodRadius = 0;

    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const m = obj as THREE.Mesh;
      if (!(m.geometry instanceof THREE.SphereGeometry)) return;
      const params = (m.geometry as THREE.SphereGeometry).parameters;
      const wp = new THREE.Vector3();
      m.getWorldPosition(wp);
      if (wp.z < -0.5 && params.radius > hoodRadius) {
        hoodRadius = params.radius;
        hoodMesh = m;
      }
    });

    expect(hoodMesh).toBeTruthy();

    const box = new THREE.Box3();
    box.setFromObject(hoodMesh!);

    const closestPoint = new THREE.Vector3();
    box.clampPoint(CAMERA_POS, closestPoint);
    const distance = CAMERA_POS.distanceTo(closestPoint);

    // Must be well clear of near plane (0.1m) — we require > 0.5m
    expect(distance).toBeGreaterThan(0.5);

    unmount();
  });

  it('hood world-space z is strictly negative (in front of camera)', async () => {
    let capturedScene: THREE.Scene | null = null;

    const TestScene = () => (
      <Canvas gl={{ antialias: false }} camera={{ position: [0, 1.2, 0.6] }}>
        <SceneCapture
          onCapture={(c) => {
            capturedScene = c.scene;
          }}
        />
        <Cockpit />
      </Canvas>
    );

    const { unmount } = render(<TestScene />);
    useGameStore.setState({ dropProgress: 1 });

    await waitFor(() => expect(capturedScene).toBeTruthy(), { timeout: 10_000 });
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    });

    const scene = capturedScene!;

    let hoodMesh: THREE.Mesh | null = null;
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const m = obj as THREE.Mesh;
      if (!(m.geometry instanceof THREE.SphereGeometry)) return;
      const params = (m.geometry as THREE.SphereGeometry).parameters;
      if (params.radius > 0.5) {
        const wp = new THREE.Vector3();
        m.getWorldPosition(wp);
        if (wp.z < 0) hoodMesh = m;
      }
    });

    expect(hoodMesh).toBeTruthy();

    const wp = new THREE.Vector3();
    (hoodMesh as unknown as THREE.Mesh).getWorldPosition(wp);
    expect(wp.z).toBeLessThan(0);

    unmount();
  });
});
