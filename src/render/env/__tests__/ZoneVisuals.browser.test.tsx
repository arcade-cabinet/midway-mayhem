/**
 * Zone visual identity gate — one POV screenshot per zone.
 *
 * For each of the four zones we:
 *   1. Force `currentZone` on the game store so ZoneProps + BigTopEnvironment
 *      both see the correct theme.
 *   2. Render the scene with the track (seeded for that zone's centre distance)
 *      plus BigTopEnvironment(skipHdri, zone=...) + ZoneProps.
 *   3. Capture a 1280×720 PNG and write it to
 *      .test-screenshots/zones/zone-<id>.png for human review.
 *
 * The companion node-side diff test (zoneBaseline.test.ts) compares these
 * against pinned baselines in src/render/env/__baselines__/zones/ with a
 * 15% per-pixel tolerance.
 */
import { Canvas, useThree } from '@react-three/fiber';
import { render, waitFor } from '@testing-library/react';
import { commands } from '@vitest/browser/context';
import { createWorld } from 'koota';
import { WorldProvider } from 'koota/react';
import { useEffect } from 'react';
import type * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedTrack } from '@/ecs/systems/track';
import { useGameStore } from '@/game/gameState';
import { BigTopEnvironment } from '@/render/Environment';
import { ZoneProps } from '@/render/env/ZoneProps';
import { Track } from '@/render/Track';
import type { ZoneId } from '@/utils/constants';

// Zone centre distances (mid-point of each 450m zone)
const ZONE_CENTRES: Record<ZoneId, number> = {
  'midway-strip': 225,
  'balloon-alley': 675,
  'ring-of-fire': 1125,
  'funhouse-frenzy': 1575,
};

interface Handle {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
}

declare global {
  interface Window {
    __mmZoneTest?: Handle | undefined;
  }
}

function Capture() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    window.__mmZoneTest = { gl, scene, camera };
    return () => {
      if (window.__mmZoneTest?.gl === gl) window.__mmZoneTest = undefined;
    };
  }, [gl, scene, camera]);
  return null;
}

async function waitFrames(n: number) {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

beforeEach(() => {
  window.__mmZoneTest = undefined;
});

describe('Zone visual identity (per-zone screenshot gate)', () => {
  const zones: ZoneId[] = ['midway-strip', 'balloon-alley', 'ring-of-fire', 'funhouse-frenzy'];

  for (const zoneId of zones) {
    it(`zone ${zoneId} has a distinct visual identity`, async () => {
      const world = createWorld();
      // Seed track with a predictable value so geometry is deterministic
      seedTrack(world, 42);

      // Force the game store to the correct zone and advance to that distance
      useGameStore.setState({
        currentZone: zoneId,
        distance: ZONE_CENTRES[zoneId],
      });

      render(
        <WorldProvider world={world}>
          <div
            data-testid={`zone-scene-${zoneId}`}
            style={{ width: 1280, height: 720, position: 'relative' }}
          >
            <Canvas
              dpr={1}
              gl={{ antialias: false, preserveDrawingBuffer: true }}
              style={{ width: '100%', height: '100%', display: 'block' }}
            >
              <Capture />
              <color attach="background" args={['#0b0f1a']} />
              {/* Zone-aware environment: HDRI skipped in tests, zone prop active */}
              <BigTopEnvironment skipHdri zone={zoneId} />
              <ZoneProps />
              <Track />
            </Canvas>
          </div>
        </WorldProvider>,
      );

      await waitFor(() => expect(window.__mmZoneTest).toBeTruthy());
      // Allow enough frames for useFrame hooks (zone light lerp + ZoneProps positions)
      await waitFrames(12);

      const h = window.__mmZoneTest!;
      h.gl.render(h.scene, h.camera);
      const dataUrl = h.gl.domElement.toDataURL('image/png');

      const result = await commands.writePngFromDataUrl(
        dataUrl,
        `.test-screenshots/zones/zone-${zoneId}.png`,
      );

      // Non-trivial output: PNG must contain real pixels
      expect(result.bytes, `zone ${zoneId}: PNG is empty`).toBeGreaterThan(15_000);
      // Must have drawn some geometry
      expect(h.gl.info.render.triangles, `zone ${zoneId}: no triangles rendered`).toBeGreaterThan(
        100,
      );
    });
  }
});
