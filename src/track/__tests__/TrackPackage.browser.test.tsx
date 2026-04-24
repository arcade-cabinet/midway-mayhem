/**
 * Track-only visual gate. The integrated visual-matrix capture (App +
 * Cockpit + Audience + HUD) is great for catching regressions in the
 * shipped player view but lousy for diagnosing track-geometry changes
 * because cockpit pose + camera reaction also move when the track does.
 *
 * This harness mounts JUST the procedural track in isolation under
 * three fixed cameras and dumps the renders. Reviewing the side-view
 * PNG lets you read off the run's elevation profile at a glance —
 * which is the gate for the descent vision (PRQ A-DESC-1).
 *
 * Three captures, deterministic on the canonical seed:
 *   - .test-screenshots/track-package/side.png — orthographic +X
 *   - .test-screenshots/track-package/plan.png — orthographic -Y
 *   - .test-screenshots/track-package/pov.png  — perspective at d=0
 *
 * Pinned baselines under src/track/__baselines__/track-package/ are
 * diffed by trackPackageBaseline.test.ts (node-side).
 */
import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { render, waitFor } from '@testing-library/react';
import { createWorld } from 'koota';
import { WorldProvider } from 'koota/react';
import { useLayoutEffect } from 'react';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { generateTrack, seedTrack } from '@/ecs/systems/track';
import { Track } from '@/render/Track';
import { waitFrames } from '@/test/scene';

// Canonical seed used by the visual-matrix suite. Same phrase →
// `phraseToSeed('lightning-kerosene-ferris')` is encoded as 42 here
// because the track generator takes the numeric seed; the phrase only
// drives the runtime RNG, not the track shape.
const TRACK_SEED = 42;
const VIEWPORT = { width: 1280, height: 720 };

interface BBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/** Compute the world-space bounding box of the generated track so we
 *  can size the orthographic frustums to fit the whole run with a
 *  margin. */
function computeTrackBBox(seed: number): BBox {
  const segs = generateTrack(seed);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of segs) {
    for (const p of [s.startPose, s.endPose]) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

interface CapView {
  name: 'side' | 'plan' | 'pov';
  /** Render the configured Canvas + cameras + Track into the testing-library container. */
  render: () => ReturnType<typeof renderInWorld>;
}

function renderInWorld(content: React.ReactNode) {
  const world = createWorld();
  seedTrack(world, TRACK_SEED);
  return render(<WorldProvider world={world}>{content}</WorldProvider>);
}

describe('Track package — isolated procedural-track visual gate', () => {
  for (const view of buildViews()) {
    it(`captures ${view.name} render of the canonical track`, async () => {
      const { container } = view.render();

      const canvas = await waitFor(
        () => {
          const el = container.querySelector('canvas');
          if (!el) throw new Error('canvas not rendered');
          return el;
        },
        { timeout: 10_000 },
      );
      // Allow the geometry useMemo + initial render to settle.
      await waitFrames(20);

      // Force a render before reading pixels — preserveDrawingBuffer
      // is on but a separate present can still race the read.
      const dataUrl = canvas.toDataURL('image/png');
      const result = await commands.writePngFromDataUrl(
        dataUrl,
        `.test-screenshots/track-package/${view.name}.png`,
      );
      expect(
        result.bytes,
        `${view.name} PNG must contain real geometry (got ${result.bytes}B)`,
      ).toBeGreaterThan(20_000);
    }, 60_000);
  }
});

// ─── Camera + Canvas setup ────────────────────────────────────────────────────

function buildViews(): CapView[] {
  const bbox = computeTrackBBox(TRACK_SEED);
  // Center of the track footprint.
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const cz = (bbox.minZ + bbox.maxZ) / 2;
  const spanX = bbox.maxX - bbox.minX;
  const spanY = bbox.maxY - bbox.minY;
  const spanZ = bbox.maxZ - bbox.minZ;

  // spanY is read by the SideView orthographic frustum sizing later if
  // we ever need a vertical zoom-fit; declared here to surface the value
  // alongside spanX/spanZ for symmetry.
  void spanY;
  return [
    {
      name: 'side',
      render: () => renderInWorld(<SideView bbox={bbox} cx={cx} cy={cy} cz={cz} spanZ={spanZ} />),
    },
    {
      name: 'plan',
      render: () =>
        renderInWorld(<PlanView bbox={bbox} cx={cx} cz={cz} spanX={spanX} spanZ={spanZ} />),
    },
    {
      name: 'pov',
      render: () => renderInWorld(<PovView />),
    },
  ];
}

interface SideViewProps {
  bbox: BBox;
  cx: number;
  cy: number;
  cz: number;
  spanZ: number;
}

function SideView({ cx, cy, cz, spanZ }: SideViewProps) {
  // Orthographic camera positioned far to the +X side of the track,
  // looking back toward -X across the whole track ribbon. The Z axis
  // becomes screen-horizontal; Y descent is obvious as vertical drop.
  const halfH = Math.max(spanZ, 60) * 0.6 + 20;
  const aspect = VIEWPORT.width / VIEWPORT.height;
  const halfW = halfH * aspect;
  return (
    <SceneCanvas>
      <OrthographicCamera
        makeDefault
        position={[cx + 200, cy, cz]}
        zoom={1}
        left={-halfW}
        right={halfW}
        top={halfH}
        bottom={-halfH}
        near={0.1}
        far={5000}
      />
      <CameraLookAt target={[cx, cy, cz]} />
      <Track />
    </SceneCanvas>
  );
}

interface PlanViewProps {
  bbox: BBox;
  cx: number;
  cz: number;
  spanX: number;
  spanZ: number;
}

function PlanView({ cx, cz, spanX, spanZ }: PlanViewProps) {
  // Top-down orthographic — shows the spiral footprint.
  const halfH = Math.max(spanX, spanZ) * 0.6 + 20;
  const aspect = VIEWPORT.width / VIEWPORT.height;
  const halfW = halfH * aspect;
  return (
    <SceneCanvas>
      <OrthographicCamera
        makeDefault
        position={[cx, 500, cz]}
        zoom={1}
        left={-halfW}
        right={halfW}
        top={halfH}
        bottom={-halfH}
        near={0.1}
        far={2000}
      />
      <CameraLookAt target={[cx, 0, cz]} />
      <Track />
    </SceneCanvas>
  );
}

function PovView() {
  // Perspective camera at d=0 looking down the track's initial heading
  // (forward = -Z under yaw=0). No cockpit — just a clean view of the
  // first piece extending into the distance.
  return (
    <SceneCanvas>
      <PerspectiveCamera makeDefault position={[0, 1.5, 1.5]} fov={75} near={0.1} far={2000} />
      <Track />
    </SceneCanvas>
  );
}

/** Imperative `camera.lookAt(target)` runs once on mount. drei's
 *  OrthographicCamera doesn't expose a `lookAt` prop, so we do it
 *  through useThree after the makeDefault camera registers. */
function CameraLookAt({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.lookAt(new THREE.Vector3(...target));
    camera.updateMatrixWorld();
  }, [camera, target]);
  return null;
}

function SceneCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: VIEWPORT.width, height: VIEWPORT.height, position: 'relative' }}>
      <Canvas
        dpr={1}
        frameloop="always"
        gl={{ antialias: false, preserveDrawingBuffer: true }}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#1a1a24']} />
        <ambientLight intensity={0.55} color="#ffe6c0" />
        <directionalLight position={[40, 80, 30]} intensity={1.2} color="#fff1db" />
        {children}
      </Canvas>
    </div>
  );
}
