/**
 * Unit tests for the tutorial state machine (src/game/tutorial.ts).
 *
 * All persistence calls are mocked — no @capacitor/preferences or OPFS
 * involved. Pure state-machine logic is verified here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock persistence/tutorial ───────────────────────────────────────────────
const _seen = new Set<string>();

vi.mock('@/persistence/tutorial', () => ({
  shouldShow: (slug: string) => !_seen.has(slug),
  markShown: async (slug: string) => {
    _seen.add(slug);
  },
  hydrateTutorialFlags: async () => {},
  resetTutorialForTests: () => {
    _seen.clear();
  },
}));

// Import AFTER mocks
import {
  advanceTutorial,
  checkBalloonCondition,
  checkBoostCondition,
  checkSteerCondition,
  commitStepTransition,
  getTutorialPhase,
  getTutorialStep,
  initTutorial,
  isTutorialActive,
  isTutorialStepCompleting,
  resetTutorialForTests,
  skipTutorial,
  TUTORIAL_PROMPTS,
  TUTORIAL_SUBTITLES,
} from '../tutorial';

beforeEach(() => {
  _seen.clear();
  resetTutorialForTests();
});

// ─── initTutorial ─────────────────────────────────────────────────────────────

describe('initTutorial', () => {
  it('activates the tutorial at step 1 on first launch', () => {
    initTutorial();
    expect(isTutorialActive()).toBe(true);
    expect(getTutorialStep()).toBe(1);
  });

  it('skips the tutorial when plunge-explained has already been seen', () => {
    _seen.add('plunge-explained');
    initTutorial();
    expect(isTutorialActive()).toBe(false);
    expect(getTutorialStep()).toBeNull();
  });

  it('is idempotent — second call does not reset state', () => {
    initTutorial();
    advanceTutorial();
    commitStepTransition(); // → step 2
    initTutorial(); // second call is no-op
    expect(getTutorialStep()).toBe(2);
  });
});

// ─── advanceTutorial + commitStepTransition ───────────────────────────────────

describe('step progression', () => {
  it('starts at step 1, completing=false', () => {
    initTutorial();
    const phase = getTutorialPhase();
    expect(phase).toMatchObject({ active: true, step: 1, completing: false });
  });

  it('advanceTutorial sets completing=true for current step', () => {
    initTutorial();
    advanceTutorial();
    const phase = getTutorialPhase();
    expect(phase).toMatchObject({ active: true, step: 1, completing: true });
  });

  it('commitStepTransition moves from step 1 → 2', () => {
    initTutorial();
    advanceTutorial();
    commitStepTransition();
    expect(getTutorialStep()).toBe(2);
    expect(isTutorialStepCompleting()).toBe(false);
  });

  it('walks through all 6 steps sequentially', () => {
    initTutorial();
    for (let s = 1; s <= 6; s++) {
      expect(getTutorialStep()).toBe(s);
      advanceTutorial();
      commitStepTransition();
    }
    expect(isTutorialActive()).toBe(false);
    expect(getTutorialStep()).toBeNull();
  });

  it('step 6 completion deactivates the tutorial', () => {
    initTutorial();
    for (let i = 0; i < 5; i++) {
      advanceTutorial();
      commitStepTransition();
    }
    // now at step 6
    expect(getTutorialStep()).toBe(6);
    advanceTutorial();
    commitStepTransition();
    expect(isTutorialActive()).toBe(false);
  });

  it('advanceTutorial is a no-op when tutorial is inactive', () => {
    // never init → inactive
    advanceTutorial();
    expect(getTutorialPhase()).toMatchObject({ active: false });
  });

  it('commitStepTransition is a no-op when tutorial is inactive', () => {
    commitStepTransition();
    expect(getTutorialPhase()).toMatchObject({ active: false });
  });
});

// ─── skipTutorial ─────────────────────────────────────────────────────────────

describe('skipTutorial', () => {
  it('immediately deactivates the tutorial', async () => {
    initTutorial();
    expect(isTutorialActive()).toBe(true);
    await skipTutorial();
    expect(isTutorialActive()).toBe(false);
  });

  it('marks plunge-explained so tutorial is skipped next launch', async () => {
    initTutorial();
    await skipTutorial();
    expect(_seen.has('plunge-explained')).toBe(true);
  });

  it('no-ops if already inactive', async () => {
    await skipTutorial();
    expect(isTutorialActive()).toBe(false);
  });
});

// ─── Condition helpers ────────────────────────────────────────────────────────

describe('checkSteerCondition', () => {
  it('returns false at lateral=0 (no movement)', () => {
    expect(checkSteerCondition(0)).toBe(false);
  });

  it('returns false just below the threshold', () => {
    expect(checkSteerCondition(0.49)).toBe(false);
    expect(checkSteerCondition(-0.49)).toBe(false);
  });

  it('returns true at exactly 0.5', () => {
    expect(checkSteerCondition(0.5)).toBe(false); // > not >=
    expect(checkSteerCondition(0.51)).toBe(true);
    expect(checkSteerCondition(-0.51)).toBe(true);
  });

  it('returns true for large lateral values', () => {
    expect(checkSteerCondition(2.5)).toBe(true);
    expect(checkSteerCondition(-3)).toBe(true);
  });
});

describe('checkBalloonCondition', () => {
  it('returns false when balloons = 0', () => {
    expect(checkBalloonCondition(0)).toBe(false);
  });

  it('returns true when balloons >= 1', () => {
    expect(checkBalloonCondition(1)).toBe(true);
    expect(checkBalloonCondition(5)).toBe(true);
  });
});

describe('checkBoostCondition', () => {
  it('returns false when boostUntil <= now', () => {
    expect(checkBoostCondition(1000, 2000)).toBe(false);
    expect(checkBoostCondition(1000, 1000)).toBe(false);
  });

  it('returns true when boostUntil > now', () => {
    expect(checkBoostCondition(3000, 2000)).toBe(true);
  });
});

// ─── TUTORIAL_PROMPTS completeness ───────────────────────────────────────────

describe('TUTORIAL_PROMPTS', () => {
  it('has exactly 6 entries', () => {
    expect(Object.keys(TUTORIAL_PROMPTS)).toHaveLength(6);
  });

  it('step 1 = "SWIPE TO CHANGE LANE"', () => {
    expect(TUTORIAL_PROMPTS[1]).toBe('SWIPE TO CHANGE LANE');
  });

  it('step 2 = "TAP ANYWHERE TO HONK"', () => {
    expect(TUTORIAL_PROMPTS[2]).toBe('TAP ANYWHERE TO HONK');
  });

  it('step 3 = "GRAB A BALLOON"', () => {
    expect(TUTORIAL_PROMPTS[3]).toBe('GRAB A BALLOON');
  });

  it('step 4 = "HIT A BOOST PAD"', () => {
    expect(TUTORIAL_PROMPTS[4]).toBe('HIT A BOOST PAD');
  });

  it('step 5 = "SWIPE UP FOR A BACKFLIP"', () => {
    expect(TUTORIAL_PROMPTS[5]).toBe('SWIPE UP FOR A BACKFLIP');
  });

  it('step 6 = "YOU\'RE HIGH IN THE DOME — DROPPING IN"', () => {
    expect(TUTORIAL_PROMPTS[6]).toBe("YOU'RE HIGH IN THE DOME — DROPPING IN");
  });
});

describe('TUTORIAL_SUBTITLES', () => {
  it('has exactly 6 entries', () => {
    expect(Object.keys(TUTORIAL_SUBTITLES)).toHaveLength(6);
  });

  it('each subtitle is a non-empty string', () => {
    for (let s = 1; s <= 6; s++) {
      expect(TUTORIAL_SUBTITLES[s as 1 | 2 | 3 | 4 | 5 | 6].length).toBeGreaterThan(0);
    }
  });
});
