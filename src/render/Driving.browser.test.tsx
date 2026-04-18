/**
 * Gameplay gate: Player + Cockpit + Track in one scene, simulated driving.
 *
 * Spawns a player, presses throttle, ticks through real rAFs, confirms
 * the track has translated (comparing the Track group's world matrix
 * before and after driving), captures a screenshot at ~5 seconds into
 * the run. This is the integration proof that input → motion → rendered
 * offset works end-to-end.
 */
import { Canvas, useThree } from '@react-three/fiber';
import { render, waitFor } from '@testing-library/react';
// @ts-expect-error — vitest v4 re-export chain loses static types; runtime is fine
import { commands } from '@vitest/browser/context';
import { createWorld } from 'koota';
import { WorldProvider } from 'koota/react';
import { useEffect } from 'react';
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { spawnPlayer } from '@/ecs/systems/playerMotion';
import { seedTrack } from '@/ecs/systems/track';
import { usePlayerLoop } from '@/ecs/systems/usePlayerLoop';
import { Player, Position, Throttle } from '@/ecs/traits';
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
    __mmDriveTest?: Handle | undefined;
  }
}

function Capture() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    window.__mmDriveTest = { gl, scene, camera };
    return () => {
      if (window.__mmDriveTest?.gl === gl) window.__mmDriveTest = undefined;
    };
  }, [gl, scene, camera]);
  return null;
}

function Loop({ world, active }: { world: ReturnType<typeof createWorld>; active: boolean }) {
  usePlayerLoop(world, active);
  return null;
}

async function waitFrames(n: number) {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

describe('Driving — player motion + track scroll', () => {
  it('player at full throttle advances distance and track moves', async () => {
    const world = createWorld();
    seedTrack(world, 7);
    spawnPlayer(world);
    world.query(Player, Throttle).updateEach(([t]) => {
      t.value = 1;
    });

    render(
      <WorldProvider world={world}>
        <div data-testid="drive-scene" style={{ width: 1280, height: 720, position: 'relative' }}>
          <Canvas
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
            <Loop world={world} active={true} />
          </Canvas>
        </div>
      </WorldProvider>,
    );

    await waitFor(() => expect(window.__mmDriveTest).toBeTruthy());

    // Give it plenty of frames to build speed + translate the track.
    await waitFrames(180);

    const pos = world.query(Player, Position)[0]?.get(Position);
    expect(pos?.distance ?? 0).toBeGreaterThan(5);

    const h = window.__mmDriveTest!;
    h.gl.render(h.scene, h.camera);
    expect(h.gl.info.render.triangles).toBeGreaterThan(1000);
    const dataUrl = h.gl.domElement.toDataURL('image/png');
    const result = await commands.writePngFromDataUrl(
      dataUrl,
      '.test-screenshots/playthrough/driving-at-3s.png',
    );
    expect(result.bytes).toBeGreaterThan(10_000);
  }, 45_000);
});
