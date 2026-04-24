/**
 * persistence/index unit tests — barrel re-export surface.
 * Guards against accidental drops that would break importers.
 */
import { describe, expect, it } from 'vitest';
import * as persistence from '@/persistence';

describe('persistence barrel exports', () => {
  it('re-exports ACHIEVEMENT_CATALOG + grantAchievement family', () => {
    expect(persistence.ACHIEVEMENT_CATALOG).toBeDefined();
    expect(typeof persistence.checkRunAchievements).toBe('function');
    expect(typeof persistence.grantAchievement).toBe('function');
    expect(typeof persistence.listAll).toBe('function');
    expect(typeof persistence.updateProgress).toBe('function');
  });

  it('re-exports db lifecycle functions', () => {
    expect(typeof persistence.db).toBe('function');
    expect(typeof persistence.initDb).toBe('function');
    expect(typeof persistence.persistToOpfs).toBe('function');
    expect(typeof persistence.resetDbForTests).toBe('function');
  });

  it('re-exports lifetimeStats helpers', () => {
    expect(typeof persistence.getStats).toBe('function');
    expect(typeof persistence.recordLifetimeRun).toBe('function');
  });

  it('re-exports preferences KV helpers', () => {
    expect(typeof persistence.clearPrefsForTests).toBe('function');
    expect(persistence.PREF_KEYS).toBeDefined();
    expect(typeof persistence.prefGetBool).toBe('function');
    expect(typeof persistence.prefGetJSON).toBe('function');
    expect(typeof persistence.prefGetString).toBe('function');
    expect(typeof persistence.prefRemove).toBe('function');
    expect(typeof persistence.prefSetBool).toBe('function');
    expect(typeof persistence.prefSetJSON).toBe('function');
    expect(typeof persistence.prefSetString).toBe('function');
  });

  it('re-exports profile helpers', () => {
    for (const fn of [
      'addTickets',
      'getLoadout',
      'getProfile',
      'grantUnlock',
      'hasUnlock',
      'listUnlocks',
      'recordRun',
      'setLoadout',
      'spendTickets',
    ] as const) {
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: test-only re-export coverage; tree-shaking doesn't apply to vitest runs
      expect(typeof persistence[fn]).toBe('function');
    }
  });

  it('re-exports replay helpers', () => {
    expect(typeof persistence.getBestReplayForDate).toBe('function');
    expect(typeof persistence.listReplaysForDate).toBe('function');
    expect(typeof persistence.replaysEqual).toBe('function');
    expect(typeof persistence.saveReplay).toBe('function');
  });

  it('re-exports settings helpers', () => {
    expect(typeof persistence.getSettings).toBe('function');
    expect(typeof persistence.updateSettings).toBe('function');
    expect(persistence.SETTINGS_CHANGED_EVENT).toBeDefined();
  });

  it('re-exports the Drizzle schema (* from ./schema)', () => {
    expect(persistence.profile).toBeDefined();
    expect(persistence.unlocks).toBeDefined();
    expect(persistence.loadout).toBeDefined();
    expect(persistence.dailyRuns).toBeDefined();
    expect(persistence.replays).toBeDefined();
    expect(persistence.achievements).toBeDefined();
    expect(persistence.lifetimeStats).toBeDefined();
  });
});
