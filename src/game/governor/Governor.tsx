import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/game/gameState';
import { GovernorDriver } from './GovernorDriver';

/**
 * R3F component that injects Governor steering input when ?governor=1 is set.
 * Must live inside <Canvas> because useFrame is R3F-scoped.
 */
export function Governor() {
  const enabled = useRef(false);
  const driverRef = useRef(new GovernorDriver());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    enabled.current = params.get('governor') === '1';
    if (enabled.current) {
      // biome-ignore lint/suspicious/noExplicitAny: test hook
      (window as any).__mmGovernor = driverRef.current;
    }
  }, []);

  useFrame((_, dt) => {
    if (!enabled.current) return;
    const s = useGameStore.getState();
    if (!s.running) return;
    // biome-ignore lint/suspicious/noExplicitAny: diag
    const spawner = (window as any).__mmSpawner;
    if (!spawner) return;
    const obstacles = spawner.getObstacles();
    const pickups = spawner.getPickups();
    const result = driverRef.current.step(
      { playerD: s.distance, playerLateral: s.lateral, obstacles, pickups },
      dt,
    );
    useGameStore.getState().setSteer(result.steer);
  });

  return null;
}
