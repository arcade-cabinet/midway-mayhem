/**
 * @/persistence — public barrel for the persistence sub-package.
 * Import from here, not from deep module paths.
 */
export { db, initDb, persistToOpfs, resetDbForTests } from './db';
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
  listReplaysForDate,
  replaysEqual,
  saveReplay,
} from './replay';
export * from './schema';
