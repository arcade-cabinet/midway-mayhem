/**
 * useCockpitFeel — per-frame cockpit body dynamics.
 *
 * Subtle channels, layered additively so no single one dominates:
 *   1. body-roll:  banks the cockpit ±MAX_ROLL_RAD on steer input
 *   2. body-yaw:   follows steer a tiny amount, like the clown car rotates
 *                  into the turn rather than crabbing sideways
 *   3. engine-bob: low-amplitude sine bob on Y + tiny X wobble, driven by
 *                  a 4 Hz base + speed-scaled extra ripple
 *   4. crash-shake: impulsive decay ~0.35s after a new crash; watches
 *                  `crashes` counter for monotonic increments.
 *
 * All outputs are ref-written on a THREE.Group so React doesn't re-render.
 * The hook is driver-independent of the blueprint — consumers attach the
 * returned ref to whatever group holds the cockpit meshes.
 *
 * Rules from project memory:
 *  - ≤3° roll at max steer (reference_r3f_racer_camera_spec.md)
 *  - 0.03m idle bob at ~4 Hz (project_next_pass_cockpit.md)
 *  - crash shake decays ~0.25-0.35s (reference_r3f_racer_camera_spec.md:
 *    "crash: impulsive decay ~0.25 after collision")
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

/** Crash-shake peak translational amplitude, meters. */
const CRASH_AMP_XY = 0.12;
/** Crash-shake peak angular amplitude, radians (~2.5°). */
const CRASH_AMP_ANG = (2.5 * Math.PI) / 180;
/** Crash-shake exponential decay time constant, seconds. */
const CRASH_DECAY_S = 0.35;
/** Crash-shake frequency, Hz — high enough to feel violent. */
const CRASH_FREQ_HZ = 18;

export function useCockpitFeel() {
  const groupRef = useRef<THREE.Group | null>(null);
  // Smoothed roll + yaw so fast steer reversals glide instead of snap.
  const smoothedRoll = useRef(0);
  const smoothedYaw = useRef(0);
  const basePos = useRef<[number, number, number] | null>(null);

  // Crash shake — watch the store's `crashes` counter for new hits; each
  // increment loads crashShake with an impulse that decays to 0.
  const lastCrashes = useRef<number | null>(null);
  const crashShake = useRef(0);

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

    // New-crash detection — monotonic counter; first tick just seeds.
    if (lastCrashes.current === null) {
      lastCrashes.current = s.crashes;
    } else if (s.crashes > lastCrashes.current) {
      crashShake.current = 1;
      lastCrashes.current = s.crashes;
    }
    // Exponential decay toward 0.
    if (crashShake.current > 0) {
      crashShake.current *= Math.exp(-dt / CRASH_DECAY_S);
      if (crashShake.current < 0.001) crashShake.current = 0;
    }

    // Smooth targets. The exponent form `1 - exp(-k·dt)` is framerate-indep.
    const k = 1 - Math.exp(-ROLL_LERP * dt);
    smoothedRoll.current += (-steer * MAX_ROLL_RAD - smoothedRoll.current) * k;
    smoothedYaw.current += (steer * MAX_YAW_RAD - smoothedYaw.current) * k;

    // Bob: tiny idle always, plus a speed-scaled ripple on top.
    const bobGain = 1 + SPEED_BOB_GAIN * speedNorm;
    const bobY = Math.sin(t * BOB_FREQ_BASE) * BOB_AMP_Y * bobGain;
    const bobX = Math.sin(t * BOB_FREQ_X) * BOB_AMP_X * bobGain;

    // Crash shake: high-freq sines on independent channels × envelope.
    const shake = crashShake.current;
    const crashFreqRad = 2 * Math.PI * CRASH_FREQ_HZ;
    const crashX = Math.sin(t * crashFreqRad) * CRASH_AMP_XY * shake;
    const crashY = Math.cos(t * crashFreqRad * 1.13) * CRASH_AMP_XY * shake;
    const crashRoll = Math.sin(t * crashFreqRad * 0.8) * CRASH_AMP_ANG * shake;
    const crashYaw = Math.cos(t * crashFreqRad * 1.27) * CRASH_AMP_ANG * shake;

    // Apply — roll is around Z (local forward-down plane), yaw around Y.
    group.rotation.z = smoothedRoll.current + crashRoll;
    group.rotation.y = smoothedYaw.current + crashYaw;
    const [bx, by, bz] = basePos.current;
    group.position.set(bx + bobX + crashX, by + bobY + crashY, bz);
  });

  return groupRef;
}
