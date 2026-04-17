/**
 * Game-over detection. Each frame, inspect the player's Score + Position
 * to decide if the run has ended:
 *   - Took 3 hits → game over (damage)
 *   - Rolled past the last track segment → run complete
 * Emits `onEnd(reason)` once; caller is responsible for ignoring further
 * events until a restart resets the Score trait.
 */
import type { World } from 'koota';
import { trackArchetypes } from '@/config';
import { Player, Position, Score } from '@/ecs/traits';

export type EndReason = 'damage' | 'finish';

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

  if (score.damage >= 3) {
    ended = true;
    cb.onEnd?.('damage');
    return;
  }
  const lastDistance = trackArchetypes.runLength * 28; // rough upper bound of a full run
  if (pos.distance > lastDistance) {
    ended = true;
    cb.onEnd?.('finish');
  }
}
