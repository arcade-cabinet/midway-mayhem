/**
 * Reads the live track pitch each frame and returns a smoothed cockpit
 * rotation-X value that makes the descent feel like a genuine fall.
 *
 * The smoothed value is stored in a ref so it survives across renders
 * without triggering re-renders. The caller applies it as an extra
 * rotation-X on the cockpit-body group, additive on top of useCockpitFeel.
 *
 * Test seam: if `window.__mmTrackPitchOverride` is set (a number), the hook
 * reads that instead of the live diagnostics bus. Only used by browser tests
 * that cannot spy on ESM module exports.
 */
import { useFrame } from '@react-three/fiber';
import { type MutableRefObject, useRef } from 'react';
import { getCurrentPiecePitch } from '@/game/diagnosticsBus';
import { getCockpitDescentPitch, smoothDescentPitch } from './cockpitDescentPitch';

declare global {
  interface Window {
    /** Test seam: override the track pitch read by useCockpitDescentPitch. */
    __mmTrackPitchOverride?: number | undefined;
  }
}

/**
 * Returns a ref whose `.current` value is the smoothed cockpit rotation-X
 * (radians) derived from the current track pitch. Negative on a plunge,
 * positive on a climb, decays back to zero on flat within ~0.5 s.
 *
 * The value is written imperatively in useFrame — callers read it in their
 * own useFrame (ordering handled by R3F's render queue) or from a ref.
 *
 * Signature returns the smoothed number directly so the caller stays
 * decoupled from refs and DOM assumptions.
 */
export function useCockpitDescentPitch(): MutableRefObject<number> {
  const smoothedRef = useRef(0);

  useFrame((_state, dt) => {
    const override = typeof window !== 'undefined' ? window.__mmTrackPitchOverride : undefined;
    const trackPitch = override !== undefined ? override : getCurrentPiecePitch();
    const target = getCockpitDescentPitch(trackPitch);
    smoothedRef.current = smoothDescentPitch(smoothedRef.current, target, dt);
  });

  return smoothedRef;
}
