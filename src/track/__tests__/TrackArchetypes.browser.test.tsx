/**
 * Per-archetype golden-path visual gate (PRQ A-TRACK-VIS-ARCH).
 *
 * TrackPackage.browser.test.tsx captures the full canonical run; this harness
 * captures ONE piece per archetype in isolation — so any tweak to a single
 * archetype's length, deltaYaw, deltaPitch, or bank immediately surfaces as
 * a visible delta in its own golden image. The full-run shot doesn't have
 * that locality — a bug in `hard-left` could hide inside the coil.
 *
 * Per-archetype captures are all rendered from a fixed 3/4 "axonometric"
 * viewpoint that shows the piece's horizontal + vertical extent at once.
 * Baselines live at src/track/__baselines__/archetypes/<id>.png; diff'd
 * by trackArchetypeBaseline.test.ts on the node side.
 */
import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { render, waitFor } from '@testing-library/react';
import { commands } from '@vitest/browser/context';
import { createWorld } from 'koota';
import { WorldProvider } from 'koota/react';
import { useLayoutEffect } from 'react';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { trackArchetypes } from '@/config';
import { LaneCount, TrackSegment } from '@/ecs/traits';
import { Track } from '@/render/Track';
import { waitFrames } from '@/test/scene';

const VIEWPORT = { width: 640, height: 360 };

/** Build a world containing exactly one track segment for the archetype. */
function worldWithSingleArchetype(archetypeId: string) {
  const world = createWorld();
  const arch = trackArchetypes.archetypes.find((a) => a.id === archetypeId);
  if (!arch) throw new Error(`unknown archetype '${archetypeId}'`);
  world.spawn(
    TrackSegment({
      index: 0,
      archetype: archetypeId,
      distanceStart: 0,
      length: arch.length,
      deltaYaw: arch.deltaYaw,
      deltaPitch: arch.deltaPitch,
      bank: arch.bank,
      startBank: 0,
      startX: 0,
      startY: 0,
      startZ: 0,
      startYaw: 0,
      startPitch: 0,
    }),
    LaneCount({ value: trackArchetypes.lanes }),
  );
  return world;
}

const VIEWS = [
  { kind: 'axon', suffix: '' }, // default axonometric 3/4
  { kind: 'side', suffix: '-side' }, // orthographic side-on: pitch is vertical drop
] as const;

describe('per-archetype isolated render — golden-path baselines', () => {
  for (const arch of trackArchetypes.archetypes) {
    for (const view of VIEWS) {
      it(`captures ${arch.id}${view.suffix}`, async () => {
        const world = worldWithSingleArchetype(arch.id);
        const { container } = render(
          <WorldProvider world={world}>
            {view.kind === 'axon' ? <AxonView /> : <SideView />}
          </WorldProvider>,
        );
        const canvas = await waitFor(
          () => {
            const el = container.querySelector('canvas');
            if (!el) throw new Error('canvas not rendered');
            return el;
          },
          { timeout: 10_000 },
        );
        await waitFrames(20);
        const dataUrl = canvas.toDataURL('image/png');
        const result = await commands.writePngFromDataUrl(
          dataUrl,
          `.test-screenshots/archetypes/${arch.id}${view.suffix}.png`,
        );
        expect(
          result.bytes,
          `${arch.id}${view.suffix}: PNG must contain real geometry (got ${result.bytes}B)`,
        ).toBeGreaterThan(2_500);
      }, 60_000);
    }
  }
});

/**
 * Axonometric 3/4 camera — positioned above-and-to-the-side so both the
 * horizontal bend (yaw/bank) and the vertical delta (pitch/y) are legible
 * in the same frame. Looks at the piece's midpoint.
 */
function AxonView() {
  return (
    <div style={{ width: VIEWPORT.width, height: VIEWPORT.height, position: 'relative' }}>
      <Canvas
        dpr={1}
        frameloop="always"
        gl={{ antialias: false, preserveDrawingBuffer: true }}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#121218']} />
        <ambientLight intensity={0.55} color="#ffe6c0" />
        <directionalLight position={[20, 40, 15]} intensity={1.2} color="#fff1db" />
        <PerspectiveCamera makeDefault position={[10, 5, 8]} fov={50} near={0.1} far={200} />
        <CameraLookAt target={[0, -1, -12]} />
        <Track />
      </Canvas>
    </div>
  );
}

/**
 * Orthographic side elevation — looks +X across the track ribbon. Pitch +
 * y-drop are 1:1 vertical pixels; length is 1:1 horizontal. Banking +
 * yaw don't show here, which is the point — pitch is isolated.
 */
function SideView() {
  const halfH = 12;
  const aspect = VIEWPORT.width / VIEWPORT.height;
  const halfW = halfH * aspect;
  return (
    <div style={{ width: VIEWPORT.width, height: VIEWPORT.height, position: 'relative' }}>
      <Canvas
        dpr={1}
        frameloop="always"
        gl={{ antialias: false, preserveDrawingBuffer: true }}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#121218']} />
        <ambientLight intensity={0.7} color="#ffe6c0" />
        <directionalLight position={[40, 80, 20]} intensity={1.0} color="#fff1db" />
        <OrthographicCamera
          makeDefault
          position={[60, 0, -12]}
          zoom={1}
          left={-halfW}
          right={halfW}
          top={halfH}
          bottom={-halfH}
          near={0.1}
          far={500}
        />
        <CameraLookAt target={[0, 0, -12]} />
        <Track />
      </Canvas>
    </div>
  );
}

function CameraLookAt({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.lookAt(new THREE.Vector3(...target));
    camera.updateMatrixWorld();
  }, [camera, target]);
  return null;
}
