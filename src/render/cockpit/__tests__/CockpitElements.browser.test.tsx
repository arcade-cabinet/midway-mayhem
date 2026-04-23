/**
 * Per-cockpit-element golden-path battery.
 *
 * Cockpit.browser.test.tsx captures the FULL cockpit composite per form
 * factor. Pixel diffs at that scale can mask an individual element
 * regressing (e.g., steering wheel floats without its column, A-pillars
 * don't reach the arch) under the 1.5% tolerance.
 *
 * This harness renders each element GROUP in isolation with a camera
 * framed on that group. Any per-mesh drift surfaces as a localized
 * baseline diff. Companion to blueprintIntegrity.test.ts (which proves
 * the DATA is structurally correct) — these captures prove the RENDER
 * is structurally correct.
 */
import { PerspectiveCamera } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { render, waitFor } from '@testing-library/react';
import { commands } from '@vitest/browser/context';
import { useLayoutEffect } from 'react';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cockpitBlueprint } from '@/config';
import { waitFrames } from '@/test/scene';
import { CockpitMeshNode } from '../blueprintMesh';

const VIEWPORT = { width: 400, height: 400 };

interface ElementView {
  id: string;
  label: string;
  /** Mesh keys from the blueprint to render for this element. */
  meshKeys: string[];
  /** Camera position (world-space) framing the element. */
  cameraPos: [number, number, number];
  /** Look-at target (center of the element in world space). */
  target: [number, number, number];
}

const ELEMENTS: ElementView[] = [
  {
    id: 'steering-column',
    label: 'steering wheel + hub + column + horn + spokes',
    meshKeys: [
      'wheelRim',
      'wheelHub',
      'wheelSpoke0',
      'wheelSpoke1',
      'wheelSpoke2',
      'wheelSpoke3',
      'hornCap',
      'hornRing',
      'steeringColumn',
    ],
    cameraPos: [0.9, 1.05, 0.8],
    target: [0, 1.0, -0.15],
  },
  {
    id: 'pillars-arch',
    label: 'A-pillars meeting windshield arch',
    meshKeys: ['pillarLeft', 'pillarRight', 'windshieldArch'],
    cameraPos: [2.0, 1.8, 1.2],
    target: [0, 1.55, -0.3],
  },
  {
    id: 'dashboard',
    label: 'dashCowl + gauges',
    meshKeys: [
      'dashCowl',
      'gaugeFace_LAUGHS',
      'gaugeBezel_LAUGHS',
      'gaugeNeedle_LAUGHS',
      'gaugeFace_FUN',
      'gaugeBezel_FUN',
      'gaugeNeedle_FUN',
    ],
    cameraPos: [0.4, 1.45, 0.4],
    target: [0, 1.12, -0.28],
  },
  {
    id: 'hood-flower',
    label: 'polka-dot hood + 8-petal flower ornament',
    meshKeys: [
      'hood',
      'flowerCenter',
      'flowerStem',
      'flowerPetal0',
      'flowerPetal1',
      'flowerPetal2',
      'flowerPetal3',
      'flowerPetal4',
      'flowerPetal5',
      'flowerPetal6',
      'flowerPetal7',
    ],
    cameraPos: [0.9, 1.3, 0.5],
    target: [0, 0.6, -1.5],
  },
  {
    id: 'mirror-dice',
    label: 'rearview mirror + fuzzy dice on strings',
    meshKeys: [
      'mirrorFrame',
      'mirrorGlass',
      'mirrorStem',
      'diceStringRed',
      'diceStringBlue',
      'diceRed',
      'diceBlue',
    ],
    cameraPos: [1.2, 2.0, 0.8],
    target: [0.15, 1.95, -0.28],
  },
  {
    id: 'seat',
    label: 'red bench seat (base + back + piping)',
    meshKeys: ['seatBase', 'seatBack', 'seatPiping'],
    cameraPos: [1.2, 1.5, 3.0],
    target: [0, 1.0, 1.6],
  },
];

describe('cockpit per-element isolation — golden-path baselines', () => {
  for (const el of ELEMENTS) {
    it(`captures ${el.id} (${el.label})`, async () => {
      const { container } = render(<ElementScene element={el} />);
      const canvas = await waitFor(
        () => {
          const c = container.querySelector('canvas');
          if (!c) throw new Error('canvas not rendered');
          return c;
        },
        { timeout: 10_000 },
      );
      await waitFrames(20);
      const dataUrl = canvas.toDataURL('image/png');
      const result = await commands.writePngFromDataUrl(
        dataUrl,
        `.test-screenshots/cockpit-elements/${el.id}.png`,
      );
      expect(
        result.bytes,
        `${el.id}: PNG must contain real geometry (got ${result.bytes}B)`,
      ).toBeGreaterThan(2_500);
    }, 60_000);
  }
});

function ElementScene({ element }: { element: ElementView }) {
  return (
    <div style={{ width: VIEWPORT.width, height: VIEWPORT.height, position: 'relative' }}>
      <Canvas
        dpr={1}
        frameloop="always"
        gl={{ antialias: false, preserveDrawingBuffer: true }}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#121218']} />
        <ambientLight intensity={0.6} color="#ffe6c0" />
        <directionalLight position={[3, 5, 2]} intensity={1.1} color="#fff1db" />
        <PerspectiveCamera makeDefault position={element.cameraPos} fov={50} near={0.01} far={50} />
        <CameraLookAt target={element.target} />
        {element.meshKeys.map((key) => {
          const mesh = (cockpitBlueprint.meshes as Record<string, unknown>)[key];
          if (!mesh) {
            throw new Error(`cockpit-element ${element.id}: mesh '${key}' missing from blueprint`);
          }
          const materialRef = (mesh as { materialRef?: string }).materialRef;
          if (!materialRef) {
            throw new Error(`cockpit-element ${element.id}: mesh '${key}' has no materialRef`);
          }
          const material = (cockpitBlueprint.materials as Record<string, unknown>)[materialRef];
          if (!material) {
            throw new Error(
              `cockpit-element ${element.id}: mesh '${key}' references unknown material '${materialRef}'`,
            );
          }
          return (
            <CockpitMeshNode
              key={key}
              name={key}
              // biome-ignore lint/suspicious/noExplicitAny: blueprint JSON is typed at the import site, not here
              mesh={mesh as any}
              // biome-ignore lint/suspicious/noExplicitAny: same reasoning
              material={material as any}
            />
          );
        })}
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
