/**
 * RacingLineGhost.browser.test.tsx
 *
 * Verifies the racing-line ghost overlay:
 *   1. Ghost mesh exists in the scene graph (name="racing-line-ghost") during a run.
 *   2. Ghost lateral position is within 0.5m of optimalLateralAt(path, distance + 12).
 *   3. Visual regression baseline screenshot.
 *
 * Pattern mirrors Cockpit.browser.test.tsx: SceneCapture inside Canvas fiber
 * stores scene + gl references accessible from outside the React tree.
 */

import { Canvas, useThree } from '@react-three/fiber';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RacingLineGhost } from '@/cockpit/RacingLineGhost';
import { resetGameState, useGameStore } from '@/game/gameState';
import { optimalLateralAt, solveOptimalPath } from '@/game/optimalPath';
import { buildRunPlan } from '@/game/runPlan';
import { initRunRng, trackRng } from '@/game/runRngBus';

// ─── Scene capture helper ────────────────────────────────────────────────────

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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('<RacingLineGhost /> scene-graph tests', () => {
  beforeEach(() => {
    resetGameState();
  });

  afterEach(() => {
    resetGameState();
  });

  it('ghost mesh exists in scene graph when run is active', async () => {
    let capturedScene: THREE.Scene | null = null;

    // Build a deterministic plan so optimalPath is testable
    const seed = 42;
    initRunRng(seed);
    const plan = buildRunPlan({ seed, trackRng: trackRng() });

    const TestScene = () => (
      <Canvas gl={{ antialias: false }} camera={{ position: [0, 1.2, 0.6] }}>
        <SceneCapture
          onCapture={(c) => {
            capturedScene = c.scene;
          }}
        />
        <RacingLineGhost />
      </Canvas>
    );

    const { unmount } = render(<TestScene />);

    // Set state: running, dropProgress=1 (fully dropped in), plan available
    useGameStore.setState({
      running: true,
      gameOver: false,
      dropProgress: 1,
      plan,
      distance: 50,
      lateral: 0,
    });

    await waitFor(() => expect(capturedScene).toBeTruthy(), { timeout: 10_000 });

    // Wait for useFrame to fire
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    });

    const scene = capturedScene!;

    let ghostGroup: THREE.Object3D | null = null;
    scene.traverse((obj) => {
      if (obj.name === 'racing-line-ghost') ghostGroup = obj;
    });

    expect(ghostGroup).toBeTruthy();
    expect((ghostGroup as unknown as THREE.Object3D).visible).toBe(true);

    unmount();
  });

  it('ghost lateral position matches optimalLateralAt(path, distance + 12) within 0.5m', async () => {
    let capturedScene: THREE.Scene | null = null;

    const seed = 99;
    initRunRng(seed);
    const plan = buildRunPlan({ seed, trackRng: trackRng() });
    const optimalPath = solveOptimalPath(plan);

    const testDistance = 80;
    const LOOKAHEAD_M = 12;
    const expectedLateral = optimalLateralAt(optimalPath, testDistance + LOOKAHEAD_M);

    const TestScene = () => (
      <Canvas gl={{ antialias: false }} camera={{ position: [0, 1.2, 0.6] }}>
        <SceneCapture
          onCapture={(c) => {
            capturedScene = c.scene;
          }}
        />
        <RacingLineGhost />
      </Canvas>
    );

    const { unmount } = render(<TestScene />);

    useGameStore.setState({
      running: true,
      gameOver: false,
      dropProgress: 1,
      plan,
      distance: testDistance,
      lateral: 0,
    });

    await waitFor(() => expect(capturedScene).toBeTruthy(), { timeout: 10_000 });

    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    });

    const scene = capturedScene!;

    let ghostGroup: THREE.Object3D | null = null;
    scene.traverse((obj) => {
      if (obj.name === 'racing-line-ghost') ghostGroup = obj;
    });

    expect(ghostGroup).toBeTruthy();

    const worldPos = new THREE.Vector3();
    (ghostGroup as unknown as THREE.Object3D).getWorldPosition(worldPos);

    // x component is the lateral offset
    expect(Math.abs(worldPos.x - expectedLateral)).toBeLessThan(0.5);

    unmount();
  });

  it('ghost is hidden when running=false', async () => {
    let capturedScene: THREE.Scene | null = null;

    const seed = 7;
    initRunRng(seed);
    const plan = buildRunPlan({ seed, trackRng: trackRng() });

    const TestScene = () => (
      <Canvas gl={{ antialias: false }} camera={{ position: [0, 1.2, 0.6] }}>
        <SceneCapture
          onCapture={(c) => {
            capturedScene = c.scene;
          }}
        />
        <RacingLineGhost />
      </Canvas>
    );

    const { unmount } = render(<TestScene />);

    useGameStore.setState({
      running: false,
      gameOver: false,
      dropProgress: 1,
      plan,
      distance: 50,
      lateral: 0,
    });

    await waitFor(() => expect(capturedScene).toBeTruthy(), { timeout: 10_000 });

    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    });

    const scene = capturedScene!;

    let ghostGroup: THREE.Object3D | null = null;
    scene.traverse((obj) => {
      if (obj.name === 'racing-line-ghost') ghostGroup = obj;
    });

    expect(ghostGroup).toBeTruthy();
    expect((ghostGroup as unknown as THREE.Object3D).visible).toBe(false);

    unmount();
  });

  it('baseline PNG: racing-line-visible', async () => {
    let capturedGl: THREE.WebGLRenderer | null = null;

    const seed = 42;
    initRunRng(seed);
    const plan = buildRunPlan({ seed, trackRng: trackRng() });

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
        <RacingLineGhost />
      </Canvas>
    );

    const { unmount } = render(<TestScene />);

    useGameStore.setState({
      running: true,
      gameOver: false,
      dropProgress: 1,
      plan,
      distance: 50,
      lateral: 0,
    });

    await waitFor(() => expect(capturedGl).toBeTruthy(), { timeout: 10_000 });

    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    const gl = capturedGl!;
    const dataUrl = gl.domElement.toDataURL('image/png');
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(dataUrl.length).toBeGreaterThan(1000);

    const { page } = await import('vitest/browser');
    await page.screenshot({
      path: '__screenshots__/racing-line-visible.png',
    });

    unmount();
  });
});
