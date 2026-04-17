/**
 * @module game/optimalPath
 *
 * Deterministic solver + test-factory for the run plan.
 *
 * Because `buildRunPlan(seed)` enumerates every obstacle and pickup ahead
 * of time, we can solve the best lane-by-lane path through the entire
 * track at runtime or in a test harness. This module serves BOTH needs:
 *
 *   1. RUNTIME SCORING — call `solveOptimalPath(plan)` once at runStart.
 *      Store the resulting lane trajectory. During play, sample the
 *      player's actual lateral position every frame and compare against
 *      the optimal lateral at the same `d`. Accumulated deviation drives
 *      a "racing line" scoring multiplier + ghost overlay + telemetry.
 *
 *   2. TEST FACTORY — `scriptForOutcome(plan, outcome)` converts a
 *      desired run-end ("finish-clean", "collide-first", "plunge-off-ramp",
 *      "survive-30s") into a pre-computed keyboard event timeline. The e2e
 *      governor replays those events via real window.dispatchEvent() with
 *      zero AI. Determinism = seed → plan → script.
 *
 * The solver is a simple forward sweep: at each planned obstacle's distance
 * choose the lane that minimises a cost function (hit penalty + lane-switch
 * cost + pickup reward). For test factories we flip signs to force
 * collisions or steer into rail-free ramp edges.
 *
 * Key insight: the plan is static. The solver doesn't need a game loop,
 * doesn't need time, doesn't need physics — it operates purely on (d, lane)
 * grid points. This makes it microseconds-fast and easy to unit-test.
 */

import { composeTrack, DEFAULT_TRACK, type PieceKind } from '@/track/trackComposer';
import { TRACK } from '@/utils/constants';
import { createRunRng } from '@/utils/rng';
import { buildRunPlan, type RunPlan } from './runPlan';

/** Ramp piece kinds that have no side rails — plunge risk zone. */
const RAMP_KINDS: ReadonlySet<PieceKind> = new Set(['ramp', 'rampLong', 'rampLongCurved']);

// ─── Optimal lane trajectory ────────────────────────────────────────────────

export interface OptimalWaypoint {
  /** Distance along track where the car should be in this lane. */
  d: number;
  /** Target lane index [0..LANE_COUNT-1]. */
  lane: number;
  /** Lateral position in m (from centerline) — derived from lane. */
  lateralM: number;
  /** Reason for this waypoint (diagnostic). */
  reason: 'obstacle-avoid' | 'pickup-seek' | 'plunge-edge' | 'collide' | 'center';
}

export interface OptimalPath {
  seed: number;
  /** Sorted by d ascending. */
  waypoints: OptimalWaypoint[];
  /** Total length of the plan the solver covered. */
  distance: number;
}

export type PathOutcome =
  | 'finish-clean' // avoid everything, reach finish
  | 'collide-first' // deliberately hit first obstacle (for permadeath tests)
  | 'plunge-off-ramp' // steer into first ramp's rail-free edge
  | 'survive-30s'; // drive sensibly for the first 30s window, regardless of finish

// ─── Solver ──────────────────────────────────────────────────────���─────────

/**
 * How far ahead (in metres) we scan for obstacles when deciding whether to
 * change lanes for a pickup or stay put. Must be >= the obstacle reaction
 * window (4 m) plus a margin for coarse event ordering.
 */
const PICKUP_DANGER_LOOKAHEAD_M = 20;

/**
 * Solve the lane path that minimises obstacle hits while collecting pickups
 * where convenient. Linear forward pass — O(n*lanes) in plan size.
 */
