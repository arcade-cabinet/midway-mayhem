import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '@/game/gameState';
import { sampleTrack } from '@/track/trackGenerator';
import { STEER } from '@/utils/constants';
import { makeGaugeTexture, makePolkaDotTexture } from '@/utils/proceduralTextures';

/**
 * Cockpit rendered in world space — pillars, polka-dot hood, dashboard,
 * steering wheel, chrome gauges, hood ornament, mirror with fuzzy dice.
 * Camera rides BEHIND this group; the group rotates with the track heading
 * so pillars always frame the player's forward view.
 */
export function PlayerCar() {
  const groupRef = useRef<THREE.Group>(null);
  const wheelRef = useRef<THREE.Group>(null);
  const ornamentRef = useRef<THREE.Group>(null);
  const needleLaughsRef = useRef<THREE.Mesh>(null);
  const needleFunRef = useRef<THREE.Mesh>(null);
  const diceRef = useRef<THREE.Group>(null);

  const polkaTex = useMemo(() => {
    const t = makePolkaDotTexture();
    t.repeat.set(4, 4);
    return t;
  }, []);
  const dashTex = useMemo(() => {
    const t = makePolkaDotTexture();
    t.repeat.set(3, 1);
    return t;
  }, []);
  const laughsTex = useMemo(() => makeGaugeTexture('LAUGHS'), []);
  const funTex = useMemo(() => makeGaugeTexture('FUN'), []);

  // Shared materials for body panels
  const hoodMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: polkaTex, roughness: 0.6 }),
    [polkaTex],
  );
  const dashMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: dashTex, roughness: 0.5 }),
    [dashTex],
  );
  const frameMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x9c27b0, roughness: 0.4 }),
    [],
  );
  const chromeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.9 }),
    [],
  );

  useFrame((state) => {
    const s = useGameStore.getState();
    const sample = sampleTrack(s.distance);
    const lateralLimit = 10;
    const lat = Math.max(-lateralLimit, Math.min(lateralLimit, s.lateral));
    const px = sample.x + sample.normal.x * lat;
    const pz = sample.z + sample.normal.z * lat;
    const angle = Math.atan2(sample.tangent.x, sample.tangent.z);

    const g = groupRef.current;
    if (g) {
      g.position.set(px, sample.y, pz);
      g.rotation.y = angle;
      // subtle car bob
      const t = state.clock.elapsedTime;
      g.position.x += Math.sin(t * 40) * 0.03;
      g.position.y += Math.cos(t * 50) * 0.03;
    }

    const wh = wheelRef.current;
    if (wh) {
      const deg = (s.steer * STEER.WHEEL_MAX_DEG * Math.PI) / 180;
      wh.rotation.z = -deg;
    }
    const orn = ornamentRef.current;
    if (orn) orn.rotation.y = state.clock.elapsedTime * 3;

    if (needleLaughsRef.current) {
      needleLaughsRef.current.rotation.z =
        -Math.PI / 4 + Math.sin(state.clock.elapsedTime * 12) * 0.15;
    }
    if (needleFunRef.current) {
      const hype = s.hype / 100;
      needleFunRef.current.rotation.z = -Math.PI / 4 + hype * Math.PI * 0.9;
    }
    if (diceRef.current) {
      diceRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 3) * 0.3;
      diceRef.current.rotation.x = Math.cos(state.clock.elapsedTime * 2) * 0.2;
    }
  });

  // Build flower petals procedurally
  const petals = useMemo(() => {
    const out: Array<{ rotZ: number; key: number }> = [];
    for (let i = 0; i < 8; i++) out.push({ rotZ: (Math.PI / 4) * i, key: i });
    return out;
  }, []);

  return (
    <group ref={groupRef} data-testid="player-car">
      {/* Purple cockpit pillars (angled toward roof, framing the view) */}
      <mesh position={[-12, 8, 3]} rotation={[Math.PI / 6, 0, -Math.PI / 8]} material={frameMat}>
        <cylinderGeometry args={[0.8, 0.8, 15, 12]} />
      </mesh>
      <mesh position={[12, 8, 3]} rotation={[Math.PI / 6, 0, Math.PI / 8]} material={frameMat}>
        <cylinderGeometry args={[0.8, 0.8, 15, 12]} />
      </mesh>
      {/* Roof header */}
      <mesh position={[0, 13, 5]} rotation={[Math.PI / 12, 0, 0]} material={frameMat}>
        <boxGeometry args={[26, 2, 8]} />
      </mesh>

      {/* Dashboard: half-cylinder filling lower view, polka-dot livery */}
      <mesh position={[0, 1.5, -1]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} material={dashMat}>
        <cylinderGeometry args={[18, 18, 6, 32, 1, false, 0, Math.PI]} />
      </mesh>
      {/* Chrome trim along dashboard edge */}
      <mesh position={[0, 1.8, -1]} rotation={[-Math.PI / 2, 0, 0]} material={chromeMat}>
        <torusGeometry args={[18.1, 0.4, 16, 32, Math.PI]} />
      </mesh>

      {/* Hood: flattened half-cylinder polka-dot */}
      <mesh
        position={[0, 2.5, -16]}
        rotation={[-Math.PI / 2.2, 0, Math.PI / 2]}
        scale={[1, 1, 0.4]}
        material={hoodMat}
      >
        <cylinderGeometry args={[12, 12, 30, 32, 1, false, 0, Math.PI]} />
      </mesh>
      {/* Hood ridge */}
      <mesh position={[0, 4.6, -16]} rotation={[Math.PI / 24, 0, 0]} material={chromeMat}>
        <boxGeometry args={[0.8, 0.8, 30]} />
      </mesh>

      {/* Hood ornament — squirting flower */}
      <group ref={ornamentRef} position={[0, 5.0, -25]} rotation={[-Math.PI / 6, 0, 0]}>
        <mesh material={chromeMat}>
          <cylinderGeometry args={[0.15, 0.15, 1.5, 8]} />
        </mesh>
        <mesh position={[0, 1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshStandardMaterial color="#ffff00" />
        </mesh>
        {petals.map((p) => (
          <mesh key={p.key} position={[0, 1, 0]} rotation={[0, 0, p.rotZ]}>
            <cylinderGeometry args={[0.3, 0.3, 1.8, 6]} />
            <meshStandardMaterial color="#ff00ff" />
          </mesh>
        ))}
      </group>

      {/* Steering wheel — purple torus, chrome spokes, clown-red horn */}
      <group ref={wheelRef} position={[0, 4.5, 1]} rotation={[-Math.PI / 6, 0, 0]}>
        <mesh position={[0, 0, -1.5]} rotation={[Math.PI / 2, 0, 0]} material={chromeMat}>
          <cylinderGeometry args={[0.5, 0.5, 4, 12]} />
        </mesh>
        <mesh>
          <torusGeometry args={[2.5, 0.4, 16, 32]} />
          <meshStandardMaterial color="#9c27b0" roughness={0.2} />
        </mesh>
        <mesh material={chromeMat}>
          <cylinderGeometry args={[0.15, 0.15, 4.8, 12]} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} material={chromeMat}>
          <cylinderGeometry args={[0.15, 0.15, 4.8, 12]} />
        </mesh>
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.8, 0.9, 0.4, 32]} />
          <meshStandardMaterial color="#ff3e3e" />
        </mesh>
        <mesh position={[0, 0, 0.1]} material={chromeMat}>
          <torusGeometry args={[0.9, 0.15, 16, 32]} />
        </mesh>
      </group>

      {/* LAUGHS gauge (left) */}
      <group position={[-5, 3.5, -0.5]} rotation={[-Math.PI / 5, 0, 0]}>
        <mesh material={chromeMat}>
          <torusGeometry args={[1.5, 0.25, 16, 32]} />
        </mesh>
        <mesh>
          <circleGeometry args={[1.4, 32]} />
          <meshBasicMaterial map={laughsTex} />
        </mesh>
        <mesh ref={needleLaughsRef} position={[0, 0.6, 0.1]}>
          <boxGeometry args={[0.15, 1.2, 0.05]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      </group>
      {/* FUN gauge (right) */}
      <group position={[5, 3.5, -0.5]} rotation={[-Math.PI / 5, 0, 0]}>
        <mesh material={chromeMat}>
          <torusGeometry args={[1.5, 0.25, 16, 32]} />
        </mesh>
        <mesh>
          <circleGeometry args={[1.4, 32]} />
          <meshBasicMaterial map={funTex} />
        </mesh>
        <mesh ref={needleFunRef} position={[0, 0.6, 0.1]}>
          <boxGeometry args={[0.15, 1.2, 0.05]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      </group>

      {/* Rear-view mirror with fuzzy dice */}
      <group position={[0, 11, 2]}>
        <mesh position={[0, 1, 0]} material={chromeMat}>
          <cylinderGeometry args={[0.08, 0.08, 2, 8]} />
        </mesh>
        <mesh position={[0, 0, 0.1]}>
          <boxGeometry args={[5, 1.5, 0.3]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
        <mesh position={[0, 0, 0.26]}>
          <planeGeometry args={[4.8, 1.3]} />
          <meshStandardMaterial color="#aaaaaa" metalness={1.0} roughness={0.0} />
        </mesh>
        <group ref={diceRef} position={[1.5, -0.8, 0]}>
          <mesh position={[0, -1.25, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 2.5, 6]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.3, -2.5, 0]} rotation={[1, 2, 3]}>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshStandardMaterial color="#ff3e3e" />
          </mesh>
          <mesh position={[0.4, -2.0, 0.4]} rotation={[3, 2, 1]}>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshStandardMaterial color="#00a8ff" />
          </mesh>
        </group>
      </group>

      {/* Headlights (spotlights cutting through fog) */}
      <spotLight
        position={[-3, 4, -3]}
        target-position={[-3, 0, -100]}
        angle={Math.PI / 5}
        penumbra={0.5}
        intensity={2.5}
        distance={220}
        color="#ffeedd"
        castShadow={false}
      />
      <spotLight
        position={[3, 4, -3]}
        target-position={[3, 0, -100]}
        angle={Math.PI / 5}
        penumbra={0.5}
        intensity={2.5}
        distance={220}
        color="#ffeedd"
        castShadow={false}
      />
    </group>
  );
}
