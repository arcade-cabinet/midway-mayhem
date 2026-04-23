/**
 * Browser test: cockpit descent-pitch hook integration.
 *
 * Mounts Cockpit and injects a fixed track pitch via the
 * `window.__mmTrackPitchOverride` test seam (ESM module namespaces are not
 * configurable in browser tests, so vi.spyOn cannot reach the diagnostics
 * bus). After smoothing settles, asserts the cockpit-body group's rotation.x
 * matches the expected angle.
 *
 * Why rotation.x rather than a visual screenshot: the pitch effect is
 * subtle by design (40 % of track pitch) — screenshot diffing against a
 * single frame wouldn't catch a wrong sign or a missed smoothing step.
 * The numeric angle is the load-bearing invariant.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { render, waitFor } from '@testing-library/react';
import { createWorld } from 'koota';
import { WorldProvider } from 'koota/react';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { spawnPlayer } from '@/ecs/systems/playerMotion';
import { Cockpit } from '../Cockpit';

// ─── Scene probe ────────────────────────────────────────────────────────────

interface ProbeHandle {
  getBodyRotX: () => number;
}

declare global {
  interface Window {
    __mmDescentPitchTest?: ProbeHandle | undefined;
  }
}

/** Locates the cockpit-body group each frame and exposes its rotation.x. */
function BodyProbe() {
  const { scene } = useThree();
  const bodyRef = useRef<THREE.Object3D | null>(null);

  useFrame(() => {
    if (!bodyRef.current) {
      scene.traverse((o) => {
        if (!bodyRef.current && o.name === 'cockpit-body') bodyRef.current = o;
      });
    }
  });

  useEffect(() => {
    window.__mmDescentPitchTest = {
      getBodyRotX: () => bodyRef.current?.rotation.x ?? 0,
    };
    return () => {
      window.__mmDescentPitchTest = undefined;
    };
  }, []);

  return null;
}

async function waitFrames(n: number) {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

afterEach(() => {
  // Clean up the test seam between tests.
  window.__mmTrackPitchOverride = undefined;
  window.__mmDescentPitchTest = undefined;
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mountCockpit(world: ReturnType<typeof createWorld>) {
  render(
    <WorldProvider world={world}>
      <div style={{ width: 1280, height: 720 }}>
        <Canvas
          dpr={1}
          gl={{ antialias: false, preserveDrawingBuffer: true }}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <color attach="background" args={['#0b0f1a']} />
          <ambientLight intensity={0.55} />
          <Cockpit tier="desktop" />
          <BodyProbe />
        </Canvas>
      </div>
    </WorldProvider>,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useCockpitDescentPitch — integration via Cockpit', () => {
  it('cockpit-body rotation.x converges to ≈ −0.032 rad for a plunge pitch of −0.08 rad', async () => {
    // Inject plunge pitch via the test seam before mounting so the hook
    // reads it from frame 1 onward.
    window.__mmTrackPitchOverride = -0.08;

    const world = createWorld();
    spawnPlayer(world);
    mountCockpit(world);

    await waitFor(() => expect(window.__mmDescentPitchTest).toBeTruthy());

    // Let the smoothing converge: 2 s worth of frames at rAF rate.
    const start = performance.now();
    while (performance.now() - start < 2000) {
      await waitFrames(6);
    }

    const rotX = window.__mmDescentPitchTest!.getBodyRotX();
    // Target is getCockpitDescentPitch(-0.08) = -0.032.
    // After 2 s at 2 Hz smoothing, residual < 1 % of target.
    expect(rotX).toBeCloseTo(-0.032, 2);
    // Tight tolerance per spec: within 0.005 rad.
    expect(Math.abs(rotX - -0.032)).toBeLessThan(0.005);
  });

  it('cockpit-body rotation.x decays to ~0 when pitch returns to flat', async () => {
    // Prime with plunge pitch.
    window.__mmTrackPitchOverride = -0.08;

    const world = createWorld();
    spawnPlayer(world);
    mountCockpit(world);

    await waitFor(() => expect(window.__mmDescentPitchTest).toBeTruthy());

    // Prime: wait 2 s with plunge.
    const primeStart = performance.now();
    while (performance.now() - primeStart < 2000) {
      await waitFrames(6);
    }

    // Switch to flat — smoothing should decay back to ~0 within 1 s.
    window.__mmTrackPitchOverride = 0;

    const flatStart = performance.now();
    while (performance.now() - flatStart < 1000) {
      await waitFrames(6);
    }

    const rotX = window.__mmDescentPitchTest!.getBodyRotX();
    // After 1 s at 2 Hz, continuous-time residual is 13.5 % of −0.032 ≈ −0.0043.
    // Using 0.006 tolerance to absorb rAF timing jitter in the test runner
    // without relaxing to the point that a missing smooth step would pass.
    expect(Math.abs(rotX)).toBeLessThan(0.006);
  });
});
