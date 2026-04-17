/**
 * Tunables schema — hand-rolled validator (no zod dependency).
 * Every field has a readable error message.
 */

export interface ZoneWeights {
  barrier: number;
  cones: number;
  gate: number;
  oil: number;
  hammer: number;
  critter: number;
}

export interface ZoneTunable {
  root: string;
  tempo: number;
  colorGrade: string;
}

export interface Tunables {
  speed: {
    base: number;
    cruise: number;
    boost: number;
    mega: number;
    crashDamping: number;
    boostDuration: number;
    megaDuration: number;
  };
  steer: {
    maxLateralMps: number;
    returnTau: number;
    wheelMaxDeg: number;
    sensitivity: number;
  };
  track: {
    laneCount: number;
    laneWidth: number;
    chunkLength: number;
    lookaheadChunks: number;
  };
  honk: {
    scareRadius: number;
    fleeLateral: number;
    fleeDuration: number;
    cooldown: number;
  };
  critters: {
    kinds: string[];
    pickupMegaThreshold: number;
    pickupBoostThreshold: number;
  };
  obstacles: {
    spawn: {
      minGap: number;
      jitter: number;
      pickupMinGap: number;
      pickupJitter: number;
    };
    zoneWeights: Record<string, ZoneWeights>;
  };
  zones: Record<string, ZoneTunable>;
  audio: {
    buses: {
      masterDb: number;
      musicDb: number;
      sfxDb: number;
      ambDb: number;
    };
    ducking: {
      depthDb: number;
      thresholdDb: number;
    };
  };
  scoring: {
    ticketReward: number;
    boostReward: number;
    megaReward: number;
    crashDamage: number;
    heavyCrashDamage: number;
    sanityRegen: number;
  };
  combo: {
    windowMs: number;
    multiplierStep: number;
    maxMultiplier: number;
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

type ValidationResult = { ok: true; data: Tunables } | { ok: false; error: string };

function assertNumber(v: unknown, path: string, opts: { positive?: boolean; min?: number; max?: number } = {}): string | null {
  if (typeof v !== 'number' || !isFinite(v)) return `${path}: expected finite number, got ${JSON.stringify(v)}`;
  if (opts.positive && v <= 0) return `${path}: must be positive (> 0), got ${v}`;
  if (opts.min !== undefined && v < opts.min) return `${path}: must be >= ${opts.min}, got ${v}`;
  if (opts.max !== undefined && v > opts.max) return `${path}: must be <= ${opts.max}, got ${v}`;
  return null;
}

function assertString(v: unknown, path: string): string | null {
  if (typeof v !== 'string') return `${path}: expected string, got ${JSON.stringify(v)}`;
  return null;
}

function assertObject(v: unknown, path: string): string | null {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    return `${path}: expected object, got ${JSON.stringify(v)}`;
  }
  return null;
}

function assertArray(v: unknown, path: string): string | null {
  if (!Array.isArray(v)) return `${path}: expected array, got ${JSON.stringify(v)}`;
  return null;
}

// Collect all errors into a single message
function collect(...results: (string | null)[]): string[] {
  return results.filter((r): r is string => r !== null);
}

export function parseTunables(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const r = raw as Record<string, unknown>;

  // Top-level must be object
  const topErr = assertObject(raw, 'tunables');
  if (topErr) return { ok: false, error: topErr };

  // speed
  errors.push(...collect(
    assertObject(r['speed'], 'speed'),
    assertNumber((r['speed'] as Record<string, unknown>)?.['base'], 'speed.base', { positive: true }),
    assertNumber((r['speed'] as Record<string, unknown>)?.['cruise'], 'speed.cruise', { positive: true }),
    assertNumber((r['speed'] as Record<string, unknown>)?.['boost'], 'speed.boost', { positive: true }),
    assertNumber((r['speed'] as Record<string, unknown>)?.['mega'], 'speed.mega', { positive: true }),
    assertNumber((r['speed'] as Record<string, unknown>)?.['crashDamping'], 'speed.crashDamping', { min: 0, max: 1 }),
    assertNumber((r['speed'] as Record<string, unknown>)?.['boostDuration'], 'speed.boostDuration', { positive: true }),
    assertNumber((r['speed'] as Record<string, unknown>)?.['megaDuration'], 'speed.megaDuration', { positive: true }),
  ));

  // steer
  errors.push(...collect(
    assertObject(r['steer'], 'steer'),
    assertNumber((r['steer'] as Record<string, unknown>)?.['maxLateralMps'], 'steer.maxLateralMps', { positive: true }),
    assertNumber((r['steer'] as Record<string, unknown>)?.['returnTau'], 'steer.returnTau', { positive: true }),
    assertNumber((r['steer'] as Record<string, unknown>)?.['wheelMaxDeg'], 'steer.wheelMaxDeg', { positive: true }),
    assertNumber((r['steer'] as Record<string, unknown>)?.['sensitivity'], 'steer.sensitivity', { positive: true }),
  ));

  // track
  errors.push(...collect(
    assertObject(r['track'], 'track'),
    assertNumber((r['track'] as Record<string, unknown>)?.['laneCount'], 'track.laneCount', { min: 1 }),
    assertNumber((r['track'] as Record<string, unknown>)?.['laneWidth'], 'track.laneWidth', { positive: true }),
    assertNumber((r['track'] as Record<string, unknown>)?.['chunkLength'], 'track.chunkLength', { positive: true }),
    assertNumber((r['track'] as Record<string, unknown>)?.['lookaheadChunks'], 'track.lookaheadChunks', { min: 1 }),
  ));

  // honk
  errors.push(...collect(
    assertObject(r['honk'], 'honk'),
    assertNumber((r['honk'] as Record<string, unknown>)?.['scareRadius'], 'honk.scareRadius', { positive: true }),
    assertNumber((r['honk'] as Record<string, unknown>)?.['fleeLateral'], 'honk.fleeLateral', { positive: true }),
    assertNumber((r['honk'] as Record<string, unknown>)?.['fleeDuration'], 'honk.fleeDuration', { positive: true }),
    assertNumber((r['honk'] as Record<string, unknown>)?.['cooldown'], 'honk.cooldown', { min: 0 }),
  ));

  // critters
  errors.push(...collect(
    assertObject(r['critters'], 'critters'),
    assertArray((r['critters'] as Record<string, unknown>)?.['kinds'], 'critters.kinds'),
    assertNumber((r['critters'] as Record<string, unknown>)?.['pickupMegaThreshold'], 'critters.pickupMegaThreshold', { min: 0, max: 1 }),
    assertNumber((r['critters'] as Record<string, unknown>)?.['pickupBoostThreshold'], 'critters.pickupBoostThreshold', { min: 0, max: 1 }),
  ));

  // obstacles
  errors.push(...collect(
    assertObject(r['obstacles'], 'obstacles'),
    assertObject((r['obstacles'] as Record<string, unknown>)?.['spawn'], 'obstacles.spawn'),
    assertNumber(((r['obstacles'] as Record<string, unknown>)?.['spawn'] as Record<string, unknown>)?.['minGap'], 'obstacles.spawn.minGap', { positive: true }),
    assertNumber(((r['obstacles'] as Record<string, unknown>)?.['spawn'] as Record<string, unknown>)?.['jitter'], 'obstacles.spawn.jitter', { min: 0 }),
    assertNumber(((r['obstacles'] as Record<string, unknown>)?.['spawn'] as Record<string, unknown>)?.['pickupMinGap'], 'obstacles.spawn.pickupMinGap', { positive: true }),
    assertNumber(((r['obstacles'] as Record<string, unknown>)?.['spawn'] as Record<string, unknown>)?.['pickupJitter'], 'obstacles.spawn.pickupJitter', { min: 0 }),
    assertObject((r['obstacles'] as Record<string, unknown>)?.['zoneWeights'], 'obstacles.zoneWeights'),
  ));

  // zones
  errors.push(...collect(assertObject(r['zones'], 'zones')));
  if (r['zones'] !== null && typeof r['zones'] === 'object') {
    for (const [zoneId, zone] of Object.entries(r['zones'] as Record<string, unknown>)) {
      const zr = zone as Record<string, unknown>;
      errors.push(...collect(
        assertObject(zone, `zones.${zoneId}`),
        assertString(zr?.['root'], `zones.${zoneId}.root`),
        assertNumber(zr?.['tempo'], `zones.${zoneId}.tempo`, { positive: true }),
        assertString(zr?.['colorGrade'], `zones.${zoneId}.colorGrade`),
      ));
    }
  }

  // audio
  errors.push(...collect(
    assertObject(r['audio'], 'audio'),
    assertObject((r['audio'] as Record<string, unknown>)?.['buses'], 'audio.buses'),
    assertNumber(((r['audio'] as Record<string, unknown>)?.['buses'] as Record<string, unknown>)?.['masterDb'], 'audio.buses.masterDb'),
    assertNumber(((r['audio'] as Record<string, unknown>)?.['buses'] as Record<string, unknown>)?.['musicDb'], 'audio.buses.musicDb'),
    assertNumber(((r['audio'] as Record<string, unknown>)?.['buses'] as Record<string, unknown>)?.['sfxDb'], 'audio.buses.sfxDb'),
    assertNumber(((r['audio'] as Record<string, unknown>)?.['buses'] as Record<string, unknown>)?.['ambDb'], 'audio.buses.ambDb'),
    assertObject((r['audio'] as Record<string, unknown>)?.['ducking'], 'audio.ducking'),
    assertNumber(((r['audio'] as Record<string, unknown>)?.['ducking'] as Record<string, unknown>)?.['depthDb'], 'audio.ducking.depthDb'),
    assertNumber(((r['audio'] as Record<string, unknown>)?.['ducking'] as Record<string, unknown>)?.['thresholdDb'], 'audio.ducking.thresholdDb'),
  ));

  // scoring
  errors.push(...collect(
    assertObject(r['scoring'], 'scoring'),
    assertNumber((r['scoring'] as Record<string, unknown>)?.['ticketReward'], 'scoring.ticketReward'),
    assertNumber((r['scoring'] as Record<string, unknown>)?.['boostReward'], 'scoring.boostReward'),
    assertNumber((r['scoring'] as Record<string, unknown>)?.['megaReward'], 'scoring.megaReward'),
    assertNumber((r['scoring'] as Record<string, unknown>)?.['crashDamage'], 'scoring.crashDamage', { positive: true }),
    assertNumber((r['scoring'] as Record<string, unknown>)?.['heavyCrashDamage'], 'scoring.heavyCrashDamage', { positive: true }),
    assertNumber((r['scoring'] as Record<string, unknown>)?.['sanityRegen'], 'scoring.sanityRegen', { min: 0 }),
  ));

  // combo
  errors.push(...collect(
    assertObject(r['combo'], 'combo'),
    assertNumber((r['combo'] as Record<string, unknown>)?.['windowMs'], 'combo.windowMs', { positive: true }),
    assertNumber((r['combo'] as Record<string, unknown>)?.['multiplierStep'], 'combo.multiplierStep', { positive: true }),
    assertNumber((r['combo'] as Record<string, unknown>)?.['maxMultiplier'], 'combo.maxMultiplier', { positive: true }),
  ));

  if (errors.length > 0) {
    return { ok: false, error: `tunables.json validation failed:\n  ${errors.join('\n  ')}` };
  }

  return { ok: true, data: raw as Tunables };
}
