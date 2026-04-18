/**
 * Achievement definitions + dispatcher. Each frame, poll the player's
 * Score; when a threshold crosses, emit an achievement event through the
 * `listeners` pub/sub so the UI can pop a toast + audio can fire a stinger.
 * Flags persist in localStorage so a given achievement only fires once
 * per browser/device.
 */
import type { World } from 'koota';
import { Player, Score } from '@/ecs/traits';

export interface Achievement {
  id: string;
  title: string;
  detail: string;
  /** Returns true when this achievement is unlocked given the current Score. */
  test: (score: {
    value: number;
    balloons: number;
    damage: number;
    boostRemaining: number;
  }) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'score-100k',
    title: 'SIX FIGURES',
    detail: '100,000 score barrier crossed',
    test: (s) => s.value >= 100_000,
  },
  {
    id: 'balloons-50',
    title: 'BALLOON GLUTTON',
    detail: '50 balloons popped in one run',
    test: (s) => s.balloons >= 50,
  },
  {
    id: 'first-boost',
    title: 'NITRO DIP',
    detail: 'First boost of the run',
    test: (s) => s.boostRemaining > 0,
  },
  {
    id: 'clean-sheet',
    title: 'SPOTLESS',
    detail: '500k+ score with zero damage',
    test: (s) => s.value >= 500_000 && s.damage === 0,
  },
];

const STORE_KEY = 'mm.achievements.v1';

function loadFlags(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveFlags(flags: Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORE_KEY, JSON.stringify([...flags]));
}

type Listener = (a: Achievement) => void;

const listeners = new Set<Listener>();
export function onAchievement(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let thisRunFired = new Set<string>();
export function resetAchievementsRun(): void {
  thisRunFired = new Set();
}

/** Per-frame hook: compare Score to each achievement's test; fire listeners
 *  (and persist) when crossed. Silent no-op if the player entity isn't
 *  present yet. */
export function stepAchievements(world: World): void {
  const entities = world.query(Player, Score);
  if (entities.length === 0) return;
  const e = entities[0];
  if (!e) return;
  const score = e.get(Score);
  if (!score) return;

  const persistent = loadFlags();

  for (const a of ACHIEVEMENTS) {
    if (thisRunFired.has(a.id)) continue;
    if (!a.test(score)) continue;
    thisRunFired.add(a.id);
    // Fire even if previously persisted — the toast still feels good, but
    // we only persist first-time unlocks (no-op if already in set).
    for (const l of listeners) l(a);
    if (!persistent.has(a.id)) {
      persistent.add(a.id);
      saveFlags(persistent);
    }
  }
}
