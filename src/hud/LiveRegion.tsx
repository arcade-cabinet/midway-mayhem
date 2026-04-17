/**
 * @component LiveRegion
 *
 * Visually-hidden `aria-live="polite"` div that announces important game
 * events to screen-reader users:
 *   - Zone transitions: "Entering Balloon Alley"
 *   - Crash: "Crash! Sanity 75"
 *   - Game over: "Run over. Distance 1200m. Crowd score 4500."
 *   - Achievement: "Achievement unlocked: One Kilometre Clown"
 *
 * Throttled to one announcement per 800ms to avoid spam.
 * Subscribes to gameStore (zone/crash/game-over) and achievementBus.
 */

import { useEffect, useRef, useState } from 'react';
import { subscribeAchievements } from '@/game/achievementBus';
import { useGameStore } from '@/game/gameState';

const THROTTLE_MS = 800;

/** Visually-hidden style — element is present in the DOM but not displayed. */
const HIDDEN_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
};

export function LiveRegion() {
  const [message, setMessage] = useState('');
  const lastAt = useRef(0);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function announce(text: string) {
    const now = Date.now();
    const elapsed = now - lastAt.current;

    if (elapsed >= THROTTLE_MS) {
      lastAt.current = now;
      // Reset to empty first so the same text re-announces after throttle
      setMessage('');
      requestAnimationFrame(() => setMessage(text));
    } else {
      // Queue for after throttle window
      if (pendingRef.current !== null) clearTimeout(pendingRef.current);
      pendingRef.current = setTimeout(() => {
        lastAt.current = Date.now();
        setMessage('');
        requestAnimationFrame(() => setMessage(text));
      }, THROTTLE_MS - elapsed);
    }
  }

  // Zone transitions
  const currentZone = useGameStore((s) => s.currentZone);
  const prevZoneRef = useRef(currentZone);
  useEffect(() => {
    if (currentZone !== prevZoneRef.current) {
      prevZoneRef.current = currentZone;
      announce(`Entering ${zoneName(currentZone)}`);
    }
  }, [currentZone, announce]);

  // Crashes
  const crashes = useGameStore((s) => s.crashes);
  const sanity = useGameStore((s) => s.sanity);
  const prevCrashesRef = useRef(crashes);
  useEffect(() => {
    if (crashes > prevCrashesRef.current) {
      prevCrashesRef.current = crashes;
      announce(`Crash! Sanity ${Math.round(sanity)}`);
    }
  }, [crashes, sanity, announce]);

  // Game over
  const gameOver = useGameStore((s) => s.gameOver);
  const distance = useGameStore((s) => s.distance);
  const crowd = useGameStore((s) => s.crowdReaction);
  const prevGameOverRef = useRef(gameOver);
  useEffect(() => {
    if (gameOver && !prevGameOverRef.current) {
      prevGameOverRef.current = true;
      announce(`Run over. Distance ${Math.round(distance)}m. Crowd score ${Math.round(crowd)}.`);
    }
    if (!gameOver) prevGameOverRef.current = false;
  }, [gameOver, distance, crowd, announce]);

  // Achievements
  useEffect(() => {
    return subscribeAchievements((ev) => {
      announce(`Achievement unlocked: ${ev.title}`);
    });
  }, [announce]);

  // Cleanup pending timeout on unmount
  useEffect(() => {
    return () => {
      if (pendingRef.current !== null) clearTimeout(pendingRef.current);
    };
  }, []);

  return (
    <div data-testid="live-region" aria-live="polite" aria-atomic="true" style={HIDDEN_STYLE}>
      {message}
    </div>
  );
}

/** Human-readable zone names for announcements. */
function zoneName(zoneId: string): string {
  const names: Record<string, string> = {
    start: 'the Starting Gate',
    balloon_alley: 'Balloon Alley',
    mirror_maze: 'Mirror Maze',
    cannon_row: 'Cannon Row',
    barker_stretch: 'Barker Stretch',
    finish: 'the Finish Line',
  };
  return names[zoneId] ?? zoneId.replace(/_/g, ' ');
}
