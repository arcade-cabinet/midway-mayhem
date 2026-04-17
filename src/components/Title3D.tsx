/**
 * Title3D — 3D canvas scene behind the title screen DOM overlay.
 *
 * Scene:
 *   - Same circus_arena_2k.hdr HDRI as gameplay (full 360° big-top immersion)
 *   - Cockpit hanging from wires at y=+12, gentle sway animation
 *   - "MIDWAY MAYHEM" rendered as extruded 3D text (Bangers font, yellow + red shadow)
 *   - Spotlight pointing at logo + cockpit
 *   - Camera orbiting slowly around the scene (4s period)
 *
 * The Cockpit component is REUSED at position y=+12 so it sways the way it does
 * at the start of every run, but frozen (dropProgress=0 forever on title).
 *
 * On START click (handled in TitleScreen.tsx), the parent can call onStart().
 * The 3D canvas simply plays its idle loop — no click logic here.
 */

import { Environment, Float, SpotLight, Text3D } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { assetUrl } from '../assets/manifest';
import { ReactErrorBoundary } from './ReactErrorBoundary';
import { CockpitCamera } from './CockpitCamera';

// Bangers font from Google Fonts (https://fonts.gstatic.com — typeface JSON)
// We embed the path to a local copy in public/fonts/. If absent at runtime,
// the preloader will fail hard via errorBus.
const BANGERS_FONT_URL = '/midway-mayhem/fonts/Bangers_Regular.json';

// Orbit period in seconds
const ORBIT_PERIOD_S = 4;
const ORBIT_RADIUS = 5;

// ---------------------------------------------------------------------------
// Orbiting camera rig (updates useFrame)
// ---------------------------------------------------------------------------

function OrbitCamera() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    const angle = (t / ORBIT_PERIOD_S) * Math.PI * 2;
    camera.position.x = Math.sin(angle) * ORBIT_RADIUS;
    camera.position.y = 3.5;
    camera.position.z = Math.cos(angle) * ORBIT_RADIUS;
    camera.lookAt(0, 5, 0); // look at the logo + cockpit center
    void groupRef;
  });

  return null;
}

// ---------------------------------------------------------------------------
// Hanging cockpit stand-in (simplified procedural cockpit for title screen)
// The real Cockpit component reads gameState which won't be running during
// title — we use a simplified stand-in that just sways.
// ---------------------------------------------------------------------------

function TitleCockpit() {
  const rootRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const root = rootRef.current;
    if (!root) return;
    // Gentle sway: simulate hanging from rigging
    root.rotation.z = Math.sin(t * 0.8) * 0.05;
    root.rotation.x = Math.sin(t * 0.6 + 1) * 0.03;
    root.position.y = 12 + Math.sin(t * 0.4) * 0.1;
  });

  return (
    <group ref={rootRef} name="title-cockpit" position={[0, 12, 0]}>
      {/* Hood — polka-dot purple */}
      <mesh position={[0, -0.1, -1.9]} scale={[0.95, 0.75, 1.25]}>
        <sphereGeometry args={[0.92, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#9c27b0" roughness={0.55} />
      </mesh>
      {/* Body frame */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[2.2, 1.6, 3.0]} />
        <meshStandardMaterial color="#6a0080" roughness={0.6} />
      </mesh>
      {/* Yellow windshield arch */}
      <mesh position={[0, 2.3, -0.3]} rotation={[0.15, 0, 0]}>
        <torusGeometry args={[1.08, 0.07, 8, 24, Math.PI]} />
        <meshStandardMaterial color="#ffd600" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Rigging wires */}
      <mesh position={[-1.3, 7.0, 2.4]}>
        <cylinderGeometry args={[0.025, 0.025, 12, 6]} />
        <meshStandardMaterial color="#2a1a2f" roughness={0.8} />
      </mesh>
      <mesh position={[1.3, 7.0, 2.4]}>
        <cylinderGeometry args={[0.025, 0.025, 12, 6]} />
        <meshStandardMaterial color="#2a1a2f" roughness={0.8} />
      </mesh>
      {/* Interior camera for the cockpit POV — not used in title but provides consistent depth */}
      <CockpitCamera />
    </group>
  );
}

// ---------------------------------------------------------------------------
// 3D Logo text
// ---------------------------------------------------------------------------

function TitleLogo() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Subtle floating bob
    if (groupRef.current) {
      groupRef.current.position.y = 7.5 + Math.sin(t * 0.7) * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={[0, 7.5, -2]}>
      {/* Red shadow layer (offset slightly behind) */}
      <Text3D
        font={BANGERS_FONT_URL}
        size={1.2}
        height={0.18}
        curveSegments={8}
        bevelEnabled
        bevelThickness={0.04}
        bevelSize={0.02}
        position={[0.08, -0.08, -0.12]}
      >
        {`MIDWAY\nMAYHEM`}
        <meshStandardMaterial color="#e53935" roughness={0.4} />
      </Text3D>
      {/* Yellow primary layer */}
      <Text3D
        font={BANGERS_FONT_URL}
        size={1.2}
        height={0.22}
        curveSegments={8}
        bevelEnabled
        bevelThickness={0.06}
        bevelSize={0.025}
      >
        {`MIDWAY\nMAYHEM`}
        <meshStandardMaterial color="#ffd600" roughness={0.3} metalness={0.15} emissive="#332200" emissiveIntensity={0.15} />
      </Text3D>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Title3D scene — exported component
// ---------------------------------------------------------------------------

export function Title3D() {
  return (
    <Canvas
      style={{ position: 'absolute', inset: 0 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
      }}
    >
      <ReactErrorBoundary context="title3d-canvas">
        <Suspense fallback={null}>
          {/* Big-top HDRI — same file as gameplay */}
          <Environment
            files={assetUrl('hdri:circus_arena')}
            background={true}
            environmentIntensity={0.5}
            environmentRotation={[0, Math.PI * 0.25, 0]}
          />
          <ambientLight intensity={0.35} color="#ffd6a8" />

          {/* Spotlight aimed at logo + cockpit */}
          <SpotLight
            position={[3, 18, 3]}
            target-position={[0, 8, -1]}
            angle={Math.PI / 7}
            penumbra={0.6}
            intensity={60}
            color="#fffce0"
            distance={30}
            castShadow={false}
          />
          <pointLight position={[-4, 14, 0]} intensity={8} color="#ffd600" distance={18} />

          {/* Gently floating cockpit hanging from wires */}
          <Float speed={0.5} rotationIntensity={0.05} floatIntensity={0.1}>
            <TitleCockpit />
          </Float>

          {/* 3D extruded logo */}
          <TitleLogo />

          {/* Orbiting camera */}
          <OrbitCamera />
        </Suspense>
      </ReactErrorBoundary>
    </Canvas>
  );
}
