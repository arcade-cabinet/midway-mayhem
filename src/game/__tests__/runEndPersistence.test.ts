/**
 * runEndPersistence unit tests — fire-and-forget persistence pipeline.
 * Verifies profile + lifetime + achievements all get called with the
 * right arguments, and that errors are routed through errorBus.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordProfileRunMock = vi.fn<() => Promise<void>>();
const addTicketsMock = vi.fn<() => Promise<void>>();
const recordLifetimeRunMock = vi.fn<() => Promise<void>>();
const getStatsMock = vi.fn();
const checkRunAchievementsMock = vi.fn<() => Promise<void>>();
const reportErrorMock = vi.fn();

vi.mock('@/persistence/profile', () => ({
  recordRun: (...a: unknown[]) => recordProfileRunMock(...(a as [])),
  addTickets: (...a: unknown[]) => addTicketsMock(...(a as [])),
}));

vi.mock('@/persistence/lifetimeStats', () => ({
  recordRun: (...a: unknown[]) => recordLifetimeRunMock(...(a as [])),
  getStats: (...a: unknown[]) => getStatsMock(...(a as [])),
}));

vi.mock('@/persistence/achievements', () => ({
  checkRunAchievements: (...a: unknown[]) => checkRunAchievementsMock(...(a as [])),
}));

vi.mock('@/game/errorBus', () => ({
  reportError: (...a: unknown[]) => reportErrorMock(...a),
}));

import { persistRunEnd, type RunEndSummary } from '@/game/runEndPersistence';

const LIFETIME_STATS = {
  totalDistanceCm: 12_345,
  totalRunsCompleted: 7,
  totalScares: 42,
  longestComboChain: 10,
  maxSingleRunCrowd: 200,
  totalGameOversByPlunge: 1,
};

function baseSummary(over: Partial<RunEndSummary> = {}): RunEndSummary {
  return {
    distance: 500,
    crowd: 100,
    crashes: 2,
    balloons: 3,
    scaresThisRun: 4,
    maxComboThisRun: 5,
    raidsSurvived: 1,
    plunged: false,
    startedAt: Math.max(1, performance.now() - 60_000),
    ...over,
  };
}

async function flush() {
  // Microtasks for each await in the chain (record / tickets / lifetime / stats / achievements)
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

describe('persistRunEnd', () => {
  beforeEach(() => {
    recordProfileRunMock.mockReset().mockResolvedValue();
    addTicketsMock.mockReset().mockResolvedValue();
    recordLifetimeRunMock.mockReset().mockResolvedValue();
    getStatsMock.mockReset().mockResolvedValue(LIFETIME_STATS);
    checkRunAchievementsMock.mockReset().mockResolvedValue();
    reportErrorMock.mockReset();
  });

  it('records a profile run with distance and crowd', async () => {
    persistRunEnd(baseSummary({ distance: 777, crowd: 250 }));
    await flush();
    expect(recordProfileRunMock).toHaveBeenCalledWith({ distance: 777, crowd: 250 });
  });

  it('adds tickets equal to balloons when balloons > 0', async () => {
    persistRunEnd(baseSummary({ balloons: 5 }));
    await flush();
    expect(addTicketsMock).toHaveBeenCalledWith(5);
  });

  it('skips addTickets when balloons == 0', async () => {
    persistRunEnd(baseSummary({ balloons: 0 }));
    await flush();
    expect(addTicketsMock).not.toHaveBeenCalled();
  });

  it('records lifetime run with the full run summary', async () => {
    const s = baseSummary({
      distance: 1000,
      crashes: 1,
      scaresThisRun: 2,
      balloons: 3,
      crowd: 150,
      maxComboThisRun: 8,
      plunged: true,
    });
    persistRunEnd(s);
    await flush();
    expect(recordLifetimeRunMock).toHaveBeenCalledTimes(1);
    const arg = (recordLifetimeRunMock.mock.calls[0] as unknown as unknown[])[0] as {
      distanceM: number;
      crashes: number;
      scares: number;
      ticketsEarned: number;
      crowd: number;
      maxComboChain: number;
      plunged: boolean;
      secondsPlayed: number;
    };
    expect(arg.distanceM).toBe(1000);
    expect(arg.crashes).toBe(1);
    expect(arg.scares).toBe(2);
    expect(arg.ticketsEarned).toBe(3);
    expect(arg.crowd).toBe(150);
    expect(arg.maxComboChain).toBe(8);
    expect(arg.plunged).toBe(true);
    expect(arg.secondsPlayed).toBeGreaterThan(0);
  });

  it('passes run metrics + lifetime stats to checkRunAchievements', async () => {
    persistRunEnd(baseSummary({ distance: 900, maxComboThisRun: 6, raidsSurvived: 2 }));
    await flush();
    expect(checkRunAchievementsMock).toHaveBeenCalledTimes(1);
    const [runArg, lifeArg] = checkRunAchievementsMock.mock.calls[0] as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(runArg.distance).toBe(900);
    expect(runArg.maxCombo).toBe(6);
    expect(runArg.raidsSurvived).toBe(2);
    expect(lifeArg).toEqual(LIFETIME_STATS);
  });

  it('secondsPlayed is 0 when startedAt is 0 (never-started run)', async () => {
    persistRunEnd(baseSummary({ startedAt: 0 }));
    await flush();
    const arg = (recordLifetimeRunMock.mock.calls[0] as unknown as unknown[])[0] as {
      secondsPlayed: number;
    };
    expect(arg.secondsPlayed).toBe(0);
  });

  it('awaits in order: profile → tickets → lifetime → stats → achievements', async () => {
    const order: string[] = [];
    recordProfileRunMock.mockImplementation(async () => {
      order.push('profile');
    });
    addTicketsMock.mockImplementation(async () => {
      order.push('tickets');
    });
    recordLifetimeRunMock.mockImplementation(async () => {
      order.push('lifetime');
    });
    getStatsMock.mockImplementation(async () => {
      order.push('stats');
      return LIFETIME_STATS;
    });
    checkRunAchievementsMock.mockImplementation(async () => {
      order.push('achievements');
    });
    persistRunEnd(baseSummary({ balloons: 2 }));
    await flush();
    expect(order).toEqual(['profile', 'tickets', 'lifetime', 'stats', 'achievements']);
  });

  it('routes a profile-record failure through reportError', async () => {
    recordProfileRunMock.mockRejectedValue(new Error('db lock'));
    persistRunEnd(baseSummary());
    await flush();
    expect(reportErrorMock).toHaveBeenCalledTimes(1);
    expect(reportErrorMock.mock.calls[0]?.[1]).toBe('gameState.endRun persistence');
  });

  it('routes an achievement-check failure through reportError', async () => {
    checkRunAchievementsMock.mockRejectedValue(new Error('achievement db broken'));
    persistRunEnd(baseSummary());
    await flush();
    expect(reportErrorMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw synchronously even if the pipeline rejects', () => {
    recordProfileRunMock.mockRejectedValue(new Error('no db'));
    expect(() => persistRunEnd(baseSummary())).not.toThrow();
  });
});
