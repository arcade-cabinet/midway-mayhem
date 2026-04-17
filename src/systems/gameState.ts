import { create } from 'zustand';
import type { ZoneId } from '../utils/constants';

export interface GameState {
  // session
  running: boolean;
  paused: boolean;
  gameOver: boolean;
  startedAt: number;
  seed: number;

  // player
  distance: number;
  lateral: number; // player X offset from track centerline, meters
  speedMps: number;
  targetSpeedMps: number;
  steer: number; // normalized [-1,1]

  // derived gameplay stats (branded names)
  hype: number; // speed-as-percent
  sanity: number; // 0..100 health-like; reduces on hit
  crowdReaction: number; // score
  crashes: number;
  currentZone: ZoneId;

  // boost state
  boostUntil: number; // performance.now() epoch
  megaBoostUntil: number;

  // actions
  startRun(seed?: number): void;
  tick(dt: number, now: number): void;
  pause(): void;
  resume(): void;
  endRun(): void;
  applyCrash(heavy?: boolean): void;
  applyPickup(kind: 'ticket' | 'boost' | 'mega'): void;
  setSteer(v: number): void;
  setLateral(v: number): void;
}

const DEFAULTS = {
  running: false,
  paused: false,
  gameOver: false,
  startedAt: 0,
  seed: 0,
  distance: 0,
  lateral: 0,
  speedMps: 0,
  targetSpeedMps: 0,
  steer: 0,
  hype: 0,
  sanity: 100,
  crowdReaction: 0,
  crashes: 0,
  currentZone: 'midway-strip' as ZoneId,
  boostUntil: 0,
  megaBoostUntil: 0,
};

export const useGameStore = create<GameState>((set, get) => ({
  ...DEFAULTS,

  startRun(seed = Math.floor(Math.random() * 2 ** 31)) {
    set({
      ...DEFAULTS,
      running: true,
      paused: false,
      gameOver: false,
      seed,
      startedAt: performance.now(),
      targetSpeedMps: 30,
      speedMps: 0,
    });
  },

  tick(dt, now) {
    const s = get();
    if (!s.running || s.paused || s.gameOver) return;

    // Speed interpolation toward target; target climbs slowly over time.
    const CRUISE = 70;
    const BOOST = 90;
    const MEGA = 120;
    let target = Math.min(CRUISE, 30 + s.distance * 0.005);
    if (now < s.boostUntil) target = BOOST;
    if (now < s.megaBoostUntil) target = MEGA;
    const speed = s.speedMps + (target - s.speedMps) * Math.min(1, dt * 1.3);
    const distance = s.distance + speed * dt;
    const hype = (speed / MEGA) * 100;

    // Zone derivation (simple cycle every 450 units across 4 zones)
    const zIdx = Math.floor(distance / 450) % 4;
    const currentZone: ZoneId =
      (['midway-strip', 'balloon-alley', 'ring-of-fire', 'funhouse-frenzy'] as const)[zIdx] ??
      'midway-strip';

    // Sanity regen slowly
    const sanity = Math.min(100, s.sanity + dt * 2);

    set({ speedMps: speed, targetSpeedMps: target, distance, hype, sanity, currentZone });

    // Game over when sanity exhausted
    if (sanity <= 0) set({ running: false, gameOver: true });
  },

  pause() {
    set({ paused: true });
  },

  resume() {
    set({ paused: false });
  },

  endRun() {
    set({ running: false, gameOver: true });
  },

  applyCrash(heavy = false) {
    const s = get();
    const sanity = Math.max(0, s.sanity - (heavy ? 25 : 10));
    set({
      sanity,
      crashes: s.crashes + 1,
      speedMps: s.speedMps * 0.55,
      gameOver: sanity <= 0,
      running: sanity > 0,
    });
  },

  applyPickup(kind) {
    const s = get();
    const now = performance.now();
    if (kind === 'ticket') {
      set({ crowdReaction: s.crowdReaction + 50 });
    } else if (kind === 'boost') {
      set({ boostUntil: now + 2200, crowdReaction: s.crowdReaction + 25 });
    } else if (kind === 'mega') {
      set({ megaBoostUntil: now + 3500, crowdReaction: s.crowdReaction + 200 });
    }
  },

  setSteer(v) {
    set({ steer: Math.max(-1, Math.min(1, v)) });
  },
  setLateral(v) {
    set({ lateral: v });
  },
}));

export function resetGameState() {
  useGameStore.setState({ ...DEFAULTS });
}
