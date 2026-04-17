import { PerspectiveCamera } from '@react-three/drei';
import { useResponsiveFov } from '../hooks/useResponsiveFov';

/**
 * Camera lives INSIDE the Cockpit group. When the car banks, the camera
 * banks with it — no more "sail glitch" from Gemini iteration.
 */
export function CockpitCamera() {
  const fov = useResponsiveFov(92);
  return (
    <PerspectiveCamera
      makeDefault
      fov={fov}
      near={0.05}
      far={1500}
      position={[0, 1.0, 1.9]}
    />
  );
}
