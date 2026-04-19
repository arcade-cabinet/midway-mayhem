/**
 * Cockpit headlights — two SpotLights mounted at the hood's front corners,
 * pointed slightly downward and forward so they paint cones of light on
 * the track ahead. Identity-critical per project memory ("headlight
 * spotlights piercing the fog").
 *
 * SpotLight .target is a live Object3D reference, not a position prop.
 * Drei won't accept `target={ref.current}` because the ref is null on
 * first render. Using a small inline component that wires the target
 * imperatively via useEffect once both refs are populated.
 *
 * Spots are siblings of the body-feel group children, so the parent's
 * roll/yaw carries the lights — headlights bank into turns for free.
 */
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';

const LIGHT_Y = 0.3;
const LIGHT_X = 0.55;
const LIGHT_Z = -0.6;
const TARGET_Z = -30;
const TARGET_Y_DROP = 12;

const INTENSITY = 3.0;
const DISTANCE = 120;
const ANGLE = Math.PI / 7;
const PENUMBRA = 0.45;
const DECAY = 1.4;
const COLOR = '#fff1db';

function HeadlightPair({ side }: { side: -1 | 1 }) {
  const lightRef = useRef<THREE.SpotLight | null>(null);
  const targetRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    const light = lightRef.current;
    const target = targetRef.current;
    if (!light || !target) return;
    light.target = target;
    light.target.updateMatrixWorld();
  }, []);

  return (
    <>
      <spotLight
        ref={lightRef}
        position={[side * LIGHT_X, LIGHT_Y, LIGHT_Z]}
        angle={ANGLE}
        penumbra={PENUMBRA}
        intensity={INTENSITY}
        color={COLOR}
        distance={DISTANCE}
        decay={DECAY}
        castShadow={false}
      />
      <object3D
        ref={targetRef}
        position={[side * LIGHT_X * 0.4, LIGHT_Y - TARGET_Y_DROP, TARGET_Z]}
      />
    </>
  );
}

export function Headlights() {
  return (
    <>
      <HeadlightPair side={-1} />
      <HeadlightPair side={1} />
    </>
  );
}
