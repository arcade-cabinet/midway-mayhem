import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useResponsiveCockpitScale } from '../hooks/useResponsiveCockpitScale';
import { useLoadoutStore } from '../hooks/useLoadout';
import { PLUNGE_DURATION_S, useGameStore } from '../systems/gameState';
import { damageLevelFor } from '../systems/damageLevel';
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
  const fireLightRef = useRef<THREE.PointLight>(null);
  const smokeRef0 = useRef<THREE.Mesh>(null);
  const smokeRef1 = useRef<THREE.Mesh>(null);
  const smokeRef2 = useRef<THREE.Mesh>(null);
  const smokeStartT = useRef(0);

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

  // Loadout-driven material overrides (palette → hood color, rim → wheel rim color)
  const loadout = useLoadoutStore((s) => s.loadout);

  // Palette base color applied to the hood polka-dot background
  const paletteBaseHex = useMemo(() => {
    if (!loadout) return '#ff3e3e';
    switch (loadout.palette) {
      case 'neon-circus':   return '#0d0d0d';
      case 'pastel-dream':  return '#ffd6e0';
      case 'golden-hour':   return '#c8860a';
      default:              return '#ff3e3e'; // classic
    }
  }, [loadout?.palette]);

  // Update hood material color reactively
  useMemo(() => {
    hoodMat.color.set(paletteBaseHex);
    hoodMat.needsUpdate = true;
  }, [paletteBaseHex, hoodMat]);

  // Rim color from loadout
  const rimColor = useMemo(() => {
    if (!loadout) return '#9c27b0';
    switch (loadout.rim) {
      case 'gold':         return '#ffd700';
      case 'purple-candy': return '#9c27b0';
      case 'rainbow':      return '#ff3e3e'; // approximate — gradient not possible in Three.js mat
      default:             return '#cccccc'; // chrome
    }
  }, [loadout?.rim]);

  useFrame((state) => {
    const s = useGameStore.getState();
    const t = state.clock.elapsedTime;
    const dmgLevel = damageLevelFor(s.sanity);
    const now = performance.now();

    // Drop-in animation: cockpit hangs at +12m, eases to 0 over dropProgress
    const root = rootRef.current;
    if (root) {
      const dp = Math.max(0, Math.min(1, s.dropProgress));
      // ease-in-cubic for the fall, then slight bounce settle
      const fall = dp < 0.75 ? (dp / 0.75) ** 2 : 1 + Math.sin((dp - 0.75) * 12) * 0.06 * (1 - dp);
      const y0 = 12;

      // Plunge animation: parabolic fall off the ramp side
      if (s.plunging) {
        const elapsed = Math.min(1, (now - s.plungeStartedAt) / (PLUNGE_DURATION_S * 1000));
        // Parabolic y drop (starts fast, accelerates)
        root.position.y = -(elapsed * elapsed) * 18;
        // Drift in the plunge direction
        root.position.x = s.plungeDirection * elapsed * 6;
        // Forward roll tipping over the edge
        root.rotation.x = elapsed * 1.2;
        root.rotation.z = s.plungeDirection * elapsed * 0.8;
      } else {
        root.position.y = y0 * (1 - fall);
        root.position.x = 0;
        // Trick rotations (Feature C) applied AFTER plunge/drop checks
        // These animate the cockpit-root for visual flair; damage-shake stays on bodyRef
        root.rotation.x = 0;
        root.rotation.y = s.trickRotationY;
        if (dp < 0.1) root.rotation.z = Math.sin(t * 2) * 0.02 + s.trickRotationZ;
        else root.rotation.z = s.trickRotationZ + (s.trickRotationZ === 0 ? root.rotation.z * 0.9 : 0);
      }
    }
    // Wire opacity fades out once settled
    const rigL = rigLeftRef.current;
    const rigR = rigRightRef.current;
    if (rigL && rigR) {
      const visible = s.dropProgress < 0.98 && !s.plunging;
      rigL.visible = visible;
      rigR.visible = visible;
    }

    // Car body banks with steering: yaw + roll + camera rides it
    const body = bodyRef.current;
    if (body && !s.plunging) {
      const targetYaw = -s.steer * 0.14;
      // Damage wobble: level-proportional oscillation on Z
      const dmgWobble = dmgLevel > 0 ? Math.sin(t * (8 + dmgLevel * 4)) * dmgLevel * 0.018 : 0;
      const targetRoll = s.steer * 0.22 + dmgWobble;
      body.rotation.y += (targetYaw - body.rotation.y) * 0.15;
      body.rotation.z += (targetRoll - body.rotation.z) * 0.15;
      // Engine idle + speed-driven shake. Louder at higher speed for visceral feel.
      // At damage level 3, shake is doubled.
      const speedNorm = Math.min(1, s.speedMps / 120);
      const shakeMultiplier = dmgLevel >= 3 ? 2.0 : 1.0;
      const shakeAmp = (0.015 + speedNorm * 0.02) * shakeMultiplier;
      body.position.x = Math.sin(t * 40) * shakeAmp;
      body.position.y = Math.cos(t * 50) * shakeAmp + Math.sin(t * 130) * 0.005 * speedNorm;
    }

    // Wheel wobble proportional to damage level
    const wh = wheelRef.current;
    if (wh) {
      const wheelWobble = dmgLevel > 0 ? Math.sin(t * 12) * dmgLevel * 0.04 : 0;
      wh.rotation.z = -(s.steer * STEER.WHEEL_MAX_DEG * Math.PI) / 180 + wheelWobble;
    }
    const orn = ornamentRef.current;
    if (orn) orn.rotation.y = t * 3;

    if (diceRef.current) {
      diceRef.current.rotation.z = Math.sin(t * 3) * 0.3;
      diceRef.current.rotation.x = Math.cos(t * 2) * 0.2;
    }

    // Damage FX: fire light flicker + smoke particles
    const fireLight = fireLightRef.current;
    if (fireLight) {
      const active = dmgLevel >= 2;
      fireLight.visible = active;
      if (active) {
        // Flicker: random-ish oscillation
        fireLight.intensity = 1.2 + Math.sin(t * 23) * 0.5 + Math.sin(t * 37) * 0.3;
      }
    }

    // Smoke particles: rise and reset
    const smokes = [smokeRef0.current, smokeRef1.current, smokeRef2.current];
    for (let i = 0; i < smokes.length; i++) {
      const mesh = smokes[i];
      if (!mesh) continue;
      const active = dmgLevel >= 2;
      mesh.visible = active;
      if (active) {
        if (smokeStartT.current === 0) smokeStartT.current = t;
        const offset = (i / 3) * 1.8; // stagger each particle
        const elapsed = ((t - smokeStartT.current + offset) % 1.8);
        const frac = elapsed / 1.8;
        mesh.position.y = -0.3 + frac * 2.0;
        mesh.position.x = Math.sin(t * 2 + i * 1.2) * 0.15;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.opacity = frac < 0.5 ? frac * 1.6 : (1 - frac) * 1.6;
        const scale = 0.06 + frac * 0.14;
        mesh.scale.setScalar(scale);
      } else {
        smokeStartT.current = 0;
      }
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
            opens up — hood reads as a rounded horizon rather than a wall.
            hoodZOffset pushes the hood forward on narrow form factors so
            more track is visible through the windshield. */}
        <mesh position={[0, -0.1, -1.9 + cockpitScale.hoodZOffset]} material={hoodMat} scale={[0.95, 0.75, 1.25]}>
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
          {/* Rim — color driven by loadout */}
          <mesh>
            <torusGeometry args={[0.4, 0.06, 18, 36]} />
            <meshPhysicalMaterial
              color={rimColor}
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

        {/* Damage fire reflection — orange point light, flickers at level >= 2 */}
        <pointLight
          ref={fireLightRef}
          position={[0, 0.4, -1.8]}
          intensity={0}
          distance={4}
          color="#ff6600"
          visible={false}
        />

        {/* Smoke particles — 3 dark spheres rising from hood at damage level >= 2 */}
        <mesh ref={smokeRef0} position={[-0.25, -0.3, -1.6]} visible={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#1a1a1a" transparent opacity={0} />
        </mesh>
        <mesh ref={smokeRef1} position={[0, -0.3, -1.7]} visible={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#222222" transparent opacity={0} />
        </mesh>
        <mesh ref={smokeRef2} position={[0.25, -0.3, -1.6]} visible={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#1a1a1a" transparent opacity={0} />
        </mesh>
      </group>
    </group>
  );
}
