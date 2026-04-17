/**
 * @module config/schema
 *
 * Tunables schema — hand-rolled validator (no zod dependency).
 * Types live in schemaTypes.ts; helpers in schemaValidators.ts.
 * This file exports the public API and contains parseTunables.
 */
export type { Tunables, ZoneTunable, ZoneWeights } from './schemaTypes';

import type { Tunables } from './schemaTypes';
import { assertArray, assertNumber, assertObject, assertString, collect } from './schemaValidators';

type ValidationResult = { ok: true; data: Tunables } | { ok: false; error: string };

export function parseTunables(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const r = raw as Record<string, unknown>;

  const topErr = assertObject(raw, 'tunables');
  if (topErr) return { ok: false, error: topErr };

  // speed
  errors.push(
    ...collect(
      assertObject(r.speed, 'speed'),
      assertNumber((r.speed as Record<string, unknown>)?.base, 'speed.base', { positive: true }),
      assertNumber((r.speed as Record<string, unknown>)?.cruise, 'speed.cruise', {
        positive: true,
      }),
      assertNumber((r.speed as Record<string, unknown>)?.boost, 'speed.boost', { positive: true }),
      assertNumber((r.speed as Record<string, unknown>)?.mega, 'speed.mega', { positive: true }),
      assertNumber((r.speed as Record<string, unknown>)?.crashDamping, 'speed.crashDamping', {
        min: 0,
        max: 1,
      }),
      assertNumber((r.speed as Record<string, unknown>)?.boostDuration, 'speed.boostDuration', {
        positive: true,
      }),
      assertNumber((r.speed as Record<string, unknown>)?.megaDuration, 'speed.megaDuration', {
        positive: true,
      }),
    ),
  );

  // steer
  errors.push(
    ...collect(
      assertObject(r.steer, 'steer'),
      assertNumber((r.steer as Record<string, unknown>)?.maxLateralMps, 'steer.maxLateralMps', {
        positive: true,
      }),
      assertNumber((r.steer as Record<string, unknown>)?.returnTau, 'steer.returnTau', {
        positive: true,
      }),
      assertNumber((r.steer as Record<string, unknown>)?.wheelMaxDeg, 'steer.wheelMaxDeg', {
        positive: true,
      }),
      assertNumber((r.steer as Record<string, unknown>)?.sensitivity, 'steer.sensitivity', {
        positive: true,
      }),
    ),
  );

  // track
  errors.push(
    ...collect(
      assertObject(r.track, 'track'),
      assertNumber((r.track as Record<string, unknown>)?.laneCount, 'track.laneCount', { min: 1 }),
      assertNumber((r.track as Record<string, unknown>)?.laneWidth, 'track.laneWidth', {
        positive: true,
      }),
      assertNumber((r.track as Record<string, unknown>)?.chunkLength, 'track.chunkLength', {
        positive: true,
      }),
      assertNumber((r.track as Record<string, unknown>)?.lookaheadChunks, 'track.lookaheadChunks', {
        min: 1,
      }),
    ),
  );

  // honk
  errors.push(
    ...collect(
      assertObject(r.honk, 'honk'),
      assertNumber((r.honk as Record<string, unknown>)?.scareRadius, 'honk.scareRadius', {
        positive: true,
      }),
      assertNumber((r.honk as Record<string, unknown>)?.fleeLateral, 'honk.fleeLateral', {
        positive: true,
      }),
      assertNumber((r.honk as Record<string, unknown>)?.fleeDuration, 'honk.fleeDuration', {
        positive: true,
      }),
      assertNumber((r.honk as Record<string, unknown>)?.cooldown, 'honk.cooldown', { min: 0 }),
    ),
  );

  // critters
  errors.push(
    ...collect(
      assertObject(r.critters, 'critters'),
      assertArray((r.critters as Record<string, unknown>)?.kinds, 'critters.kinds'),
      assertNumber(
        (r.critters as Record<string, unknown>)?.pickupMegaThreshold,
        'critters.pickupMegaThreshold',
        { min: 0, max: 1 },
      ),
      assertNumber(
        (r.critters as Record<string, unknown>)?.pickupBoostThreshold,
        'critters.pickupBoostThreshold',
        { min: 0, max: 1 },
      ),
    ),
  );

  // obstacles
  const obs = r.obstacles as Record<string, unknown>;
  const spawn = obs?.spawn as Record<string, unknown>;
  errors.push(
    ...collect(
      assertObject(r.obstacles, 'obstacles'),
      assertObject(obs?.spawn, 'obstacles.spawn'),
      assertNumber(spawn?.minGap, 'obstacles.spawn.minGap', { positive: true }),
      assertNumber(spawn?.jitter, 'obstacles.spawn.jitter', { min: 0 }),
      assertNumber(spawn?.pickupMinGap, 'obstacles.spawn.pickupMinGap', { positive: true }),
      assertNumber(spawn?.pickupJitter, 'obstacles.spawn.pickupJitter', { min: 0 }),
      assertObject(obs?.zoneWeights, 'obstacles.zoneWeights'),
    ),
  );

  // zones
  errors.push(...collect(assertObject(r.zones, 'zones')));
  if (r.zones !== null && typeof r.zones === 'object') {
    for (const [zoneId, zone] of Object.entries(r.zones as Record<string, unknown>)) {
      const zr = zone as Record<string, unknown>;
      errors.push(
        ...collect(
          assertObject(zone, `zones.${zoneId}`),
          assertString(zr?.root, `zones.${zoneId}.root`),
          assertNumber(zr?.tempo, `zones.${zoneId}.tempo`, { positive: true }),
          assertString(zr?.colorGrade, `zones.${zoneId}.colorGrade`),
        ),
      );
    }
  }

  // audio
  const aud = r.audio as Record<string, unknown>;
  const buses = aud?.buses as Record<string, unknown>;
  const ducking = aud?.ducking as Record<string, unknown>;
  errors.push(
    ...collect(
      assertObject(r.audio, 'audio'),
      assertObject(aud?.buses, 'audio.buses'),
      assertNumber(buses?.masterDb, 'audio.buses.masterDb'),
      assertNumber(buses?.musicDb, 'audio.buses.musicDb'),
      assertNumber(buses?.sfxDb, 'audio.buses.sfxDb'),
      assertNumber(buses?.ambDb, 'audio.buses.ambDb'),
      assertObject(aud?.ducking, 'audio.ducking'),
      assertNumber(ducking?.depthDb, 'audio.ducking.depthDb'),
      assertNumber(ducking?.thresholdDb, 'audio.ducking.thresholdDb'),
    ),
  );

  // scoring
  errors.push(
    ...collect(
      assertObject(r.scoring, 'scoring'),
      assertNumber((r.scoring as Record<string, unknown>)?.ticketReward, 'scoring.ticketReward'),
      assertNumber((r.scoring as Record<string, unknown>)?.boostReward, 'scoring.boostReward'),
      assertNumber((r.scoring as Record<string, unknown>)?.megaReward, 'scoring.megaReward'),
      assertNumber((r.scoring as Record<string, unknown>)?.crashDamage, 'scoring.crashDamage', {
        positive: true,
      }),
      assertNumber(
        (r.scoring as Record<string, unknown>)?.heavyCrashDamage,
        'scoring.heavyCrashDamage',
        { positive: true },
      ),
      assertNumber((r.scoring as Record<string, unknown>)?.sanityRegen, 'scoring.sanityRegen', {
        min: 0,
      }),
    ),
  );

  // combo
  errors.push(
    ...collect(
      assertObject(r.combo, 'combo'),
      assertNumber((r.combo as Record<string, unknown>)?.windowMs, 'combo.windowMs', {
        positive: true,
      }),
      assertNumber((r.combo as Record<string, unknown>)?.multiplierStep, 'combo.multiplierStep', {
        positive: true,
      }),
      assertNumber((r.combo as Record<string, unknown>)?.maxMultiplier, 'combo.maxMultiplier', {
        positive: true,
      }),
    ),
  );

  if (errors.length > 0) {
    return { ok: false, error: `tunables.json validation failed:\n  ${errors.join('\n  ')}` };
  }

  return { ok: true, data: raw as Tunables };
}
