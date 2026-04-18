/**
 * @module game/runPlanRefs
 *
 * Module-level singleton refs for the current run's RunPlan and OptimalPath.
 *
 * koota traits can only hold primitives, so complex objects live here.
 * Extracted into their own module to break the circular dependency between
 * gameState.ts (which writes them at startRun) and gameStateTick.ts
 * (which reads optimalPath every frame for cleanliness tracking).
 */
import type { OptimalPath } from './optimalPath';
import type { RunPlan } from './runPlan';

let _plan: RunPlan | null = null;
let _optimalPath: OptimalPath | null = null;

export function getPlan(): RunPlan | null {
  return _plan;
}

export function getOptimalPath(): OptimalPath | null {
  return _optimalPath;
}

export function setPlan(plan: RunPlan | null): void {
  _plan = plan;
}

export function setOptimalPath(optimalPath: OptimalPath | null): void {
  _optimalPath = optimalPath;
}

export function resetRunPlanRefs(): void {
  _plan = null;
  _optimalPath = null;
}
