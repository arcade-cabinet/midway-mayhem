/**
 * SpeedFX — post-FX companion for speed-feel.
 *
 * - Radial vignette pulses with speedNorm (heavier at higher speeds).
 * - Chromatic aberration spikes when boost/mega boost is active.
 *
 * Mounted inside the EffectComposer in PostFX.tsx.
 * Uses @react-three/postprocessing Vignette + ChromaticAberration.
 */

import { useFrame } from '@react-three/fiber';
import { ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useRef } from 'react';
import { Vector2 } from 'three';
import { useGameStore } from '@/game/gameState';

/** Maximum boost-aberration offset in UV units. */
const MAX_BOOST_ABERRATION = 0.004;
/** Base aberration at rest (matches PostFX baseline). */
const BASE_ABERRATION = 0.0009;
/** Vignette darkness at top speed. */
const MAX_VIGNETTE_DARKNESS = 0.72;
/** Vignette darkness at zero speed. */
const MIN_VIGNETTE_DARKNESS = 0.45;

export function SpeedFX() {
  const vignetteRef = useRef<{ darkness: number; offset: number } | null>(null);
  const aberrationRef = useRef<{ offset: Vector2 } | null>(null);
  const aberrationOffset = useRef(new Vector2(BASE_ABERRATION, BASE_ABERRATION));

  useFrame((_state, dt) => {
    const { speedMps, boostUntil, megaBoostUntil } = useGameStore.getState();
    const now = performance.now();

    const speedNorm = Math.min(1, speedMps / 120);
    const isBoosting = now < boostUntil || now < megaBoostUntil;

    // Vignette: darker at higher speeds
    const targetDarkness =
      MIN_VIGNETTE_DARKNESS + (MAX_VIGNETTE_DARKNESS - MIN_VIGNETTE_DARKNESS) * speedNorm;
    if (vignetteRef.current) {
      vignetteRef.current.darkness +=
        (targetDarkness - vignetteRef.current.darkness) * Math.min(1, dt * 3);
    }

    // Chromatic aberration: spike during boost
    const targetAberration = isBoosting
      ? BASE_ABERRATION + (MAX_BOOST_ABERRATION - BASE_ABERRATION) * speedNorm
      : BASE_ABERRATION + speedNorm * 0.0005;
    const current = aberrationOffset.current.x;
    const next = current + (targetAberration - current) * Math.min(1, dt * 4);
    aberrationOffset.current.set(next, next);
    if (aberrationRef.current) {
      aberrationRef.current.offset.copy(aberrationOffset.current);
    }
  });

  return (
    <>
      <Vignette
        // biome-ignore lint/suspicious/noExplicitAny: ref callback pattern for postprocessing effects
        ref={vignetteRef as any}
        eskil={false}
        offset={0.28}
        darkness={MIN_VIGNETTE_DARKNESS}
        blendFunction={BlendFunction.NORMAL}
      />
      <ChromaticAberration
        // biome-ignore lint/suspicious/noExplicitAny: ref callback pattern for postprocessing effects
        ref={aberrationRef as any}
        // Pass a plain tuple (not Vector2) — @react-three/postprocessing
        // JSON.stringifies this prop for useMemo invalidation and chokes on
        // Vector2's Object3D-backed structure. The real offset is driven via
        // the useFrame ref mutation above.
        offset={[BASE_ABERRATION, BASE_ABERRATION]}
        radialModulation={true}
        modulationOffset={0.5}
        blendFunction={BlendFunction.NORMAL}
      />
    </>
  );
}
