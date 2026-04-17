/**
 * @module components/GhostCar
 *
 * Ghost car component — mounted inside WorldScroller alongside obstacles.
 * Loads the best replay for today's daily seed once at mount.
 * Each frame interpolates the ghost's lateral position + steering lean
 * based on current elapsed run time.
 *
 * Renders as a semi-transparent simplified polka-dot silhouette (not full Cockpit).
 * Only visible when:
 *   1. A replay exists for today
 *   2. The current replay is not the ghost replay (replaysEqual check)
 *   3. Daily route mode is active
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { isDailyRoute, utcDateString } from '@/track/dailyRoute';
import { getBestReplayForDate, replaysEqual, type ReplayRow, type ReplaySample } from '@/persistence/replay';
import { reportError } from '@/game/errorBus';
import { useGameStore } from '@/game/gameState';

// ─── Interpolation helpers ──────────────────────────────────────────────────

function lerpSample(a: ReplaySample, b: ReplaySample, t: number): ReplaySample {
  const f = (t - a.t) / (b.t - a.t);
  return {
    t,
    lateral: a.lateral + (b.lateral - a.lateral) * f,
    speedMps: a.speedMps + (b.speedMps - a.speedMps) * f,
    steer: a.steer + (b.steer - a.steer) * f,
  };
}

function sampleAtTime(trace: ReplaySample[], t: number): ReplaySample | null {
  if (trace.length === 0) return null;
  if (t <= (trace[0]?.t ?? 0)) return trace[0] ?? null;
  const last = trace[trace.length - 1];
  if (t >= (last?.t ?? 0)) return last ?? null;

  // Binary search for the surrounding samples
  let lo = 0;
  let hi = trace.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    const midSample = trace[mid];
    if (midSample && midSample.t <= t) lo = mid;
    else hi = mid;
  }
  const a = trace[lo];
  const b = trace[hi];
  if (!a || !b) return null;
  return lerpSample(a, b, t);
}

// ─── Ghost mesh (simplified polka-dot silhouette) ───────────────────────────

function GhostMesh({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff3e3e,
    transparent: true,
    opacity: 0.35,
    roughness: 0.7,
  });
  const dotMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.45,
    roughness: 0.5,
  });

  return (
    <group ref={groupRef} name="ghost-car">
      {/* Simplified hood silhouette */}
      <mesh position={[0, 0, -1.5]} material={mat} scale={[0.85, 0.65, 1.1]}>
        <sphereGeometry args={[0.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* Cabin box */}
      <mesh position={[0, 0.8, 0.2]} material={mat}>
        <boxGeometry args={[1.6, 1.0, 1.4]} />
      </mesh>
      {/* Polka dots */}
      <mesh position={[-0.4, 0.1, -1.2]} material={dotMat}>
        <sphereGeometry args={[0.14, 8, 6]} />
      </mesh>
      <mesh position={[0.4, 0.3, -1.4]} material={dotMat}>
        <sphereGeometry args={[0.14, 8, 6]} />
      </mesh>
      <mesh position={[0, 0.5, -1.7]} material={dotMat}>
        <sphereGeometry args={[0.10, 8, 6]} />
      </mesh>
    </group>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function GhostCar() {
  const [ghostReplay, setGhostReplay] = useState<ReplayRow | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const runStartRef = useRef<number | null>(null);

  // Load today's best replay once at mount
  useEffect(() => {
    if (!isDailyRoute()) return;
    const today = utcDateString();
    getBestReplayForDate(today)
      .then(setGhostReplay)
      .catch((err) => reportError(err, 'GhostCar.loadReplay'));
  }, []);

  // Track run start time
  useEffect(() => {
    return useGameStore.subscribe((s, prev) => {
      if (s.running && !prev.running) {
        runStartRef.current = performance.now();
      }
      if (!s.running && prev.running) {
        runStartRef.current = null;
      }
    });
  }, []);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;

    const s = useGameStore.getState();

    // Ghost only visible during daily active run
    if (!s.running || !isDailyRoute() || !ghostReplay) {
      g.visible = false;
      return;
    }

    const startedAt = runStartRef.current;
    if (startedAt === null) {
      g.visible = false;
      return;
    }

    const elapsedS = (performance.now() - startedAt) / 1000;
    const sample = sampleAtTime(ghostReplay.trace, elapsedS);

    if (!sample) {
      g.visible = false;
      return;
    }

    // Lateral position — same world-space convention as player
    g.position.set(sample.lateral, 0, 0);
    // Steering lean
    g.rotation.z = sample.steer * 0.15;
    g.visible = true;
  });

  // Don't render if no replay or not daily mode
  if (!isDailyRoute()) return null;

  return <GhostMesh groupRef={groupRef} />;
}

export { replaysEqual };
