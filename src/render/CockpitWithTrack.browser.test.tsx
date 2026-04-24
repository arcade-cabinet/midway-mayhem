/**
 * Composition gate: Cockpit + Track in one scene. This is the "player's
 * actual view" — you're inside the clown car, looking past the windshield
 * at the big-top track receding into the circus arena.
 *
 * Downstream of BOTH the single-archetype gate AND the composed-track gate
 * AND the cockpit-alone gate. If this looks right, the game's visual
 * identity is locked in and we can land input + progression on top of it.
 */
import { Canvas, useThree } from '@react-three/fiber';
import { render, waitFor } from '@testing-library/react';
import { commands } from 'vitest/browser';
import { createWorld } from 'koota';
import { WorldProvider } from 'koota/react';
import { useEffect } from 'react';
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { seedTrack } from '@/ecs/systems/track';
import { Cockpit } from '@/render/cockpit/Cockpit';
import { BigTopEnvironment } from '@/render/Environment';
import { Track } from '@/render/Track';

interface Handle {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
}

declare global {
  interface Window {
    __mmFullTest?: Handle | undefined;
  }
}

function Capture() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    window.__mmFullTest = { gl, scene, camera };
    return () => {
      if (window.__mmFullTest?.gl === gl) window.__mmFullTest = undefined;
    };
  }, [gl, scene, camera]);
  return null;
}

async function waitFrames(n: number) {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

describe('Cockpit + Track composition', () => {
  it('full player POV: seed 7, desktop form factor', async () => {
    const world = createWorld();
    seedTrack(world, 7);

    render(
      <WorldProvider world={world}>
        <div data-testid="full-scene" style={{ width: 1280, height: 720, position: 'relative' }}>
          <Canvas
            dpr={1}
            gl={{ antialias: false, preserveDrawingBuffer: true }}
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <Capture />
            <color attach="background" args={['#0b0f1a']} />
            <ambientLight intensity={0.5} color="#ffd6a8" />
            <directionalLight position={[6, 12, 4]} intensity={1.4} color="#fff1db" />
            <BigTopEnvironment skipHdri />
            <Track />
            <Cockpit tier="desktop" />
          </Canvas>
        </div>
      </WorldProvider>,
    );

    await waitFor(() => expect(window.__mmFullTest).toBeTruthy());
    await waitFrames(8);

    const h = window.__mmFullTest!;
    h.gl.render(h.scene, h.camera);
    const dataUrl = h.gl.domElement.toDataURL('image/png');
    const result = await commands.writePngFromDataUrl(
      dataUrl,
      '.test-screenshots/full/player-pov.png',
    );
    expect(result.bytes).toBeGreaterThan(10_000);
    expect(h.gl.info.render.triangles).toBeGreaterThan(1000);
  });
});
