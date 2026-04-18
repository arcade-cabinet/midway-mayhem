/**
 * @module game/useGameSystems
 *
 * @deprecated Replaced by dedicated bridge components in src/app/:
 *   - GimmickBridge   — BalloonSpawner, MirrorDuplicator, TrickSystem, zone subscription
 *   - RaidBridge      — RaidDirector (already in App.tsx)
 *   - GameLoop        — replay sampling, ghost recorder, game-over detection
 *   - gameState.endRun— run persistence (profile, lifetime stats, finishAndMaybeSave)
 *
 * This hook is retained as a no-op shell so any remaining import sites compile
 * without change. Remove call sites gradually, then delete this file.
 */
import type { StartRunOptions } from './gameState';

// biome-ignore lint/suspicious/noExplicitAny: legacy parameter shape retained for compat
export function useGameSystems(_startRun: (opts?: StartRunOptions) => void): void {
  // All responsibilities have been redistributed. This hook is intentionally
  // empty — see module doc above for where each piece now lives.
}
