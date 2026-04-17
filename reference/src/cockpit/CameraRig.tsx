import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '@/game/gameState';
import { useShake } from '@/hooks/useShake';
import { sampleTrack } from '@/track/trackGenerator';

export function CameraRig() {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const shake = useRef(useShake()).current;

  useFrame((_, dt) => {
    const s = useGameStore.getState();
    const sample = sampleTrack(s.distance);
    const aheadSample = sampleTrack(s.distance + 18);

    const lat = Math.max(-10, Math.min(10, s.lateral));
    // Camera sits behind the car (+Z is behind since track goes into -Z)
    const basePos = new THREE.Vector3(
      sample.x + sample.normal.x * lat,
      sample.y + 5.8,
      sample.z + sample.normal.z * lat + 7.5,
    );
    const lookAt = new THREE.Vector3(
      aheadSample.x + aheadSample.normal.x * lat * 0.6,
      aheadSample.y + 3.5,
      aheadSample.z,
    );
    targetPos.current.lerp(basePos, Math.min(1, dt * 8));
    targetLook.current.lerp(lookAt, Math.min(1, dt * 6));

    // speed-based bob + shake
    const speedNorm = Math.min(1, s.speedMps / 120);
    shake.setAmp('speed', 0.015 * speedNorm);
    shake.setAmp('bob', 0.02 + speedNorm * 0.03);
    const sh = shake.sample(performance.now() * 0.001, dt);

    camera.position.copy(targetPos.current);
    camera.position.y += sh.y;
    camera.position.x += sh.x;
    camera.lookAt(targetLook.current);
  });

  return null;
}

export function triggerCameraShake(_amp = 0.5) {
  // placeholder external API; wire via module-level shake if needed later
}
