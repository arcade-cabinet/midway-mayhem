/**
 * Shared R3F test scene. Tests mount <Scene> with whatever children they
 * want; we give a known viewport, a known camera, and a deterministic
 * directional light setup so screenshot assertions are stable.
 *
 * SceneCapture exposes gl+scene+camera on window.__mmTest so screenshot
 * tests can force a synchronous render (gl.render(scene, camera)) right
 * before canvas.toDataURL() — otherwise the browser may compose/clear
 * the WebGL drawing buffer between the last rAF tick and the capture,
 * yielding a blank PNG.
 */
import { Canvas, type Frameloop, useThree } from '@react-three/fiber';
import { type ReactNode, useLayoutEffect } from 'react';
import type * as THREE from 'three';

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

interface TestGlHandle {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
}
declare global {
  interface Window {
    __mmTest?: TestGlHandle | undefined;
  }
}
function SceneCapture() {
  const { gl, scene, camera } = useThree();
  useLayoutEffect(() => {
    window.__mmTest = { gl, scene, camera };
    return () => {
      if (window.__mmTest?.gl === gl) {
        window.__mmTest = undefined;
      }
    };
  }, [gl, scene, camera]);
  return null;
}

export function renderAndCapture(): string {
  const h = window.__mmTest;
  if (!h) throw new Error('renderAndCapture: SceneCapture not mounted');
  h.gl.render(h.scene, h.camera);
  const canvas = h.gl.domElement;
  return canvas.toDataURL('image/png');
}

interface SceneProps {
  children: ReactNode;
  cameraPosition?: [number, number, number];
  lookAt?: [number, number, number];
  size?: { width: number; height: number };
  frameloop?: Frameloop;
}

export function Scene({
  children,
  cameraPosition = [0, 2, 5],
  lookAt = [0, 0, 0],
  size = { width: 960, height: 720 },
  frameloop = 'always',
}: SceneProps) {
  return (
    <div
      data-testid="scene"
      style={{ width: size.width, height: size.height, position: 'relative' }}
    >
      <Canvas
        dpr={1}
        frameloop={frameloop}
        camera={{ position: cameraPosition, fov: 60, near: 0.1, far: 1000 }}
        gl={{ antialias: false, preserveDrawingBuffer: true }}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <CameraRig lookAt={lookAt} />
        <SceneCapture />
        <color attach="background" args={['#0b0f1a']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[4, 6, 3]} intensity={1.2} />
        {children}
      </Canvas>
    </div>
  );
}

/** Wait N animation frames so useFrame hooks have fired. */
export async function waitFrames(count = 2): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}