export function solveOptimalPath(plan: RunPlan): OptimalPath {
  const events = mergeEvents(plan);
  // Build a fast lookup: lane → sorted list of obstacle distances.
  // Used by the pickup-divert guard to detect imminent hazards.
  const obstacleDsByLane: Map<number, number[]> = new Map();
  for (const obs of plan.obstacles) {
    let arr = obstacleDsByLane.get(obs.lane);
    if (!arr) {
      arr = [];
      obstacleDsByLane.set(obs.lane, arr);
    }
    arr.push(obs.d);
  }
  // Sort each lane's obstacle list ascending so binary-search would be
  // possible; a linear scan is fine given typical plan sizes.
  for (const arr of obstacleDsByLane.values()) arr.sort((a, b) => a - b);

  const halfW = (TRACK.LANE_COUNT - 1) * TRACK.LANE_WIDTH * 0.5;
  const laneLateral = (lane: number) => lane * TRACK.LANE_WIDTH - halfW;

  /**
   * Return true if `lane` contains an obstacle within [d, d + lookahead].
   * Used to guard pickup-seek diversions against diving into a danger zone.
   */
  function laneHasObstacleAhead(lane: number, d: number, lookahead: number): boolean {
    const arr = obstacleDsByLane.get(lane);
    if (!arr) return false;
    for (const od of arr) {
      if (od < d) continue;
      if (od > d + lookahead) break;
      return true;
    }
    return false;
  }

  const waypoints: OptimalWaypoint[] = [];
  // Seed at the center lane.
  let currentLane = Math.floor(TRACK.LANE_COUNT / 2);
  waypoints.push({
    d: 0,
    lane: currentLane,
    lateralM: laneLateral(currentLane),
    reason: 'center',
  });

  for (const e of events) {
    if (e.kind === 'obstacle') {
      // Move to any non-obstacle lane, preferring the one closest to current.
      const blocked = new Set<number>();
      blocked.add(e.lane);
      const choice = nearestSafeLane(currentLane, blocked);
      if (choice !== currentLane) {
        currentLane = choice;
        waypoints.push({
          d: e.d - 4, // decide 4m before the hazard (reaction window)
          lane: currentLane,
          lateralM: laneLateral(currentLane),
          reason: 'obstacle-avoid',
        });
      }
    } else if (e.kind === 'pickup') {
      // Collect a pickup only if it's a no-cost lane switch.
      if (e.lane === currentLane) continue;
      const laneDistance = Math.abs(e.lane - currentLane);
      // Only divert for high-value pickups, and only one lane hop away.
      const worth = e.pickupType === 'mega' ? 3 : e.pickupType === 'boost' ? 1 : 0;
      if (worth < laneDistance) continue;
      // Guard: don't divert if the target lane has an obstacle just ahead.
      // The divert waypoint is at (e.d - 3), so check from there forward.
      if (laneHasObstacleAhead(e.lane, e.d - 3, PICKUP_DANGER_LOOKAHEAD_M)) continue;
      currentLane = e.lane;
      waypoints.push({
        d: e.d - 3,
        lane: currentLane,
        lateralM: laneLateral(currentLane),
        reason: 'pickup-seek',
      });
    }
  }

  // Return to center at the finish for a clean landing on the goal platform.
  waypoints.push({
    d: plan.distance,
    lane: Math.floor(TRACK.LANE_COUNT / 2),
    lateralM: 0,
    reason: 'center',
  });

  return { seed: plan.seed, waypoints, distance: plan.distance };
}

// ─── Runtime scoring ────────────────────────────────────────────────────────

/**
 * Return the optimal lateral position at the given `d` by linearly
 * interpolating between the two neighbouring waypoints. Hot path — stays
 * allocation-free.
 */
export function optimalLateralAt(path: OptimalPath, d: number): number {
  const wps = path.waypoints;
  if (wps.length === 0) return 0;
  if (d <= (wps[0]?.d ?? 0)) return wps[0]?.lateralM ?? 0;
  const last = wps[wps.length - 1];
  if (!last) return 0;
  if (d >= last.d) return last.lateralM;
  // Binary search would be cleaner; linear scan is fine at typical plan size
  for (let i = 1; i < wps.length; i++) {
    const a = wps[i - 1];
    const b = wps[i];
    if (!a || !b) continue;
    if (d >= a.d && d <= b.d) {
      const t = (d - a.d) / Math.max(1e-6, b.d - a.d);
      return a.lateralM + t * (b.lateralM - a.lateralM);
    }
  }
  return last.lateralM;
}

/**
 * Score a player's actual lateral against the optimal line.
 * Returns deviation in metres-squared summed over samples, normalised per m.
 * Lower is better; 0 is perfect.
 */
export function scoreDeviation(
  path: OptimalPath,
  samples: Array<{ d: number; lateralM: number }>,
): number {
  if (samples.length < 2) return 0;
  let sq = 0;
  let span = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const cur = samples[i];
    if (!prev || !cur) continue;
    const dM = cur.d - prev.d;
    if (dM <= 0) continue;
    const target = optimalLateralAt(path, cur.d);
    const err = cur.lateralM - target;
    sq += err * err * dM;
    span += dM;
  }
  return span > 0 ? sq / span : 0;
}

// ─── Test factory ──────────────────────────────────────────────────────────

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

// ─── Internal helpers ──────────────────────────────────────────────────────

type MergedEvent =
  | { kind: 'obstacle'; d: number; lane: number }
  | { kind: 'pickup'; d: number; lane: number; pickupType: 'ticket' | 'boost' | 'mega' };

function mergeEvents(plan: RunPlan): MergedEvent[] {
  const out: MergedEvent[] = [];
  for (const o of plan.obstacles) out.push({ kind: 'obstacle', d: o.d, lane: o.lane });
  for (const p of plan.pickups)
    out.push({ kind: 'pickup', d: p.d, lane: p.lane, pickupType: p.type });
  out.sort((a, b) => a.d - b.d);
  return out;
}

function nearestSafeLane(current: number, blocked: Set<number>): number {
  // Search outward from current lane for the nearest un-blocked lane.
  for (let step = 0; step < TRACK.LANE_COUNT; step++) {
    for (const sign of [0, -1, 1]) {
      const candidate = current + sign * step;
      if (candidate < 0 || candidate >= TRACK.LANE_COUNT) continue;
      if (!blocked.has(candidate)) return candidate;
    }
  }
  return current;
}

/** Build a RunPlan from a numeric seed (wraps buildRunPlan + createRunRng). */
function buildRunPlanFromSeed(seed: number): RunPlan {
  return buildRunPlan({ seed, trackRng: createRunRng(seed).track });
}
