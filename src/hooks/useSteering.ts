import { useEffect } from 'react';
import { useGameStore } from '@/game/gameState';
import { STEER } from '@/utils/constants';
import { damp } from '@/utils/math';

/**
 * Pointer + touch steering. Mouse X mapped to normalized [-1,1]; touch drag
 * tracks relative delta. Exponential return-to-center on release.
 * NO keyboard steering (design commitment).
 */
export function useSteering(canvas: HTMLElement | null) {
  useEffect(() => {
    if (!canvas) return;

    let targetSteer = 0;
    let lastFrame = performance.now();
    let pointerDown = false;
    let pointerStartX = 0;
    let pointerStartSteer = 0;

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (!pointerDown) return;
        const dx = (e.clientX - pointerStartX) / (canvas.clientWidth * 0.35);
        targetSteer = Math.max(-1, Math.min(1, pointerStartSteer + dx));
      } else {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width; // 0..1
        targetSteer = (x - 0.5) * 2 * STEER.SENSITIVITY;
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      pointerDown = true;
      pointerStartX = e.clientX;
      pointerStartSteer = useGameStore.getState().steer;
    };
    const onPointerUp = () => {
      pointerDown = false;
      targetSteer = 0;
    };
    const onPointerLeave = () => {
      targetSteer = 0;
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointercancel', onPointerUp);

    let raf = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - lastFrame) / 1000);
      lastFrame = t;
      const current = useGameStore.getState().steer;
      const next = damp(current, targetSteer, STEER.RETURN_TAU_S, dt);
      useGameStore.getState().setSteer(next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointercancel', onPointerUp);
      cancelAnimationFrame(raf);
    };
  }, [canvas]);
}
