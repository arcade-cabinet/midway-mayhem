/**
 * runPlanRefs unit tests — module-singleton get/set/reset of the
 * active RunPlan + OptimalPath. Plain lifecycle coverage.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { OptimalPath } from '@/game/optimalPath';
import type { RunPlan } from '@/game/runPlan';
import {
  getOptimalPath,
  getPlan,
  resetRunPlanRefs,
  setOptimalPath,
  setPlan,
} from '@/game/runPlanRefs';

const FAKE_PLAN: RunPlan = {
  seed: 1,
  distance: 0,
  obstacles: [],
  pickups: [],
} as unknown as RunPlan;

const FAKE_PATH: OptimalPath = {
  seed: 1,
  waypoints: [],
  distance: 0,
};

describe('runPlanRefs', () => {
  beforeEach(() => {
    resetRunPlanRefs();
  });

  it('both refs start null', () => {
    expect(getPlan()).toBeNull();
    expect(getOptimalPath()).toBeNull();
  });

  it('setPlan stores and returns the same instance', () => {
    setPlan(FAKE_PLAN);
    expect(getPlan()).toBe(FAKE_PLAN);
  });

  it('setOptimalPath stores and returns the same instance', () => {
    setOptimalPath(FAKE_PATH);
    expect(getOptimalPath()).toBe(FAKE_PATH);
  });

  it('setPlan does not affect optimalPath and vice versa', () => {
    setPlan(FAKE_PLAN);
    expect(getOptimalPath()).toBeNull();

    resetRunPlanRefs();
    setOptimalPath(FAKE_PATH);
    expect(getPlan()).toBeNull();
  });

  it('setPlan(null) clears only the plan slot', () => {
    setPlan(FAKE_PLAN);
    setOptimalPath(FAKE_PATH);
    setPlan(null);
    expect(getPlan()).toBeNull();
    expect(getOptimalPath()).toBe(FAKE_PATH);
  });

  it('setOptimalPath(null) clears only the path slot', () => {
    setPlan(FAKE_PLAN);
    setOptimalPath(FAKE_PATH);
    setOptimalPath(null);
    expect(getOptimalPath()).toBeNull();
    expect(getPlan()).toBe(FAKE_PLAN);
  });

  it('resetRunPlanRefs clears both slots', () => {
    setPlan(FAKE_PLAN);
    setOptimalPath(FAKE_PATH);
    resetRunPlanRefs();
    expect(getPlan()).toBeNull();
    expect(getOptimalPath()).toBeNull();
  });

  it('overwriting replaces the previous value', () => {
    const secondPath: OptimalPath = { seed: 2, waypoints: [], distance: 100 };
    setOptimalPath(FAKE_PATH);
    setOptimalPath(secondPath);
    expect(getOptimalPath()).toBe(secondPath);
  });
});
