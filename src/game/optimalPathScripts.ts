/**
 * @module game/optimalPathScripts
 *
 * Test-factory helpers: convert a RunPlan + desired PathOutcome into a
 * pre-computed keyboard-event timeline that the e2e governor can replay.
 *
 * Separated from optimalPath.ts so the solver stays under 300 LOC.
 */

import { composeTrack, DEFAULT_TRACK, type PieceKind } from '@/track/trackComposer';
import { TRACK } from '@/utils/constants';
import { createRunRng } from '@/utils/rng';
import { type OptimalPath, solveOptimalPath } from './optimalPath';
import { buildRunPlan, type RunPlan } from './runPlan';

/** Ramp piece kinds that have no side rails — plunge risk zone. */
const RAMP_KINDS: ReadonlySet<PieceKind> = new Set(['ramp', 'rampLong', 'rampLongCurved']);

export type PathOutcome =
  | 'finish-clean' // avoid everything, reach finish
  | 'collide-first' // deliberately hit first obstacle (for permadeath tests)
  | 'plunge-off-ramp' // steer into first ramp's rail-free edge
  | 'survive-30s'; // drive sensibly for the first 30s window, regardless of finish

export interface ScriptedInput {
  /** Activation distance along the track (m) — replay uses diag.distance to fire. */
  dTrigger: number;
  /** Which keyboard key this event toggles. */
  key: 'ArrowLeft' | 'ArrowRight';
  /** 'keydown' or 'keyup'. */
  type: 'keydown' | 'keyup';
}

/**
 * Build a keyboard-event script to drive a desired outcome.
 *
 * The script is *distance*-triggered, not time-triggered, so it's robust
 * across frame jitter and varying playback speed. The e2e harness polls
 * `diag.distance` every ~50ms and fires pending events once the threshold
 * is crossed.
 */
export function scriptForOutcome(plan: RunPlan, outcome: PathOutcome): ScriptedInput[] {
  switch (outcome) {
    case 'finish-clean':
      return scriptFromPath(solveOptimalPath(plan));
    case 'collide-first':
      return scriptToCollideFirst(plan);
    case 'plunge-off-ramp':
      return scriptToPlungeOffRamp(plan);
    case 'survive-30s':
      return scriptFromPath(solveOptimalPath(plan)).filter((e) => e.dTrigger < 30 * 30);
  }
}

/**
 * Convenience wrapper: build a run plan from `seed` then produce the script.
 * Useful in test harnesses where you only know the numeric seed.
 */
export function scriptForSeed(seed: number, outcome: PathOutcome): ScriptedInput[] {
  const plan = buildRunPlanFromSeed(seed);
  return scriptForOutcome(plan, outcome);
}

function scriptFromPath(path: OptimalPath): ScriptedInput[] {
  const script: ScriptedInput[] = [];

  // Translate lane *switches* into hold-and-release ArrowLeft/ArrowRight.
  // We press the direction key for an estimated duration, computed from
  // lane delta and the typical steer ramp rate the game uses.
  for (let i = 1; i < path.waypoints.length; i++) {
    const prev = path.waypoints[i - 1];
    const cur = path.waypoints[i];
    if (!prev || !cur) continue;
    const laneDelta = cur.lane - prev.lane;
    if (laneDelta === 0) continue;
    const key: 'ArrowLeft' | 'ArrowRight' = laneDelta < 0 ? 'ArrowLeft' : 'ArrowRight';
    const holdD = Math.abs(laneDelta) * 12; // m of track while holding
    script.push({ dTrigger: cur.d, key, type: 'keydown' });
    script.push({ dTrigger: cur.d + holdD, key, type: 'keyup' });
  }
  return script;
}

function scriptToCollideFirst(plan: RunPlan): ScriptedInput[] {
  if (plan.obstacles.length === 0) return [];
  const startLane = Math.floor(TRACK.LANE_COUNT / 2);

  // Find the first obstacle that requires steering away from center, OR fall
  // back to the very first obstacle if all are already in the center lane.
  // We always produce at least one keydown/keyup pair — if the first obstacle
  // IS in the center lane, we stay put (empty script) but that means we'll hit
  // it naturally, which is the desired outcome.
  const first = plan.obstacles[0];
  if (!first) return [];
  const delta = first.lane - startLane;

  // Already in center lane — no steering needed; car will hit it straight.
  // Return a token pair that steers slightly right then immediately releases
  // (0m hold) so the script is non-empty and the test harness has a trigger
  // to wait on, but the car stays in center.
  if (delta === 0) {
    return [
      { dTrigger: Math.max(0, first.d - 5), key: 'ArrowRight', type: 'keydown' },
      { dTrigger: Math.max(0, first.d - 5), key: 'ArrowRight', type: 'keyup' },
    ];
  }

  const key: 'ArrowLeft' | 'ArrowRight' = delta < 0 ? 'ArrowLeft' : 'ArrowRight';
  const holdD = Math.abs(delta) * 12;
  return [
    { dTrigger: Math.max(0, first.d - 30), key, type: 'keydown' },
    { dTrigger: Math.max(0, first.d - 30) + holdD, key, type: 'keyup' },
  ];
}

function scriptToPlungeOffRamp(plan: RunPlan): ScriptedInput[] {
  // Detect the first ramp in DEFAULT_TRACK using composeTrack, whose
  // distanceAtStart values are in world-scale metres (worldScale=10).
  // The plan's distance is also in metres, so the scales align.
  const composition = composeTrack(DEFAULT_TRACK, 10);
  const firstRamp = composition.placements.find((p) => RAMP_KINDS.has(p.kind));

  // Start steering hard right 20m before the ramp so the car is already drifting
  // when it reaches the rail-free edge. Hold until well past it so the lateral
  // overshoot exceeds LATERAL_CLAMP + PLUNGE_OVERSHOOT_M (0.5m) and gameState
  // fires the plunge. If no ramp is found in the composition (should never happen
  // with DEFAULT_TRACK), fall back to the known rampLong distance at ~60m.
  const rampD = firstRamp ? firstRamp.distanceAtStart : 60;
  const approachD = Math.max(10, rampD - 20);
  const releaseD = rampD + 200;

  void plan; // plan is not used directly; ramp positions come from DEFAULT_TRACK

  return [
    { dTrigger: approachD, key: 'ArrowRight', type: 'keydown' },
    { dTrigger: releaseD, key: 'ArrowRight', type: 'keyup' },
  ];
}

/** Build a RunPlan from a numeric seed (wraps buildRunPlan + createRunRng). */
function buildRunPlanFromSeed(seed: number): RunPlan {
  return buildRunPlan({ seed, trackRng: createRunRng(seed).track });
}
