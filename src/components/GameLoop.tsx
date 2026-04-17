import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { reportFrame } from '../systems/diagnosticsBus';
import { useGameStore } from '../systems/gameState';
import { STEER } from '../utils/constants';
import { damp } from '../utils/math';

export function GameLoop() {
  const last = useRef(performance.now());

  useFrame(() => {
    const now = performance.now();
    const dt = Math.min(0.066, (now - last.current) / 1000);
    last.current = now;

    const s = useGameStore.getState();
    if (s.running && !s.paused && !s.gameOver) {
      // integrate lateral from steer input
      const target = s.steer * STEER.MAX_LATERAL_MPS;
      const nextLateral = damp(s.lateral, s.lateral + target * dt * 0.5, 0.18, dt);
      useGameStore.getState().setLateral(nextLateral);
      s.tick(dt, now);
    }
    reportFrame(dt);
  });

  return null;
}
