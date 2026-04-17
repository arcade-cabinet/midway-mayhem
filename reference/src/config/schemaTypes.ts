/**
 * @module config/schemaTypes
 *
 * TypeScript interfaces for the tunables configuration schema.
 * Extracted from schema.ts to keep that file under 300 LOC.
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
