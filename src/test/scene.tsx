/**
 * Shared R3F test scene. Tests mount <Scene> with whatever children they
 * want; we give a known viewport, a known camera, and a deterministic
 * directional light setup so screenshot assertions are stable.
 */
import { Canvas, type Frameloop, useThree } from '@react-three/fiber';
import { type ReactNode, useLayoutEffect } from 'react';

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
