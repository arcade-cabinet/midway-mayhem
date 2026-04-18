/**
 * ExplosionFX — multicolor clown explosion on game-over.
 *
 * Renders for 1.2s after game-over triggers, then hides so the Banner reads
 * cleanly. Spawns:
 *   - 30 colored boxes (confetti)
 *   - 5 sphere "hearts"
 *   - 5 icosahedron "stars"
 * All radiate outward from the cockpit hood with simulated gravity.
 *
 * A large emissive plane provides an 0.8s radial flash, then fades out.
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from '@/game/gameState';

const EXPLOSION_DURATION_S = 1.2;
const FLASH_DURATION_S = 0.8;
const GRAVITY = -9.8;

// Brand palette hex values as THREE.Color-compatible numbers
const BRAND_COLORS = [
  0xe53935, // red
  0xffd600, // yellow
  0x1e88e5, // blue
  0x8e24aa, // purple
  0xf36f21, // orange
] as const;

interface Particle {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: number;
  scale: THREE.Vector3;
}

function randomBrandColor(): number {
  return BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)] ?? BRAND_COLORS[0];
}

/** Generate a random outward velocity from the hood origin. */
function randomVelocity(speed: number): THREE.Vector3 {
  const theta = Math.random() * Math.PI * 2;
  const phi = (Math.random() - 0.2) * Math.PI; // slightly upward bias
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta) * speed,
    Math.cos(phi) * speed * 0.8 + 2, // upward pop
    Math.sin(phi) * Math.sin(theta) * speed - speed * 0.3,
  );
}

/** Build a fresh particle set with random positions + velocities + colors. */
function buildConfettiParticles(): Particle[] {
  return Array.from({ length: 30 }, (_, i) => ({
    id: `confetti-${Date.now()}-${i}`,
    position: new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      0.2,
      -1.8 + (Math.random() - 0.5) * 0.5,
    ),
    velocity: randomVelocity(3 + Math.random() * 4),
    color: randomBrandColor(),
    scale: new THREE.Vector3(
      0.06 + Math.random() * 0.08,
      0.06 + Math.random() * 0.08,
      0.06 + Math.random() * 0.08,
    ),
  }));
}

function buildHeartParticles(): Particle[] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `heart-${Date.now()}-${i}`,
    position: new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      0.3,
      -1.8 + (Math.random() - 0.5) * 0.3,
    ),
    velocity: randomVelocity(2.5 + Math.random() * 3),
    color: randomBrandColor(),
    scale: new THREE.Vector3(0.12, 0.12, 0.12),
  }));
}

