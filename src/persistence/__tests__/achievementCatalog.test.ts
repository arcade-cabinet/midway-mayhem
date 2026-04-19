/**
 * achievementCatalog unit tests — structural invariants + spot-check
 * every predicate fires on the matching stats + does NOT fire on zeros.
 */
import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_CATALOG,
  type LifetimeForCheck,
  type RunAchievementStats,
} from '@/persistence/achievementCatalog';

const ZERO_RUN: RunAchievementStats = {
  distance: 0,
  crowd: 0,
  crashes: 0,
  maxCombo: 0,
  scaresThisRun: 0,
  raidsSurvived: 0,
  plunged: false,
  secondsThisRun: 0,
};

const ZERO_LIFETIME: LifetimeForCheck = {
  totalDistanceCm: 0,
  totalRunsCompleted: 0,
  totalScares: 0,
  longestComboChain: 0,
  maxSingleRunCrowd: 0,
  totalGameOversByPlunge: 0,
};

describe('ACHIEVEMENT_CATALOG structure', () => {
  it('has at least 20 entries', () => {
    expect(ACHIEVEMENT_CATALOG.length).toBeGreaterThanOrEqual(20);
  });

  it('every entry has non-empty slug/title/description', () => {
    for (const a of ACHIEVEMENT_CATALOG) {
      expect(a.slug.length).toBeGreaterThan(0);
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
    }
  });

  it('slugs are unique', () => {
    const slugs = ACHIEVEMENT_CATALOG.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('slugs are kebab-case', () => {
    const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const a of ACHIEVEMENT_CATALOG) expect(a.slug).toMatch(kebab);
  });

  it('targetValues are positive finite numbers', () => {
    for (const a of ACHIEVEMENT_CATALOG) {
      expect(a.targetValue).toBeGreaterThan(0);
      expect(Number.isFinite(a.targetValue)).toBe(true);
    }
  });

  it('every predicate is a function', () => {
    for (const a of ACHIEVEMENT_CATALOG) {
      expect(typeof a.predicate).toBe('function');
    }
  });

  it('no predicate grants at the zero-state', () => {
    for (const a of ACHIEVEMENT_CATALOG) {
      // 'perfect-ramp' requires crashes=0 & distance>=200 — zero-state distance=0 fails it.
      // 'no-crash-1km' requires distance>=1000 — zero fails.
      // None should pass with entirely zero state.
      expect(a.predicate(ZERO_RUN, ZERO_LIFETIME)).toBe(false);
    }
  });
});

function findBySlug(slug: string) {
  const a = ACHIEVEMENT_CATALOG.find((x) => x.slug === slug);
  if (!a) throw new Error(`Missing catalog slug: ${slug}`);
  return a;
}

describe('predicate spot checks', () => {
  it('first-run: fires when lifetime.totalRunsCompleted ≥ 1', () => {
    const a = findBySlug('first-run');
    expect(a.predicate(ZERO_RUN, { ...ZERO_LIFETIME, totalRunsCompleted: 1 })).toBe(true);
  });

  it('first-1km: fires when run.distance ≥ 1000', () => {
    const a = findBySlug('first-1km');
    expect(a.predicate({ ...ZERO_RUN, distance: 1000 }, ZERO_LIFETIME)).toBe(true);
    expect(a.predicate({ ...ZERO_RUN, distance: 999 }, ZERO_LIFETIME)).toBe(false);
  });

  it('first-5km: fires only at ≥5000m', () => {
    const a = findBySlug('first-5km');
    expect(a.predicate({ ...ZERO_RUN, distance: 4999 }, ZERO_LIFETIME)).toBe(false);
    expect(a.predicate({ ...ZERO_RUN, distance: 5000 }, ZERO_LIFETIME)).toBe(true);
  });

  it('lifetime-10km: fires at totalDistanceCm ≥ 1,000,000', () => {
    const a = findBySlug('lifetime-10km');
    expect(a.predicate(ZERO_RUN, { ...ZERO_LIFETIME, totalDistanceCm: 1_000_000 })).toBe(true);
  });

  it('scare-5-in-run + scare-10-in-run gate on scaresThisRun', () => {
    const five = findBySlug('scare-5-in-run');
    const ten = findBySlug('scare-10-in-run');
    expect(five.predicate({ ...ZERO_RUN, scaresThisRun: 5 }, ZERO_LIFETIME)).toBe(true);
    expect(ten.predicate({ ...ZERO_RUN, scaresThisRun: 9 }, ZERO_LIFETIME)).toBe(false);
    expect(ten.predicate({ ...ZERO_RUN, scaresThisRun: 10 }, ZERO_LIFETIME)).toBe(true);
  });

  it('scare-50-lifetime: fires at lifetime.totalScares ≥ 50', () => {
    const a = findBySlug('scare-50-lifetime');
    expect(a.predicate(ZERO_RUN, { ...ZERO_LIFETIME, totalScares: 50 })).toBe(true);
  });

  it('survive-tiger + survive-3-raids gate on raidsSurvived', () => {
    const t = findBySlug('survive-tiger');
    const three = findBySlug('survive-3-raids');
    expect(t.predicate({ ...ZERO_RUN, raidsSurvived: 1 }, ZERO_LIFETIME)).toBe(true);
    expect(three.predicate({ ...ZERO_RUN, raidsSurvived: 2 }, ZERO_LIFETIME)).toBe(false);
    expect(three.predicate({ ...ZERO_RUN, raidsSurvived: 3 }, ZERO_LIFETIME)).toBe(true);
  });

  it('combo-4x: fires at maxCombo chain ≥ 7 (not raw multiplier 4)', () => {
    const a = findBySlug('combo-4x');
    expect(a.predicate({ ...ZERO_RUN, maxCombo: 6 }, ZERO_LIFETIME)).toBe(false);
    expect(a.predicate({ ...ZERO_RUN, maxCombo: 7 }, ZERO_LIFETIME)).toBe(true);
  });

  it('combo-8x: fires at maxCombo chain ≥ 15', () => {
    const a = findBySlug('combo-8x');
    expect(a.predicate({ ...ZERO_RUN, maxCombo: 14 }, ZERO_LIFETIME)).toBe(false);
    expect(a.predicate({ ...ZERO_RUN, maxCombo: 15 }, ZERO_LIFETIME)).toBe(true);
  });

  it('combo-lifetime-8: fires at lifetime.longestComboChain ≥ 15', () => {
    const a = findBySlug('combo-lifetime-8');
    expect(a.predicate(ZERO_RUN, { ...ZERO_LIFETIME, longestComboChain: 15 })).toBe(true);
  });

  it('crowd-500 / crowd-1000 gate on run.crowd', () => {
    const five = findBySlug('crowd-500');
    const thousand = findBySlug('crowd-1000');
    expect(five.predicate({ ...ZERO_RUN, crowd: 500 }, ZERO_LIFETIME)).toBe(true);
    expect(thousand.predicate({ ...ZERO_RUN, crowd: 999 }, ZERO_LIFETIME)).toBe(false);
    expect(thousand.predicate({ ...ZERO_RUN, crowd: 1000 }, ZERO_LIFETIME)).toBe(true);
  });

  it('perfect-ramp: requires crashes=0 AND distance ≥ 200', () => {
    const a = findBySlug('perfect-ramp');
    expect(a.predicate({ ...ZERO_RUN, crashes: 0, distance: 199 }, ZERO_LIFETIME)).toBe(false);
    expect(a.predicate({ ...ZERO_RUN, crashes: 0, distance: 200 }, ZERO_LIFETIME)).toBe(true);
    expect(a.predicate({ ...ZERO_RUN, crashes: 1, distance: 500 }, ZERO_LIFETIME)).toBe(false);
  });

  it('no-crash-1km: requires crashes=0 AND distance ≥ 1000', () => {
    const a = findBySlug('no-crash-1km');
    expect(a.predicate({ ...ZERO_RUN, crashes: 0, distance: 1000 }, ZERO_LIFETIME)).toBe(true);
    expect(a.predicate({ ...ZERO_RUN, crashes: 1, distance: 5000 }, ZERO_LIFETIME)).toBe(false);
  });

  it('plunge-survivor: fires at lifetime.totalGameOversByPlunge ≥ 1', () => {
    const a = findBySlug('plunge-survivor');
    expect(a.predicate(ZERO_RUN, { ...ZERO_LIFETIME, totalGameOversByPlunge: 1 })).toBe(true);
  });

  it('ten-runs + fifty-runs gate on lifetime.totalRunsCompleted', () => {
    const ten = findBySlug('ten-runs');
    const fifty = findBySlug('fifty-runs');
    expect(ten.predicate(ZERO_RUN, { ...ZERO_LIFETIME, totalRunsCompleted: 10 })).toBe(true);
    expect(fifty.predicate(ZERO_RUN, { ...ZERO_LIFETIME, totalRunsCompleted: 49 })).toBe(false);
    expect(fifty.predicate(ZERO_RUN, { ...ZERO_LIFETIME, totalRunsCompleted: 50 })).toBe(true);
  });

  it('all-zones: fires at run.distance ≥ 1800 (full zone cycle)', () => {
    const a = findBySlug('all-zones');
    expect(a.predicate({ ...ZERO_RUN, distance: 1800 }, ZERO_LIFETIME)).toBe(true);
    expect(a.predicate({ ...ZERO_RUN, distance: 1799 }, ZERO_LIFETIME)).toBe(false);
  });
});
