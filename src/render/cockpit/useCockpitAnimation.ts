/**
 * @module cockpit/useCockpitAnimation
 *
 * Per-frame animation hook for the Cockpit component.
 * Drives: root drop/plunge/trick, rig-cable visibility, body bank+shake,
 * steering-wheel rotation, ornament spin, dice wobble, fire-light flicker,
 * and smoke-particle lifecycle.
 *
 * Extracted from Cockpit.tsx to keep that file under 300 LOC.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { damageLevelFor } from '@/game/damageLevel';
import { useGameStore } from '@/game/gameState';
import { STEER } from '@/utils/constants';
import { computePlungeOffset } from './plungeMotion';

interface CockpitRefs {
  rootRef: React.RefObject<THREE.Group | null>;
  bodyRef: React.RefObject<THREE.Group | null>;
  wheelRef: React.RefObject<THREE.Group | null>;
  ornamentRef: React.RefObject<THREE.Group | null>;
  diceRef: React.RefObject<THREE.Group | null>;
  rigLeftRef: React.RefObject<THREE.Mesh | null>;
  rigRightRef: React.RefObject<THREE.Mesh | null>;
  fireLightRef: React.RefObject<THREE.PointLight | null>;
  smokeRef0: React.RefObject<THREE.Mesh | null>;
  smokeRef1: React.RefObject<THREE.Mesh | null>;
  smokeRef2: React.RefObject<THREE.Mesh | null>;
}

export function useCockpitAnimation(refs: CockpitRefs): void {
  const smokeStartT = useRef(0);

  useFrame((state) => {
    const s = useGameStore.getState();
    const t = state.clock.elapsedTime;
    const dmgLevel = damageLevelFor(s.sanity);
    const now = performance.now();

    // Drop-in + plunge animation on cockpit root.
    // Design rule: the cockpit always reads as "filling the viewport" —
    // it never floats above the track or falls below the BigTop floor. All
    // theatrics (drop-in, plunge) play out WITHIN the viewport frame.
    const root = refs.rootRef.current;
    if (root) {
      // Cap the drop-in hoist at 1.5m so the cockpit is always overlapping
      // the track; the animation becomes a gentle settle, not a plummet.
      const dp = Math.max(0, Math.min(1, s.dropProgress));
      const fall = dp < 0.75 ? (dp / 0.75) ** 2 : 1 + Math.sin((dp - 0.75) * 12) * 0.06 * (1 - dp);
      const DROP_HEIGHT = 1.5;

      if (s.plunging) {
        const elapsedS = Math.max(0, (now - s.plungeStartedAt) / 1000);
        const off = computePlungeOffset(elapsedS, s.plungeDirection);
        // Clamp plunge depth so the camera stays above ground (no void).
        // The plunge reads as a stomach-drop shake + roll rather than a
        // free-fall into blackness.
        root.position.y = Math.max(-0.8, off.y * 0.3);
        root.position.x = off.x * 0.5;
        root.rotation.x = Math.min(0.4, off.rotX * 0.5);
        root.rotation.z = off.rotZ * 0.6;
      } else {
        root.position.y = DROP_HEIGHT * (1 - fall);
        root.position.x = 0;
        root.rotation.x = 0;
        root.rotation.y = s.trickRotationY;
        if (dp < 0.1) root.rotation.z = Math.sin(t * 2) * 0.02 + s.trickRotationZ;
        else
          root.rotation.z = s.trickRotationZ + (s.trickRotationZ === 0 ? root.rotation.z * 0.9 : 0);
      }
    }

    // Rig cable visibility fades out once settled
    const rigL = refs.rigLeftRef.current;
    const rigR = refs.rigRightRef.current;
    if (rigL && rigR) {
      const visible = s.dropProgress < 0.98 && !s.plunging;
      rigL.visible = visible;
      rigR.visible = visible;
    }

    // Body bank, damage wobble, engine shake
    const body = refs.bodyRef.current;
    if (body && !s.plunging) {
      const targetYaw = -s.steer * 0.14;
      const dmgWobble = dmgLevel > 0 ? Math.sin(t * (8 + dmgLevel * 4)) * dmgLevel * 0.018 : 0;
      const targetRoll = s.steer * 0.22 + dmgWobble;
      body.rotation.y += (targetYaw - body.rotation.y) * 0.15;
      body.rotation.z += (targetRoll - body.rotation.z) * 0.15;
      const speedNorm = Math.min(1, s.speedMps / 120);
      const shakeMultiplier = dmgLevel >= 3 ? 2.0 : 1.0;
      const shakeAmp = (0.015 + speedNorm * 0.02) * shakeMultiplier;
      body.position.x = Math.sin(t * 40) * shakeAmp;
      body.position.y = Math.cos(t * 50) * shakeAmp + Math.sin(t * 130) * 0.005 * speedNorm;
    }

    // Steering wheel rotation + damage wobble
    const wh = refs.wheelRef.current;
    if (wh) {
      const wheelWobble = dmgLevel > 0 ? Math.sin(t * 12) * dmgLevel * 0.04 : 0;
      wh.rotation.z = -(s.steer * STEER.WHEEL_MAX_DEG * Math.PI) / 180 + wheelWobble;
    }

    // Hood ornament spin
    const orn = refs.ornamentRef.current;
    if (orn) orn.rotation.y = t * 3;

    // Dice wobble
    const dice = refs.diceRef.current;
    if (dice) {
      dice.rotation.z = Math.sin(t * 3) * 0.3;
      dice.rotation.x = Math.cos(t * 2) * 0.2;
    }

    // Fire light flicker (damage level >= 2)
    const fireLight = refs.fireLightRef.current;
    if (fireLight) {
      const active = dmgLevel >= 2;
      fireLight.visible = active;
      if (active) {
        fireLight.intensity = 1.2 + Math.sin(t * 23) * 0.5 + Math.sin(t * 37) * 0.3;
      }
    }

    // Smoke particle lifecycle (damage level >= 2)
    const smokes = [refs.smokeRef0.current, refs.smokeRef1.current, refs.smokeRef2.current];
    for (let i = 0; i < smokes.length; i++) {
      const mesh = smokes[i];
      if (!mesh) continue;
      const active = dmgLevel >= 2;
      mesh.visible = active;
      if (active) {
        if (smokeStartT.current === 0) smokeStartT.current = t;
        const offset = (i / 3) * 1.8;
        const elapsed = (t - smokeStartT.current + offset) % 1.8;
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
}
