/**
 * useCockpitFeel — per-frame cockpit body dynamics.
 *
 * Subtle channels, layered additively so no single one dominates:
 *   1. body-roll:  banks the cockpit ±MAX_ROLL_RAD on steer input
 *   2. body-yaw:   follows steer a tiny amount, like the clown car rotates
 *                  into the turn rather than crabbing sideways
 *   3. engine-bob: low-amplitude sine bob on Y + tiny X wobble, driven by
 *                  a 40 Hz base + speed-scaled high freq
 *
 * All outputs are ref-written on a THREE.Group so React doesn't re-render.
 * The hook is driver-independent of the blueprint — consumers attach the
 * returned ref to whatever group holds the cockpit meshes.
 *
 * Rules from project memory:
 *  - ≤3° roll at max steer (reference_r3f_racer_camera_spec.md, "banks…
 *    banks CAMERA with it")
 *  - 0.03m idle bob at ~40 Hz (project_next_pass_cockpit.md, "Tiny engine
 *    bob that doesn't induce motion sickness")
 *  - lerp toward targets so steering reversals aren't jerky
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { useGameStore } from '@/game/gameState';

/** Max body-roll in radians (~3°). */
const MAX_ROLL_RAD = (3 * Math.PI) / 180;
/** Max body-yaw offset in radians (~1.5°). Smaller than roll — yaw reads strongly. */
const MAX_YAW_RAD = (1.5 * Math.PI) / 180;
/** Roll lerp factor per second. */
const ROLL_LERP = 6;
/** Engine bob vertical amplitude, meters. */
const BOB_AMP_Y = 0.018;
/** Engine bob horizontal amplitude, meters. */
const BOB_AMP_X = 0.008;
/** Base idle-hum frequency, rad/s. */
const BOB_FREQ_BASE = 2 * Math.PI * 4; // ~4 Hz on Y
/** Cross-freq for X wobble (prime-ish vs Y freq so the two don't beat). */
const BOB_FREQ_X = 2 * Math.PI * 5.3;
/** Extra bob added at full speed. */
const SPEED_BOB_GAIN = 0.35;
/** Normalization speed (m/s) for bob gain. */
const MAX_SPEED_REF = 70;

export function useCockpitFeel() {
  const groupRef = useRef<THREE.Group | null>(null);
  // Smoothed roll + yaw so fast steer reversals glide instead of snap.
  const smoothedRoll = useRef(0);
  const smoothedYaw = useRef(0);
  const basePos = useRef<[number, number, number] | null>(null);

  useFrame((_state, dt) => {
    const group = groupRef.current;
    if (!group) return;

    // Capture the initial position once so bob adds to, not replaces it.
    if (basePos.current === null) {
      basePos.current = [group.position.x, group.position.y, group.position.z];
    }

    const s = useGameStore.getState();
    const steer = Math.max(-1, Math.min(1, s.steer));
    const speedNorm = Math.max(0, Math.min(1, s.speedMps / MAX_SPEED_REF));
    const t = _state.clock.getElapsedTime();

    // Smooth targets. The exponent form `1 - exp(-k·dt)` is framerate-indep.
    const k = 1 - Math.exp(-ROLL_LERP * dt);
    smoothedRoll.current += (-steer * MAX_ROLL_RAD - smoothedRoll.current) * k;
    smoothedYaw.current += (steer * MAX_YAW_RAD - smoothedYaw.current) * k;

    // Bob: tiny idle always, plus a speed-scaled ripple on top.
    const bobGain = 1 + SPEED_BOB_GAIN * speedNorm;
    const bobY = Math.sin(t * BOB_FREQ_BASE) * BOB_AMP_Y * bobGain;
    const bobX = Math.sin(t * BOB_FREQ_X) * BOB_AMP_X * bobGain;

    // Apply — roll is around Z (local forward-down plane), yaw around Y.
    group.rotation.z = smoothedRoll.current;
    group.rotation.y = smoothedYaw.current;
    const [bx, by, bz] = basePos.current;
    group.position.set(bx + bobX, by + bobY, bz);
  });

  return groupRef;
}
