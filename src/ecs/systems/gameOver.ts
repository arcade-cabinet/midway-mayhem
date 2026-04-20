/**
 * Game-over detection. Each frame, inspect the player's Score + Position
 * + RunSession to decide if the run has ended:
 *   - Took 3 hits (Score.damage >= 3) OR sanity hit zero → 'damage'
 *   - Plunged off track (RunSession.gameOver set by gameStateTick plunge
 *     path, Score.damage still below threshold) → 'plunge'
 *   - Rolled past the last track segment → 'finish'
 * Emits `onEnd(reason)` once; caller is responsible for ignoring further
 * events until a restart resets the traits.
 */
import type { World } from 'koota';
import { trackArchetypes } from '@/config';
import { Player, Position, RunSession, Score } from '@/ecs/traits';

export type EndReason = 'damage' | 'plunge' | 'finish';

/** Max damage hits before a run ends by the crash path. */
const DAMAGE_THRESHOLD = 3;
/** Approximate upper-bound distance for the full run — runLength × typical piece length. */
const TYPICAL_PIECE_LENGTH_M = 28;

interface GameOverCallbacks {
  onEnd?: (reason: EndReason) => void;
}

let ended = false;

export function resetGameOver(): void {
  ended = false;
}

export function stepGameOver(world: World, cb: GameOverCallbacks = {}): void {
  if (ended) return;
  const players = world.query(Player, Score, Position);
  if (players.length === 0) return;
  const pe = players[0];
  if (!pe) return;
  const score = pe.get(Score);
  const pos = pe.get(Position);
  if (!score || !pos) return;

  // Damage path — authoritative counter reaches threshold.
  if (score.damage >= DAMAGE_THRESHOLD) {
    ended = true;
    cb.onEnd?.('damage');
    return;
  }

  // RunSession.gameOver can be set by:
  //   - applyCrashAction (sanity→0 without hitting damage threshold)
  //   - gameStateTick plunge path (off-track)
  //   - gameState end() helper (explicit stop)
  // Only the plunge path fires before damage accrual; the other two are
  // already downstream of damage or explicit. Treat it as 'plunge' so
  // downstream UX (overlay copy, telemetry) can distinguish "fell off the
  // track" from "crashed into things."
  const rs = pe.get(RunSession);
  if (rs?.gameOver === true) {
    ended = true;
    cb.onEnd?.('plunge');
    return;
  }

  const lastDistance = trackArchetypes.runLength * TYPICAL_PIECE_LENGTH_M;
  if (pos.distance > lastDistance) {
    ended = true;
    cb.onEnd?.('finish');
  }
}
