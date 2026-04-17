/**
 * Shared R3F test harness for browser tests.
 *
 * Mirrors the marmalade-drops BrowserScene pattern: a real <Canvas> at a
 * known size with a configurable camera, so isolated-component tests can
 * assert both scene-graph structure AND on-screen projection.
 *
 * Usage:
 *   render(
 *     <BrowserScene cameraPosition={[0, 1.2, 0.6]} lookAt={[0, 1, -1]}>
 *       <Cockpit />
 *     </BrowserScene>
 *   );
 */
import { Canvas, type Frameloop, useThree } from '@react-three/fiber';
import { type ReactNode, useLayoutEffect } from 'react';
import * as THREE from 'three';

interface CameraRigProps {
  lookAt: [number, number, number];
}

function CameraRig({ lookAt }: CameraRigProps) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    camera.lookAt(...lookAt);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [camera, lookAt]);
  return null;
}

interface BrowserSceneProps {
  children: ReactNode;
  cameraPosition?: [number, number, number];
  lookAt?: [number, number, number];
  size?: { width: number; height: number };
  shadows?: boolean;
  antialias?: boolean;
  frameloop?: Frameloop;
}

export function BrowserScene({
  children,
  cameraPosition = [0, 1.2, 0.6],
  lookAt = [0, 1, -1],
  size = { width: 960, height: 720 },
  shadows = false,
  antialias = false,
  frameloop = 'always',
}: BrowserSceneProps) {
  return (
    <div
      data-testid="scene-harness"
      style={{ width: size.width, height: size.height, position: 'relative' }}
    >
      <Canvas
        dpr={1}
        shadows={shadows}
        frameloop={frameloop}
        camera={{ position: cameraPosition, fov: 75, near: 0.1, far: 1000 }}
        gl={{ antialias, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <CameraRig lookAt={lookAt} />
        <color attach="background" args={['#0b0f1a']} />
        <ambientLight intensity={1.2} color="#ffd6a8" />
        <directionalLight position={[2, 4, 3]} intensity={1.8} color="#fff1db" />
        <group>{children}</group>
      </Canvas>
    </div>
  );
}

export async function waitFrames(count = 2): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

export function makeTestCamera(
  position: [number, number, number] = [0, 1.2, 0.6],
): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(75, 4 / 3, 0.1, 1000);
  camera.position.set(...position);
  return camera;
}
