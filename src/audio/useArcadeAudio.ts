/**
 * React glue for the arcade audio module. Starts the Tone.js audio graph
 * on the first render AFTER a user gesture (gated by `ready`), then each
 * frame pulls Speed + Steer out of the world and updates engine + tire
 * channels. Returns `honk()` so the input layer can trigger it on space.
 */
import { useFrame } from '@react-three/fiber';
import type { World } from 'koota';
import { useCallback, useEffect, useRef } from 'react';
import { tunables } from '@/config';
import { Player, Speed, Steer } from '@/ecs/traits';
import { type ArcadeAudioHandle, startArcadeAudio } from './arcadeAudio';

export function useArcadeAudio(
  world: World,
  ready: boolean,
): {
  honk: () => void;
  ding: () => void;
  thud: () => void;
} {
  const handleRef = useRef<ArcadeAudioHandle | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    startArcadeAudio()
      .then((h) => {
        if (cancelled) {
          h.dispose();
          return;
        }
        handleRef.current = h;
        h.setMusicPlaying(true);
      })
      .catch(() => {
        // Hard-fail would surface via error modal; for audio we accept
        // silent degradation on denied AudioContext (mobile autoplay).
      });
    return () => {
      cancelled = true;
      handleRef.current?.setMusicPlaying(false);
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [ready]);

  useFrame(() => {
    const h = handleRef.current;
    if (!h) return;
    const players = world.query(Player, Speed, Steer);
    if (players.length === 0) return;
    const first = players[0];
    if (!first) return;
    const speed = first.get(Speed);
    const steer = first.get(Steer);
    if (!speed || !steer) return;
    h.updateEngine(speed.value, tunables.cruiseMps);
    h.setTireSqueal(Math.abs(steer.value) > 0.7 && speed.value > 10);
  });

  const honk = useCallback(() => {
    handleRef.current?.honk();
  }, []);
  const ding = useCallback(() => {
    handleRef.current?.pickupDing();
  }, []);
  const thud = useCallback(() => {
    handleRef.current?.hitThud();
  }, []);

  return { honk, ding, thud };
}
