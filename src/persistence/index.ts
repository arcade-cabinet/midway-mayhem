/**
 * @/persistence — public barrel for the persistence sub-package.
 * Import from here, not from deep module paths.
 */

export type { AchievementDef, LifetimeForCheck, RunAchievementStats } from './achievementCatalog';
export type { AchievementRow, AchievementStatus } from './achievements';
export {
  ACHIEVEMENT_CATALOG,
  checkRunAchievements,
  grantAchievement,
  listAll,
  updateProgress,
} from './achievements';
export { db, initDb, persistToOpfs, resetDbForTests } from './db';
export type { LifetimeStatsRow, RunSummary } from './lifetimeStats';
export {
  getStats,
  recordRun as recordLifetimeRun,
} from './lifetimeStats';
export {
  clearPrefsForTests,
  PREF_KEYS,
  prefGetBool,
  prefGetJSON,
  prefGetString,
  prefRemove,
  prefSetBool,
  prefSetJSON,
  prefSetString,
} from './preferences';
export type { LoadoutRow, ProfileRow } from './profile';
export {
  addTickets,
  getLoadout,
  getProfile,
  grantUnlock,
  hasUnlock,
  listUnlocks,
  recordRun,
  setLoadout,
  spendTickets,
} from './profile';
export type { ReplayRow, ReplaySample } from './replay';
export {
  getBestReplayForDate,
  getRecentRuns,
  listReplaysForDate,
  replaysEqual,
  saveReplay,
} from './replay';
export * from './schema';
export type { GameSettings, PreferredControl } from './settings';
export { getSettings, SETTINGS_CHANGED_EVENT, updateSettings } from './settings';
