import { useRef } from 'react';
import { prefersReducedMotionNow } from './usePrefersReducedMotion';

/** Scale factor applied to all shake amplitudes when reduced-motion is active. */
const REDUCED_MOTION_SCALE = 0.2;

type ShakeChannel = 'bob' | 'speed' | 'crash';

export function useShake() {
  const channels = useRef({
    bob: { amp: 0, freq: 1.2 },
    speed: { amp: 0, freq: 8 },
    crash: { amp: 0, decay: 4 },
  });

  return {
    trigger(channel: ShakeChannel, amp: number) {
      channels.current[channel].amp = Math.max(channels.current[channel].amp, amp);
    },
    setAmp(channel: 'bob' | 'speed', amp: number) {
      channels.current[channel].amp = amp;
    },
    sample(t: number, dt: number) {
      const c = channels.current;
      const scale = prefersReducedMotionNow() ? REDUCED_MOTION_SCALE : 1;
      c.crash.amp = Math.max(0, c.crash.amp - c.crash.decay * dt);
      const y =
        Math.sin(t * c.bob.freq) * c.bob.amp * scale +
        Math.sin(t * c.speed.freq * 6.28) * c.speed.amp * 0.3 * scale +
        (Math.random() - 0.5) * c.crash.amp * scale;
      const x =
        Math.sin(t * 1.7) * c.bob.amp * 0.4 * scale +
        (Math.random() - 0.5) * c.crash.amp * 0.5 * scale;
      return { x, y };
    },
  };
}
