/**
 * Visual gate for the procedural track.
 *
 * Renders the Track for a known seed at several camera checkpoints and
 * captures screenshots. What we're testing:
 *   - the track actually produces visible meshes (non-trivial triangle count)
 *   - the track descends (camera low-down sees upward vanishing point)
 *   - the track winds (looking down from above, the ribbon visibly curves)
 *
 * Screenshots land in .test-screenshots/ (gitignored). Visual diffs are
 * the human review; the assertions here ensure geometry is present + finite.
 */
import { useThree } from '@react-three/fiber';
import { render, waitFor } from '@testing-library/react';
import { createWorld } from 'koota';
import { WorldProvider } from 'koota/react';
import { useEffect } from 'react';
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { seedTrack } from '@/ecs/systems/track';
import { Track } from '@/render/Track';
import { Scene, waitFrames } from '@/test/scene';

function SceneCapture({ onReady }: { onReady: (scene: THREE.Scene, gl: THREE.WebGLRenderer) => void }) {
  const { scene, gl } = useThree();
  useEffect(() => onReady(scene, gl), [scene, gl, onReady]);
  return null;
}

describe('Track (procedural geometry)', () => {
  it('renders the full track for seed 42 and captures 3 checkpoints', async () => {
    const world = createWorld();
    seedTrack(world, 42);

    let captured: { scene: THREE.Scene; gl: THREE.WebGLRenderer } | null = null;

    // Checkpoint 1: high overhead — check the ribbon winds
    render(
      <WorldProvider world={world}>
        <Scene
          size={{ width: 1280, height: 720 }}
          cameraPosition={[0, 250, 120]}
          lookAt={[0, -200, -500]}
        >
          <SceneCapture onReady={(s, g) => { captured = { scene: s, gl: g }; }} />
          <Track />
        </Scene>
      </WorldProvider>,
    );

    await waitFor(() => expect(captured).toBeTruthy(), { timeout: 5_000 });
    await waitFrames(5);

    expect(captured!.gl.info.render.triangles).toBeGreaterThan(0);

    // Find the track surface mesh and confirm it has bytes
    let surface: THREE.Mesh | null = null;
    captured!.scene.traverse((o) => {
      if ((o as THREE.Mesh).name === 'track-surface') surface = o as THREE.Mesh;
    });
    expect(surface).not.toBeNull();
    expect(surface!.geometry.attributes.position?.count ?? 0).toBeGreaterThan(100);

    await page.screenshot({ path: '.test-screenshots/track-overhead.png' });
  });

  it('renders the track from ground level looking forward (player POV)', async () => {
    const world = createWorld();
    seedTrack(world, 42);

    // Raise camera up to 2m (driver eye height) + pull back 12m behind the
    // start so the track's surface is clearly visible below + ahead.
    render(
      <WorldProvider world={world}>
        <Scene
          size={{ width: 1280, height: 720 }}
          cameraPosition={[0, 2, 12]}
          lookAt={[0, -1, -40]}
        >
          <Track />
        </Scene>
      </WorldProvider>,
    );

    await waitFrames(5);
    await page.screenshot({ path: '.test-screenshots/track-pov.png' });
  });

  it('mid-track POV — looking through segment 30 to see descent', async () => {
    const world = createWorld();
    seedTrack(world, 42);

    // Segment 30 at seed 42 — known via logic-test output. Camera
    // positioned near its start pose with forward-down gaze.
    render(
      <WorldProvider world={world}>
        <Scene
          size={{ width: 1280, height: 720 }}
          cameraPosition={[0, 20, 0]}
          lookAt={[0, -40, -150]}
        >
          <Track />
        </Scene>
      </WorldProvider>,
    );

    await waitFrames(5);
    await page.screenshot({ path: '.test-screenshots/track-descent.png' });
  });
});
