/**
 * RaidBridge — owns the singleton RaidDirector instance, ticks it every
 * frame, and exposes it on `window.__mmRaidDirector` so RaidLayer can
 * read state each render. Callbacks wire raid events into:
 *   - onTelegraph → audio bed (future: swap in a sting via arcade bus)
 *   - onHeavyCrash → hapticsBus 'crash-heavy'
 *   - onLightCrash → hapticsBus 'crash-light'
 *   - onCrowdBonus → gameStore.setState({ crowdReaction })
 *
 * Lives in the R3F canvas so useFrame drives it at render tempo.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { eventsRng } from '@/game/runRngBus';
import { useGameStore } from '@/game/gameState';
import { hapticsBus } from '@/game/hapticsBus';
import { RaidDirector } from '@/game/obstacles/raidDirector';

declare global {
  interface Window {
    __mmRaidDirector?: RaidDirector;
  }
}

export function RaidBridge() {
  const directorRef = useRef<RaidDirector | null>(null);

  useEffect(() => {
    // Director is lazily created on first frame with a live run RNG so
    // deterministic replay works: the raid schedule depends only on the
    // run's events-channel entropy.
    return () => {
      delete window.__mmRaidDirector;
      directorRef.current = null;
    };
  }, []);

  useFrame(() => {
    const s = useGameStore.getState();
    if (!s.running) {
      directorRef.current?.update(
        performance.now(),
        s.distance,
        s.lateral,
        s.airborne ?? false,
        false,
        noopCallbacks,
      );
      return;
    }

    // Lazy-init on the first tick of a run so initRunRng has definitely
    // been called by gameState.startRun().
    if (!directorRef.current) {
      directorRef.current = new RaidDirector(eventsRng());
      window.__mmRaidDirector = directorRef.current;
    }

    directorRef.current.update(
      performance.now(),
      s.distance,
      s.lateral,
      s.airborne ?? false,
      true,
      {
        onTelegraph: (_kind) => {
          // Telegraph sting lives on the audio bus; wired once arcadeAudio
          // exposes a raidTelegraph() handle. For now the visual telegraph
          // from RaidLayer carries the event.
        },
        onHeavyCrash: () => {
          hapticsBus.fire('crash-heavy');
        },
        onLightCrash: () => {
          hapticsBus.fire('crash-light');
        },
        onCrowdBonus: (amount) => {
          const st = useGameStore.getState();
          useGameStore.setState({ crowdReaction: st.crowdReaction + amount });
        },
      },
    );
  });

  return null;
}

const noopCallbacks = {
  onTelegraph: () => {},
  onHeavyCrash: () => {},
  onLightCrash: () => {},
  onCrowdBonus: () => {},
};
