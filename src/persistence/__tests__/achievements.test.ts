import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetAchievementBusForTests, subscribeAchievements } from '@/game/achievementBus';
import type { LifetimeForCheck, RunAchievementStats } from '../achievements';
import {
  ACHIEVEMENT_CATALOG,
  checkRunAchievements,
  grantAchievement,
  listAll,
  updateProgress,
} from '../achievements';
import { initDb, resetDbForTests } from '../db';

const EMPTY_RUN: RunAchievementStats = {
  distance: 0,
  crowd: 0,
  crashes: 0,
  maxCombo: 0,
  scaresThisRun: 0,
  raidsSurvived: 0,
  plunged: false,
  secondsThisRun: 10,
};

const EMPTY_LIFETIME: LifetimeForCheck = {
  totalDistanceCm: 0,
  totalRunsCompleted: 0,
  totalScares: 0,
  longestComboChain: 0,
  maxSingleRunCrowd: 0,
  totalGameOversByPlunge: 0,
};

beforeEach(async () => {
  await resetDbForTests();
  await initDb();
  resetAchievementBusForTests();
});

afterEach(async () => {
  await resetDbForTests();
  resetAchievementBusForTests();
});

describe('ACHIEVEMENT_CATALOG', () => {
  it('has exactly 20 entries', () => {
    expect(ACHIEVEMENT_CATALOG.length).toBe(20);
  });

  it('all slugs are unique', () => {
    const slugs = ACHIEVEMENT_CATALOG.map((a) => a.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it('all targetValues are >= 1', () => {
    for (const a of ACHIEVEMENT_CATALOG) {
      expect(a.targetValue).toBeGreaterThanOrEqual(1);
    }
  });

  it('all entries have non-empty title, description, slug', () => {
    for (const a of ACHIEVEMENT_CATALOG) {
      expect(a.slug.length).toBeGreaterThan(0);
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
    }
  });
});

describe('grantAchievement', () => {
  it('grants an achievement and marks it unlocked', async () => {
    await grantAchievement('first-run');
    const list = await listAll();
    const entry = list.find((a) => a.slug === 'first-run');
    expect(entry?.unlockedAt).not.toBeNull();
    expect(entry?.unlockedAt).toBeGreaterThan(0);
  });

  it('is idempotent — second grant does not change unlocked_at', async () => {
    await grantAchievement('first-run');
    const list1 = await listAll();
    const at1 = list1.find((a) => a.slug === 'first-run')?.unlockedAt;

    // Small wait to ensure timestamps would differ if not idempotent
    await new Promise((r) => setTimeout(r, 5));

    await grantAchievement('first-run');
    const list2 = await listAll();
    const at2 = list2.find((a) => a.slug === 'first-run')?.unlockedAt;

    expect(at1).toBe(at2);
  });

  it('publishes to achievementBus on first grant', async () => {
    const events: string[] = [];
    subscribeAchievements((e) => events.push(e.slug));

    await grantAchievement('first-run');
    expect(events).toContain('first-run');
  });

  it('does NOT re-publish on idempotent re-grant', async () => {
    await grantAchievement('first-run'); // first real grant

    const events: string[] = [];
    subscribeAchievements((e) => events.push(e.slug));

    await grantAchievement('first-run'); // idempotent — should NOT fire
    expect(events).toHaveLength(0);
  });
});

describe('updateProgress', () => {
  it('creates a row with the given progress value', async () => {
    await updateProgress('lifetime-10km', 500000);
    const list = await listAll();
    const entry = list.find((a) => a.slug === 'lifetime-10km');
    expect(entry?.progressValue).toBe(500000);
    expect(entry?.unlockedAt).toBeNull(); // not yet unlocked
  });

  it('overwrites existing progress', async () => {
    await updateProgress('lifetime-10km', 200000);
    await updateProgress('lifetime-10km', 750000);
    const list = await listAll();
    const entry = list.find((a) => a.slug === 'lifetime-10km');
    expect(entry?.progressValue).toBe(750000);
  });
});

describe('listAll', () => {
  it('returns all catalog entries even when no DB rows exist', async () => {
    const list = await listAll();
    expect(list.length).toBe(ACHIEVEMENT_CATALOG.length);
  });

  it('locked achievements have null unlockedAt and 0 progress', async () => {
    const list = await listAll();
    for (const entry of list) {
      expect(entry.unlockedAt).toBeNull();
      expect(entry.progressValue).toBe(0);
    }
  });
});

describe('checkRunAchievements — predicate evaluation', () => {
  it('grants first-run when totalRunsCompleted >= 1', async () => {
    const lifetime: LifetimeForCheck = { ...EMPTY_LIFETIME, totalRunsCompleted: 1 };
    await checkRunAchievements(EMPTY_RUN, lifetime);
    const list = await listAll();
    expect(list.find((a) => a.slug === 'first-run')?.unlockedAt).not.toBeNull();
  });

  it('grants first-1km when distance >= 1000', async () => {
    const run: RunAchievementStats = { ...EMPTY_RUN, distance: 1200 };
    await checkRunAchievements(run, { ...EMPTY_LIFETIME, totalRunsCompleted: 1 });
    const list = await listAll();
    expect(list.find((a) => a.slug === 'first-1km')?.unlockedAt).not.toBeNull();
  });

  it('does not grant first-1km when distance < 1000', async () => {
    const run: RunAchievementStats = { ...EMPTY_RUN, distance: 500 };
    await checkRunAchievements(run, EMPTY_LIFETIME);
    const list = await listAll();
    expect(list.find((a) => a.slug === 'first-1km')?.unlockedAt).toBeNull();
  });

  it('grants combo-8x when maxCombo >= 15', async () => {
    const run: RunAchievementStats = { ...EMPTY_RUN, maxCombo: 15 };
    await checkRunAchievements(run, EMPTY_LIFETIME);
    const list = await listAll();
    expect(list.find((a) => a.slug === 'combo-8x')?.unlockedAt).not.toBeNull();
  });

  it('grants scare-10-in-run when scaresThisRun >= 10', async () => {
    const run: RunAchievementStats = { ...EMPTY_RUN, scaresThisRun: 10 };
    await checkRunAchievements(run, EMPTY_LIFETIME);
    const list = await listAll();
    expect(list.find((a) => a.slug === 'scare-10-in-run')?.unlockedAt).not.toBeNull();
  });

  it('grants plunge-survivor when totalGameOversByPlunge >= 1', async () => {
    await checkRunAchievements(
      { ...EMPTY_RUN, plunged: true },
      { ...EMPTY_LIFETIME, totalGameOversByPlunge: 1 },
    );
    const list = await listAll();
    expect(list.find((a) => a.slug === 'plunge-survivor')?.unlockedAt).not.toBeNull();
  });

  it('checkRunAchievements is idempotent across multiple calls', async () => {
    const run: RunAchievementStats = { ...EMPTY_RUN, distance: 1200 };
    const lifetime: LifetimeForCheck = { ...EMPTY_LIFETIME, totalRunsCompleted: 1 };

    await checkRunAchievements(run, lifetime);
    await checkRunAchievements(run, lifetime);

    const list = await listAll();
    const entry = list.find((a) => a.slug === 'first-1km');
    // Still exactly one unlock
    expect(entry?.unlockedAt).not.toBeNull();
  });
});
