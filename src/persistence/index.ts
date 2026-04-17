/**
 * @/persistence — public barrel for the persistence sub-package.
 * Import from here, not from deep module paths.
 */
export { initDb, resetDbForTests, db, persistToOpfs } from './db';
export * from './schema';
export {
  getProfile,
  addTickets,
  spendTickets,
  recordRun,
  grantUnlock,
  hasUnlock,
  listUnlocks,
  getLoadout,
  setLoadout,
} from './profile';
export type { ProfileRow, LoadoutRow } from './profile';
export {
  saveReplay,
  listReplaysForDate,
  getBestReplayForDate,
  replaysEqual,
} from './replay';
export type { ReplaySample, ReplayRow } from './replay';
export {
  prefSetString,
  prefGetString,
  prefSetJSON,
  prefGetJSON,
  prefSetBool,
  prefGetBool,
  prefRemove,
  clearPrefsForTests,
  PREF_KEYS,
} from './preferences';
