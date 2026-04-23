/**
 * @module render/DropInIntro
 *
 * Step-6 tutorial preview: bird's-eye camera sweep that starts OUTSIDE the
 * dome at altitude, shows the full coil spiral of the descent track, then
 * pulls DOWN through the dome ceiling and into cockpit POV over ~3 seconds.
 *
 * Sequence:
 *   0.0s  Camera is high above the dome, looking straight down, track
 *         spiral visible in its entirety.
 *   1.5s  Camera has crossed the dome rim and is descending on the Z-axis
 *         toward the start platform.
 *   3.0s  Camera reaches the cockpit position and hands control back to
 *         the regular PerspectiveCamera inside <Cockpit>.
 *
 * Implementation:
 *   - Uses a separate <PerspectiveCamera makeDefault> that is swapped away
 *     once the animation completes.
 *   - `useFrame` advances `tRef` each tick; when t >= 1 the component calls
 *     `onComplete` and stops rendering the override camera.
 *   - Progress is eased with smoothstep so the final snap feels natural.
 *
 * The component renders only when `active` is true, so the parent can
 * mount/unmount it cleanly around the tutorial step-6 window.
 */
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

/** Total duration of the drop-in intro sweep in seconds. */
export const DROP_INTRO_DURATION_S = 3.0;

/** Camera start position — above the dome looking down. */
const START_POSITION = new THREE.Vector3(0, 60, 0);
/** Camera target at the end — cockpit eye point (matches cockpit-blueprint). */
const END_POSITION = new THREE.Vector3(0, 4.5, 2.5);

/** Camera start look-at — the center of the spiral track below. */
const START_LOOKAT = new THREE.Vector3(0, 0, -10);
/** Camera end look-at — straight ahead down the track. */
const END_LOOKAT = new THREE.Vector3(0, 4.0, -30);

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

interface DropInIntroCameraProps {
  /** Called when the camera animation has completed (t >= 1). */
  onComplete: () => void;
}

/**
 * Internal camera-override component. Mounted inside the R3F Canvas.
 * When `onComplete` fires the parent should unmount this component so
 * the default <Cockpit> camera resumes control.
 */
export function DropInIntroCamera({ onComplete }: DropInIntroCameraProps) {
  const tRef = useRef(0);
  const completedRef = useRef(false);
  const { camera } = useThree();

  const camRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame((_state, delta) => {
    if (completedRef.current) return;

    tRef.current = Math.min(1, tRef.current + delta / DROP_INTRO_DURATION_S);
    const ease = smoothstep(tRef.current);

    if (camRef.current) {
      // Interpolate position
      camRef.current.position.lerpVectors(START_POSITION, END_POSITION, ease);

      // Interpolate look-at
      const lookAt = new THREE.Vector3().lerpVectors(START_LOOKAT, END_LOOKAT, ease);
      camRef.current.lookAt(lookAt);

      // Vary FOV: wide overhead → normal cockpit FOV
      const startFov = 90;
      const endFov = 65;
      camRef.current.fov = startFov + (endFov - startFov) * ease;
      camRef.current.updateProjectionMatrix();
    }

    if (tRef.current >= 1 && !completedRef.current) {
      completedRef.current = true;
      // Restore the previous camera's matrix so the cockpit camera picks up
      // from the right position without a pop.
      if (camRef.current) {
        camera.position.copy(camRef.current.position);
      }
      onComplete();
    }
  });

  return (
    <PerspectiveCamera
      ref={camRef}
      makeDefault
      position={START_POSITION.toArray()}
      fov={90}
      near={0.1}
      far={500}
    />
  );
}
