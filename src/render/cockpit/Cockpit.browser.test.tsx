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
import type * as THREE from 'three';
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
    });
  }
});
