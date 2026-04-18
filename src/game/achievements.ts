/**
 * Achievement definitions + dispatcher. Each frame, poll the player's
 * Score; when a threshold crosses, emit an achievement event through the
 * `listeners` pub/sub so the UI can pop a toast + audio can fire a stinger.
 *
 * Persistence: first-time unlocks across all runs are written to
 * localStorage so we know which achievements the player has ever earned.
 * Toasts still fire once per run regardless of persistence — the celebratory
 * moment of crossing 100k in THIS run feels good even if it's the tenth
 * time. Crossed in PR #18 feedback: previously the implementation comment
 * was misleading about this.
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

// Cache of the persisted flag set — loaded once on first access, mutated
// on unlock. Prior version called loadFlags() every frame inside
// stepAchievements, which hit localStorage+JSON.parse at 60fps. Flagged
// in PR #18 review.
let persistentCache: Set<string> | null = null;

function getPersistent(): Set<string> {
  if (persistentCache !== null) return persistentCache;
  if (typeof localStorage === 'undefined') {
    persistentCache = new Set();
    return persistentCache;
  }
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      persistentCache = new Set();
      return persistentCache;
    }
    const arr = JSON.parse(raw) as string[];
    persistentCache = new Set(Array.isArray(arr) ? arr : []);
    return persistentCache;
  } catch {
    persistentCache = new Set();
    return persistentCache;
  }
}

function savePersistent(flags: Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  // setItem can throw on quota exceeded / private mode / storage disabled.
  // Silently skip on failure — the in-memory cache still knows about it
  // for this session, and the game keeps running. Flagged in PR #18 review.
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...flags]));
  } catch {
    // Nothing sensible to do — accept the session-only fallback.
  }
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
 *  (and persist on first-ever unlock) when crossed. Silent no-op if the
 *  player entity isn't present yet. */
export function stepAchievements(world: World): void {
  const entities = world.query(Player, Score);
  if (entities.length === 0) return;
  const e = entities[0];
  if (!e) return;
  const score = e.get(Score);
  if (!score) return;

  for (const a of ACHIEVEMENTS) {
    if (thisRunFired.has(a.id)) continue;
    if (!a.test(score)) continue;
    thisRunFired.add(a.id);
    // Always fire per-run toast — the celebration moment stands even if
    // the player has earned this before on another device/browser.
    for (const l of listeners) l(a);
    const persistent = getPersistent();
    if (!persistent.has(a.id)) {
      persistent.add(a.id);
      savePersistent(persistent);
    }
  }
}
