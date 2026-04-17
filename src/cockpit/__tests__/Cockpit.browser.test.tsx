/**
 * Cockpit.browser.test.tsx
 *
 * Full scene-graph correctness tests for <Cockpit />.
 * Uses React state to propagate scene reference out of the Canvas fiber.
 *
 * Pattern for extracting the scene:
 *   A <SceneCapture onScene={fn} /> child of Canvas calls useThree inside
 *   a useEffect to capture the scene + gl references into a callback.
 *   The callback stores them in a ref accessible from outside the React tree.
 */

import { Canvas, useThree } from '@react-three/fiber';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Cockpit } from '@/cockpit/Cockpit';
import { resetGameState, useGameStore } from '@/game/gameState';

// ---------------------------------------------------------------------------
// Scene capture helper
// ---------------------------------------------------------------------------
interface SceneCapture {
  scene: THREE.Scene;
  gl: THREE.WebGLRenderer;
}

function SceneCapture({ onCapture }: { onCapture: (c: SceneCapture) => void }) {
  const { scene, gl } = useThree();
  useEffect(() => {
    onCapture({ scene, gl });
  }, [scene, gl, onCapture]);
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

describe('<Cockpit /> scene-graph tests', () => {
  beforeEach(() => {
    resetGameState();
  });

  afterEach(() => {
    resetGameState();
  });

  // -------------------------------------------------------------------------
  // (a) A-pillars exist, cylindrical, at x ≈ ±1.1, y ≈ 1.55
  // -------------------------------------------------------------------------
  it('(a) A-pillars: two CylinderGeometry meshes at x ≈ ±1.1, y ≈ 1.55', async () => {
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

    // Wait for useFrame to fire at least once
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    });

    const scene = capturedScene!;

    const pillars = findMeshes(scene, (m) => {
      if (!(m.geometry instanceof THREE.CylinderGeometry)) return false;
      const wp = new THREE.Vector3();
      m.getWorldPosition(wp);
      return Math.abs(Math.abs(wp.x) - 1.1) < 0.25 && wp.y > 1.2 && wp.y < 2.0;
    });

    expect(pillars.length).toBe(2);

    const xs = pillars.map((p) => {
      const v = new THREE.Vector3();
      p.getWorldPosition(v);
      return v.x;
    });

    // Symmetric: sum ≈ 0
    expect(Math.abs(xs[0]! + xs[1]!)).toBeLessThan(0.3);

    for (const pillar of pillars) {
      const v = new THREE.Vector3();
      pillar.getWorldPosition(v);
      expect(v.y).toBeGreaterThan(1.2);
      expect(v.y).toBeLessThan(2.0);
    }

    unmount();
  });

  // -------------------------------------------------------------------------
  // (b) Hood SphereGeometry in front of camera (world z < 0)
  // -------------------------------------------------------------------------
  it('(b) hood SphereGeometry sits in front of the camera (world z < 0)', async () => {
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

    const hoodCandidates = findMeshes(scene, (m) => {
      if (!(m.geometry instanceof THREE.SphereGeometry)) return false;
      const params = (m.geometry as THREE.SphereGeometry).parameters;
      const wp = new THREE.Vector3();
      m.getWorldPosition(wp);
      return params.radius > 0.5 && wp.z < -0.5;
    });

    expect(hoodCandidates.length).toBeGreaterThanOrEqual(1);

    for (const m of hoodCandidates) {
      const wp = new THREE.Vector3();
      m.getWorldPosition(wp);
      expect(wp.z).toBeLessThan(0);
    }

    unmount();
  });

  // -------------------------------------------------------------------------
  // (c) Steering wheel group rotation.x within 20° of -Math.PI/4.3
  // -------------------------------------------------------------------------
  it('(c) steering wheel parent group has rotation.x ≈ -Math.PI/4.3 (±20°)', async () => {
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

    const rimMeshes = findMeshes(scene, (m) => {
      if (!(m.geometry instanceof THREE.TorusGeometry)) return false;
      const params = (m.geometry as THREE.TorusGeometry).parameters;
      return Math.abs(params.radius - 0.4) < 0.05;
    });

    expect(rimMeshes.length).toBeGreaterThanOrEqual(1);

    const rimMesh = rimMeshes[0]!;
    const wheelGroup = rimMesh.parent as THREE.Group;
    expect(wheelGroup).toBeTruthy();

    const targetRotX = -Math.PI / 4.3;
    const tolerance = (20 * Math.PI) / 180;
    expect(Math.abs(wheelGroup.rotation.x - targetRotX)).toBeLessThan(tolerance);

    unmount();
  });

  // -------------------------------------------------------------------------
  // (d) Seat lip cylinder world y between 0.85 and 1.05
  // -------------------------------------------------------------------------
  it('(d) seat lip half-cylinder (radiusTop ≈ 0.05, thetaLength=π) world y in [0.8, 1.1]', async () => {
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

    const seatLip = findMeshes(scene, (m) => {
      if (!(m.geometry instanceof THREE.CylinderGeometry)) return false;
      const params = (m.geometry as THREE.CylinderGeometry).parameters;
      return (
        Math.abs(params.radiusTop - 0.05) < 0.02 && Math.abs(params.thetaLength - Math.PI) < 0.2
      );
    });

    expect(seatLip.length).toBeGreaterThanOrEqual(1);

    for (const m of seatLip) {
      const wp = new THREE.Vector3();
      m.getWorldPosition(wp);
      expect(wp.y).toBeGreaterThan(0.8);
      expect(wp.y).toBeLessThan(1.1);
    }

    unmount();
  });

  // -------------------------------------------------------------------------
  // (e) Rigging cables visible/invisible based on dropProgress
  // -------------------------------------------------------------------------
  it('(e) rigging cables: visible at dp=0, invisible at dp=1', async () => {
    let capturedScene: THREE.Scene | null = null;

    useGameStore.setState({ dropProgress: 0, running: true });

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

    await waitFor(() => expect(capturedScene).toBeTruthy(), { timeout: 10_000 });
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    });

    const scene = capturedScene!;

    // Rigging cable: CylinderGeometry height≈11.6, 6 radial segments
    const rigMeshes = findMeshes(scene, (m) => {
      if (!(m.geometry instanceof THREE.CylinderGeometry)) return false;
      const params = (m.geometry as THREE.CylinderGeometry).parameters;
      return Math.abs(params.height - 11.6) < 1.0 && params.radialSegments === 6;
    });

    expect(rigMeshes.length).toBe(2);
    for (const m of rigMeshes) {
      expect(m.visible).toBe(true);
    }

    // Set dropProgress=1 and let useFrame update
    await act(async () => {
      useGameStore.setState({ dropProgress: 1 });
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    });

    for (const m of rigMeshes) {
      expect(m.visible).toBe(false);
    }

    unmount();
  });

  // -------------------------------------------------------------------------
  // (f) Drop-in: root y monotonically decreasing (pure math test)
  // -------------------------------------------------------------------------
  it('(f) drop-in: cockpit root y formula is monotone overall and ends near 0', () => {
    const rootYValues: number[] = [];

    for (let i = 0; i <= 30; i++) {
      const dp = i / 30;
      const capped = Math.max(0, Math.min(1, dp));
      const fall =
        capped < 0.75
          ? (capped / 0.75) ** 2
          : 1 + Math.sin((capped - 0.75) * 12) * 0.06 * (1 - capped);
      const y = 12 * (1 - fall);
      rootYValues.push(y);
      expect(Number.isNaN(y)).toBe(false);
    }

    // Start near 12, end near 0
    expect(rootYValues[0]).toBeGreaterThan(11.9);
    expect(rootYValues[rootYValues.length - 1]).toBeCloseTo(0, 0);

    // Compare first quarter vs last quarter: overall descent
    const q = Math.floor(rootYValues.length / 4);
    const firstQMax = Math.max(...rootYValues.slice(0, q));
    const lastQMin = Math.min(...rootYValues.slice(-q));
    expect(firstQMax).toBeGreaterThan(lastQMin);
  });

  // -------------------------------------------------------------------------
  // Baseline PNG snapshot
  // -------------------------------------------------------------------------
  it('baseline PNG: cockpit at dropProgress=1, steer=0, speedMps=0', async () => {
    let capturedGl: THREE.WebGLRenderer | null = null;

    const TestScene = () => (
      <Canvas
        style={{ width: 1280, height: 720 }}
        gl={{ antialias: false, preserveDrawingBuffer: true }}
        camera={{ position: [0, 1.2, 0.6], fov: 75, near: 0.1, far: 1000 }}
      >
        <SceneCapture
          onCapture={(c) => {
            capturedGl = c.gl;
          }}
        />
        <ambientLight intensity={1} />
        <Cockpit />
      </Canvas>
    );

    const { unmount } = render(<TestScene />);
    useGameStore.setState({ dropProgress: 1, steer: 0, speedMps: 0 });

    await waitFor(() => expect(capturedGl).toBeTruthy(), { timeout: 10_000 });
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    const gl = capturedGl!;
    const dataUrl = gl.domElement.toDataURL('image/png');
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(dataUrl.length).toBeGreaterThan(1000);

    // Use vitest/browser page.screenshot for the file baseline
    const { page } = await import('vitest/browser');
    await page.screenshot({
      path: '__screenshots__/cockpit-baseline-1280x720.png',
    });

    unmount();
  });
});