export function ExplosionFX() {
  const gameOver = useGameStore((s) => s.gameOver);
  // Rebuild startTime + particles on EVERY gameOver transition, not just first
  // mount — the original `useState(() => gameOver ? now() : 0)` only ran on
  // mount and broke every subsequent run's explosion.
  const [startTime, setStartTime] = useState(0);
  const [visible, setVisible] = useState(false);
  const [confettiParticles, setConfettiParticles] = useState<Particle[]>([]);
  const [heartParticles, setHeartParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!gameOver) {
      setVisible(false);
      return;
    }
    setStartTime(performance.now());
    setVisible(true);
    setConfettiParticles(buildConfettiParticles());
    setHeartParticles(buildHeartParticles());
  }, [gameOver]);

  const [starParticles, setStarParticles] = useState<Particle[]>([]);
  useEffect(() => {
    if (!gameOver) return;
    setStarParticles(
      Array.from({ length: 5 }, (_, i) => ({
        id: `star-${Date.now()}-${i}`,
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 0.4,
          0.3,
          -1.8 + (Math.random() - 0.5) * 0.3,
        ),
        velocity: randomVelocity(3 + Math.random() * 3.5),
        color: randomBrandColor(),
        scale: new THREE.Vector3(0.1, 0.1, 0.1),
      })),
    );
  }, [gameOver]);

  // Refs to particle mesh groups for animation
  const confettiRefs = useRef<(THREE.Mesh | null)[]>(Array(30).fill(null));
  const heartRefs = useRef<(THREE.Mesh | null)[]>(Array(5).fill(null));
  const starRefs = useRef<(THREE.Mesh | null)[]>(Array(5).fill(null));
  const flashRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!gameOver || !visible) return;
    const elapsed = (performance.now() - startTime) / 1000;

    if (elapsed >= EXPLOSION_DURATION_S) {
      setVisible(false);
      return;
    }

    const dt = 1 / 60; // approximate; good enough for burst FX

    // Animate confetti
    for (let i = 0; i < confettiParticles.length; i++) {
      const p = confettiParticles[i];
      const mesh = confettiRefs.current[i];
      if (!p || !mesh) continue;
      p.velocity.y += GRAVITY * dt;
      p.position.addScaledVector(p.velocity, dt);
      mesh.position.copy(p.position);
      mesh.rotation.x += 0.08;
      mesh.rotation.z += 0.05;
    }

    // Animate hearts
    for (let i = 0; i < heartParticles.length; i++) {
      const p = heartParticles[i];
      const mesh = heartRefs.current[i];
      if (!p || !mesh) continue;
      p.velocity.y += GRAVITY * dt * 0.6;
      p.position.addScaledVector(p.velocity, dt);
      mesh.position.copy(p.position);
    }

    // Animate stars
    for (let i = 0; i < starParticles.length; i++) {
      const p = starParticles[i];
      const mesh = starRefs.current[i];
      if (!p || !mesh) continue;
      p.velocity.y += GRAVITY * dt * 0.7;
      p.position.addScaledVector(p.velocity, dt);
      mesh.position.copy(p.position);
      mesh.rotation.y += 0.1;
    }

    // Flash plane fade-out after FLASH_DURATION_S
    const flash = flashRef.current;
    if (flash) {
      const flashFrac = Math.max(0, 1 - elapsed / FLASH_DURATION_S);
      flash.visible = flashFrac > 0;
      const mat = flash.material as THREE.MeshStandardMaterial;
      mat.opacity = flashFrac * 0.55;
    }
  });

  if (!gameOver || !visible) return null;

  return (
    <group name="explosion-fx">
      {/* Radial flash plane — large emissive disc briefly visible */}
      <mesh ref={flashRef} position={[0, 0.5, -2]} rotation={[0, 0, 0]}>
        <planeGeometry args={[18, 18]} />
        <meshStandardMaterial
          color="#ffd600"
          emissive="#ff8800"
          emissiveIntensity={3}
          transparent
          opacity={0.55}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Confetti boxes */}
      {confettiParticles.map((p, i) => (
        <mesh
          key={p.id}
          ref={(el) => {
            confettiRefs.current[i] = el;
          }}
          position={p.position.toArray() as [number, number, number]}
          scale={p.scale.toArray() as [number, number, number]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={p.color} />
        </mesh>
      ))}

      {/* Heart spheres */}
      {heartParticles.map((p, i) => (
        <mesh
          key={p.id}
          ref={(el) => {
            heartRefs.current[i] = el;
          }}
          position={p.position.toArray() as [number, number, number]}
          scale={p.scale.toArray() as [number, number, number]}
        >
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial
            color={p.color}
            emissive={new THREE.Color(p.color).multiplyScalar(0.3)}
          />
        </mesh>
      ))}

      {/* Star icosahedra */}
      {starParticles.map((p, i) => (
        <mesh
          key={p.id}
          ref={(el) => {
            starRefs.current[i] = el;
          }}
          position={p.position.toArray() as [number, number, number]}
          scale={p.scale.toArray() as [number, number, number]}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={p.color}
            emissive={new THREE.Color(p.color).multiplyScalar(0.4)}
          />
        </mesh>
      ))}
    </group>
  );
}
