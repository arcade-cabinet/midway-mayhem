/**
 * Achievement definition unit tests — pure tests on the test-predicate
 * functions. These catch regressions where someone rewords a label
 * but flips the comparison (e.g. 50 balloons → >= 50 becomes > 50).
 * Run-time dispatcher behaviour (listener fanout, localStorage
 * persistence) is covered by the persistence integration test.
 */
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '@/game/achievementRun';

interface ScoreShape {
  value: number;
  balloons: number;
  damage: number;
  boostRemaining: number;
}

function zero(overrides: Partial<ScoreShape> = {}): ScoreShape {
  return { value: 0, balloons: 0, damage: 0, boostRemaining: 0, ...overrides };
}

function achievement(id: string) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) throw new Error(`missing achievement: ${id}`);
  return a;
}

describe('ACHIEVEMENTS', () => {
  it('has unique ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    const seen = new Set(ids);
    expect(seen.size).toBe(ids.length);
  });

  it('every entry has a non-empty title + detail', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length, `empty title on ${a.id}`).toBeGreaterThan(0);
      expect(a.detail.length, `empty detail on ${a.id}`).toBeGreaterThan(0);
    }
  });

  it('score-100k fires at and above 100 000, not before', () => {
    const a = achievement('score-100k');
    expect(a.test(zero({ value: 99_999 }))).toBe(false);
    expect(a.test(zero({ value: 100_000 }))).toBe(true);
    expect(a.test(zero({ value: 200_000 }))).toBe(true);
  });

  it('balloons-50 fires at and above 50 balloons, not before', () => {
    const a = achievement('balloons-50');
    expect(a.test(zero({ balloons: 49 }))).toBe(false);
    expect(a.test(zero({ balloons: 50 }))).toBe(true);
  });

  it('first-boost fires only while boostRemaining is positive', () => {
    const a = achievement('first-boost');
    expect(a.test(zero({ boostRemaining: 0 }))).toBe(false);
    expect(a.test(zero({ boostRemaining: 1 }))).toBe(true);
    expect(a.test(zero({ boostRemaining: 0.001 }))).toBe(true);
  });

  it('clean-sheet requires BOTH score>=500k AND damage===0', () => {
    const a = achievement('clean-sheet');
    // score only → not enough
    expect(a.test(zero({ value: 500_000, damage: 1 }))).toBe(false);
    // damage-free only → not enough
    expect(a.test(zero({ value: 499_999, damage: 0 }))).toBe(false);
    // both conditions → fires
    expect(a.test(zero({ value: 500_000, damage: 0 }))).toBe(true);
  });
});
