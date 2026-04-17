import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useResponsiveCockpitScale } from '../hooks/useResponsiveCockpitScale';
import { useGameStore } from '../systems/gameState';
import { STEER } from '../utils/constants';
import { makePolkaDotTexture } from '../utils/proceduralTextures';
import { CockpitCamera } from './CockpitCamera';

/**
 * World-origin cockpit. The camera is a child of this group; the cockpit
 * never moves in world space, the WORLD (track + props) scrolls past it.
 *
 * Layout (world units):
 *   Camera at (0, 1.2, 0.6) — inside the cab, looking toward -Z
 *   Hood lives in front (-Z), capped so it never extends behind the dashboard.
 *   Dashboard + steering wheel sit between camera and hood.
 *
 * Position Z is ALWAYS negative to be in front of the camera.
 */
export function Cockpit() {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const wheelRef = useRef<THREE.Group>(null);
  const ornamentRef = useRef<THREE.Group>(null);
  const diceRef = useRef<THREE.Group>(null);
  const rigLeftRef = useRef<THREE.Mesh>(null);
  const rigRightRef = useRef<THREE.Mesh>(null);

  const polkaTex = useMemo(() => {
    const t = makePolkaDotTexture();
    t.repeat.set(3, 2);
    return t;
  }, []);
  const dashPolkaTex = useMemo(() => {
    const t = makePolkaDotTexture();
    t.repeat.set(2, 1);
    return t;
  }, []);

  const hoodMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: polkaTex, roughness: 0.55 }),
    [polkaTex],
  );
  const dashMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: dashPolkaTex, roughness: 0.5 }),
    [dashPolkaTex],
  );
  const frameMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x9c27b0, roughness: 0.4 }),
    [],
  );
  const chromeMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.05,
        metalness: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.5,
      }),
    [],
  );
  const windshieldArchMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xffd600, roughness: 0.35, metalness: 0.2 }),
    [],
  );

  const petals = useMemo(
    () => Array.from({ length: 8 }, (_, i) => ({ key: i, rotZ: (Math.PI / 4) * i })),
    [],
  );

  useFrame((state) => {
    const s = useGameStore.getState();
    const t = state.clock.elapsedTime;

    // Drop-in animation: cockpit hangs at +12m, eases to 0 over dropProgress
    const root = rootRef.current;
    if (root) {
      const dp = Math.max(0, Math.min(1, s.dropProgress));
      // ease-in-cubic for the fall, then slight bounce settle
      const fall = dp < 0.75 ? (dp / 0.75) ** 2 : 1 + Math.sin((dp - 0.75) * 12) * 0.06 * (1 - dp);
      const y0 = 12;
      root.position.y = y0 * (1 - fall);
      // Subtle pre-drop sway while hanging
      if (dp < 0.1) root.rotation.z = Math.sin(t * 2) * 0.02;
      else root.rotation.z *= 0.9;
    }
    // Wire opacity fades out once settled
    const rigL = rigLeftRef.current;
    const rigR = rigRightRef.current;
    if (rigL && rigR) {
      const visible = s.dropProgress < 0.98;
      rigL.visible = visible;
      rigR.visible = visible;
    }

    // Car body banks with steering: yaw + roll + camera rides it
    const body = bodyRef.current;
    if (body) {
      const targetYaw = -s.steer * 0.14;
      const targetRoll = s.steer * 0.22;
      body.rotation.y += (targetYaw - body.rotation.y) * 0.15;
      body.rotation.z += (targetRoll - body.rotation.z) * 0.15;
      // Engine idle + speed-driven shake. Louder at higher speed for visceral feel.
      const speedNorm = Math.min(1, s.speedMps / 120);
      const shakeAmp = 0.015 + speedNorm * 0.02;
      body.position.x = Math.sin(t * 40) * shakeAmp;
      body.position.y = Math.cos(t * 50) * shakeAmp + Math.sin(t * 130) * 0.005 * speedNorm;
    }

    const wh = wheelRef.current;
    if (wh) wh.rotation.z = -(s.steer * STEER.WHEEL_MAX_DEG * Math.PI) / 180;
    const orn = ornamentRef.current;
    if (orn) orn.rotation.y = t * 3;

    if (diceRef.current) {
      diceRef.current.rotation.z = Math.sin(t * 3) * 0.3;
      diceRef.current.rotation.x = Math.cos(t * 2) * 0.2;
    }
  });

  const cockpitScale = useResponsiveCockpitScale();

  return (
    <group ref={rootRef} name="cockpit-root" data-testid="cockpit" scale={cockpitScale.scale}>
      {/* Rigging cables anchoring the cockpit roof (y≈2.4) to big-top rigging
          at y≈14. Placed WELL BEHIND the camera (z>2) so they never slice
          through the player's forward view — they're only glimpsed on the
          drop-in and via the rear-view mirror. */}
      <mesh ref={rigLeftRef} position={[-1.3, 8.2, 2.4]}>
        <cylinderGeometry args={[0.025, 0.025, 11.6, 6]} />
        <meshStandardMaterial color="#2a1a2f" roughness={0.8} />
      </mesh>
      <mesh ref={rigRightRef} position={[1.3, 8.2, 2.4]}>
        <cylinderGeometry args={[0.025, 0.025, 11.6, 6]} />
        <meshStandardMaterial color="#2a1a2f" roughness={0.8} />
      </mesh>
      <group ref={bodyRef} name="cockpit-body">
        {/* CAMERA lives inside the body → banks with it. All camera logic (FOV, look-ahead, speed boost) in CockpitCamera. */}
        <CockpitCamera />

        {/* A-pillars framing the forward view (from driver's POV looking -Z) */}
        <mesh position={[-1.1, 1.55, -0.2]} rotation={[0.25, 0, 0.12]} material={frameMat}>
          <cylinderGeometry args={[0.05, 0.05, 1.6, 10]} />
        </mesh>
        <mesh position={[1.1, 1.55, -0.2]} rotation={[0.25, 0, -0.12]} material={frameMat}>
          <cylinderGeometry args={[0.05, 0.05, 1.6, 10]} />
        </mesh>

        {/* Yellow arched windshield header (the iconic clown-car curve) */}
        <mesh position={[0, 2.3, -0.3]} rotation={[0.15, 0, 0]} material={windshieldArchMat}>
          <torusGeometry args={[1.08, 0.07, 10, 24, Math.PI]} />
        </mesh>
        <mesh position={[0, 2.2, -0.3]} rotation={[0.15, 0, 0]} material={windshieldArchMat}>
          <boxGeometry args={[2.3, 0.1, 0.1]} />
        </mesh>

        {/* Roof sliver behind */}
        <mesh position={[0, 2.35, 0.4]} rotation={[-0.1, 0, 0]} material={frameMat}>
          <boxGeometry args={[2.2, 0.08, 0.5]} />
        </mesh>

        {/* COWL — stripped clown-car has no dashboard, just a thin polka-dot
            cowl where the hood meets the windshield, like a fairground kiddie
            ride. No gauges (HUD handles that), no center console. */}
        <mesh
          position={[0, 0.75, -0.65]}
          rotation={[-Math.PI / 2.4, 0, Math.PI / 2]}
          material={dashMat}
        >
          <cylinderGeometry args={[0.32, 0.32, 2.0, 28, 1, false, 0, Math.PI]} />
        </mesh>
        {/* Chrome piping along cowl edge — just a thin band, not a floating box */}
        <mesh
          position={[0, 0.95, -0.48]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={chromeMat}
        >
          <torusGeometry args={[0.32, 0.015, 8, 24, Math.PI]} />
        </mesh>

        {/* HOOD — elongated bubbled shape (VW-Beetle + clown-car combo).
            Lowered (y=-0.1) and scaled down so the driver's forward view
            opens up — hood reads as a rounded horizon rather than a wall. */}
        <mesh position={[0, -0.1, -1.9]} material={hoodMat} scale={[0.95, 0.75, 1.25]}>
          <sphereGeometry args={[0.92, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {/* Chrome ridge — now laid ON the hood surface (y=0.55, just above
            the hood's peak of ~0.58) so it reads as a spine, not a
            z-fighting line suspended in air. */}
        <mesh position={[0, 0.55, -1.95]} material={chromeMat}>
          <boxGeometry args={[0.06, 0.02, 1.6]} />
        </mesh>
        {/* Gold hood accent line toward headlights */}
        <mesh position={[0, 0.15, -2.85]} material={windshieldArchMat}>
          <boxGeometry args={[1.1, 0.04, 0.08]} />
        </mesh>

        {/* Squirting flower hood ornament — sits on the front lip of the hood */}
        <group ref={ornamentRef} position={[0, 0.6, -2.7]}>
          <mesh material={chromeMat}>
            <cylinderGeometry args={[0.025, 0.025, 0.25, 8]} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.12, 16, 12]} />
            <meshStandardMaterial color="#ffff00" emissive="#332200" />
          </mesh>
          {petals.map((p) => (
            <mesh key={p.key} position={[0, 0.22, 0]} rotation={[0, 0, p.rotZ]}>
              <cylinderGeometry args={[0.045, 0.045, 0.35, 6]} />
              <meshStandardMaterial color="#ff00ff" />
            </mesh>
          ))}
        </group>

        {/* STEERING WHEEL — purple torus, 4 chrome spokes, red honkable horn.
            The column runs from the wheel hub BACK and DOWN into the dash
            cowl — rotation[Math.PI/2, 0, 0] makes the cylinder's Y-axis align
            with -Z (world-back), so a small positional offset of z=-0.35 tucks
            the base of the column neatly inside the dashboard shell instead
            of sticking out above the wheel as a stray line. */}
        <group ref={wheelRef} position={[0, 0.82, 0.2]} rotation={[-Math.PI / 4.3, 0, 0]}>
          <mesh position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]} material={chromeMat}>
            <cylinderGeometry args={[0.035, 0.035, 0.6, 10]} />
          </mesh>
          {/* Rim */}
          <mesh>
            <torusGeometry args={[0.4, 0.06, 18, 36]} />
            <meshPhysicalMaterial
              color="#9c27b0"
              roughness={0.2}
              metalness={0.3}
              clearcoat={0.8}
              clearcoatRoughness={0.1}
            />
          </mesh>
          {/* 4 chrome spokes in an X + horizontal + vertical */}
          <mesh material={chromeMat}>
            <cylinderGeometry args={[0.022, 0.022, 0.78, 10]} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} material={chromeMat}>
            <cylinderGeometry args={[0.022, 0.022, 0.78, 10]} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 4]} material={chromeMat}>
            <cylinderGeometry args={[0.018, 0.018, 0.78, 10]} />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 4]} material={chromeMat}>
            <cylinderGeometry args={[0.018, 0.018, 0.78, 10]} />
          </mesh>
          <mesh
            name="horn"
            position={[0, 0, 0.03]}
            rotation={[Math.PI / 2, 0, 0]}
            onPointerDown={(e) => {
              e.stopPropagation();
              // biome-ignore lint/suspicious/noExplicitAny: dev hook
              (window as any).__mmHonk?.();
            }}
          >
            <cylinderGeometry args={[0.15, 0.18, 0.08, 28]} />
            <meshStandardMaterial color="#ff3e3e" emissive="#330808" />
          </mesh>
          <mesh position={[0, 0, 0.025]} material={chromeMat}>
            <torusGeometry args={[0.18, 0.025, 10, 24]} />
          </mesh>
        </group>

        {/* No gauges — clown cars are stripped minimal. The HUD handles
            hype/sanity/distance/crowd. Keeping the 3D dash clean lets the
            sightline focus on the ACTUAL clown-car DNA: giant wheel, hood
            ornament flower, polka-dot fender, windshield arch. */}

        {/* Rear-view mirror with fuzzy dice — chrome frame + reflective glass */}
        <group position={[0, 2.15, 0.2]}>
          <mesh position={[0, 0.05, 0]} material={chromeMat}>
            <cylinderGeometry args={[0.018, 0.018, 0.2, 8]} />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[0.7, 0.2, 0.05]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, -0.05, 0.035]}>
            <planeGeometry args={[0.65, 0.15]} />
            <meshStandardMaterial color="#bbb" metalness={0.95} roughness={0.05} />
          </mesh>
          <group ref={diceRef} position={[0.22, -0.18, 0.05]}>
            <mesh position={[0, -0.12, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.25, 6]} />
              <meshBasicMaterial color="#fff" />
            </mesh>
            <mesh position={[-0.04, -0.28, 0]} rotation={[1, 2, 3]}>
              <boxGeometry args={[0.08, 0.08, 0.08]} />
              <meshStandardMaterial color="#ff3e3e" />
            </mesh>
            <mesh position={[0.04, -0.25, 0.04]} rotation={[3, 2, 1]}>
              <boxGeometry args={[0.08, 0.08, 0.08]} />
              <meshStandardMaterial color="#00a8ff" />
            </mesh>
          </group>
        </group>

        {/* BENCH SEAT — clown-car style red patchwork bench you can see
            peeking up at the very bottom of the driver's frame between
            their knees. Small, forward, no tall seat back (real clown cars
            have milk crates / stripped interiors). */}
        <mesh position={[0, 0.9, 1.1]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[1.4, 0.12, 0.55]} />
          <meshStandardMaterial color="#c21a1a" roughness={0.85} />
        </mesh>
        {/* Yellow piping along the seat's front roll — brand pop */}
        <mesh position={[0, 0.94, 0.85]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.4, 12, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#ffd600" roughness={0.3} metalness={0.3} />
        </mesh>

        {/* Headlights — spotlights cutting through the big-top interior */}
        <spotLight
          position={[-0.5, 0.2, -1.3]}
          target-position={[-0.5, -0.5, -40]}
          angle={Math.PI / 5}
          penumbra={0.55}
          intensity={3.0}
          distance={120}
          color="#ffeedd"
        />
        <spotLight
          position={[0.5, 0.2, -1.3]}
          target-position={[0.5, -0.5, -40]}
          angle={Math.PI / 5}
          penumbra={0.55}
          intensity={3.0}
          distance={120}
          color="#ffeedd"
        />
        <pointLight position={[0, 1.8, 0.3]} intensity={0.45} distance={3.5} color="#ffd6b0" />
      </group>
    </group>
  );
}
