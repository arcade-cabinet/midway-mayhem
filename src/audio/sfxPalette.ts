/**
 * @module audio/sfxPalette
 *
 * C2 — Per-zone SFX palette.
 *
 * Procedural Tone.js recipes for in-game events: honk variants (A/B/C/D),
 * balloonPop, ticketDing, trickWhoosh, plungeSwoosh, crashThud.
 *
 * Each function accepts a `zoneId` and an optional `intensity` [0..1] that
 * scales pitch/volume for context-sensitive feedback.
 *
 * All audio routes through the shared sfxBus from buses.ts.
 * No AudioContext is touched until a function is actually called.
 */

import * as Tone from 'tone';
import type { ZoneId } from '@/utils/constants';
import { getBuses } from './buses';

// ─── Zone pitch modifiers ────────────────────────────────────────────────────

/**
 * Each zone has a slight pitch offset (semitones) so the same SFX archetype
 * sounds tonally "at home" in different regions of the track.
 */
const ZONE_PITCH_OFFSET: Record<ZoneId, number> = {
  'midway-strip': 0,
  'balloon-alley': 2, // brighter, higher energy
  'ring-of-fire': -1, // slightly darker, more tension
  'funhouse-frenzy': 3, // goofy, high & fast
};

function zoneSemitones(zone: ZoneId): number {
  return ZONE_PITCH_OFFSET[zone] ?? 0;
}

/** Convert semitone offset to a frequency ratio multiplier. */
function semitonesToRatio(semitones: number): number {
  return 2 ** (semitones / 12);
}

// ─── Honk variants A / B / C / D ────────────────────────────────────────────

/** Honk A — classic car horn: DuoSynth square with a bark envelope. */
export function honkA(zone: ZoneId = 'midway-strip', intensity = 1): void {
  const { sfxBus } = getBuses();
  const ratio = semitonesToRatio(zoneSemitones(zone));
  const freq = 233 * ratio; // Bb3 base
  const synth = new Tone.DuoSynth({
    vibratoAmount: 0.15,
    vibratoRate: 7,
    voice0: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.004, decay: 0.05, sustain: 0.85, release: 0.1 },
    },
    voice1: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.004, decay: 0.05, sustain: 0.85, release: 0.1 },
    },
  });
  synth.harmonicity.value = 1.014;
  const dist = new Tone.Distortion(0.18).connect(sfxBus);
  synth.connect(dist);
  synth.volume.value = -8 + intensity * 3;
  const now = Tone.now();
  synth.triggerAttackRelease(freq, 0.2 + intensity * 0.1, now);
  setTimeout(() => {
    synth.dispose();
    dist.dispose();
  }, 600);
}

/** Honk B — ahooga / old-car: pitched MembraneSynth with a short ring. */
export function honkB(zone: ZoneId = 'midway-strip', intensity = 1): void {
  const { sfxBus } = getBuses();
  const ratio = semitonesToRatio(zoneSemitones(zone));
  const freq = 180 * ratio;
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.006, decay: 0.08, sustain: 0.7, release: 0.18 },
    filterEnvelope: {
      attack: 0.01,
      decay: 0.1,
      sustain: 0.4,
      release: 0.2,
      baseFrequency: 400,
      octaves: 2,
    },
  });
  const chorus = new Tone.Chorus(3, 2.5, 0.4).start().connect(sfxBus);
  synth.connect(chorus);
  synth.volume.value = -10 + intensity * 3;
  synth.triggerAttackRelease(freq, 0.22);
  setTimeout(() => {
    synth.dispose();
    chorus.dispose();
  }, 700);
}

/** Honk C — double-toot: two quick pulses, higher pitch. */
export function honkC(zone: ZoneId = 'midway-strip', intensity = 1): void {
  const { sfxBus } = getBuses();
  const ratio = semitonesToRatio(zoneSemitones(zone));
  const freqHi = 330 * ratio;
  const freqLo = 262 * ratio;
  const synth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.005, decay: 0.04, sustain: 0.7, release: 0.08 },
  });
  const dist = new Tone.Distortion(0.12).connect(sfxBus);
  synth.connect(dist);
  synth.volume.value = -9 + intensity * 3;
  const now = Tone.now();
  synth.triggerAttackRelease(freqHi, 0.08, now);
  synth.triggerAttackRelease(freqLo, 0.1, now + 0.12);
  setTimeout(() => {
    synth.dispose();
    dist.dispose();
  }, 600);
}

/** Honk D — slide whistle toot: signature clown register. */
export function honkD(zone: ZoneId = 'midway-strip', intensity = 1): void {
  const { sfxBus } = getBuses();
  const ratio = semitonesToRatio(zoneSemitones(zone));
  const startFreq = 260 * ratio;
  const endFreq = 440 * ratio;
  const osc = new Tone.Oscillator({ type: 'sine', frequency: startFreq });
  const env = new Tone.AmplitudeEnvelope({
    attack: 0.01,
    decay: 0.05,
    sustain: 0.8,
    release: 0.2,
  });
  const tremolo = new Tone.Tremolo(7, 0.12).start();
  osc.connect(env).connect(tremolo).connect(sfxBus);
  osc.volume.value = -10 + intensity * 4;
  osc.start();
  env.triggerAttackRelease(0.28);
  osc.frequency.rampTo(endFreq, 0.25);
  setTimeout(() => {
    osc.stop();
    osc.dispose();
    env.dispose();
    tremolo.dispose();
  }, 800);
}

// ─── Pickup / event SFX ─────────────────────────────────────────────────────

/** Balloon pop — short noise burst, high-pass, organic. */
export function balloonPop(zone: ZoneId = 'midway-strip', intensity = 1): void {
  const { sfxBus } = getBuses();
  const ratio = semitonesToRatio(zoneSemitones(zone));
  const freq = 2000 * ratio;
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.05 + intensity * 0.02, sustain: 0 },
  });
  const hp = new Tone.Filter(freq, 'highpass').connect(sfxBus);
  hp.Q.value = 1.5;
  noise.connect(hp);
  noise.volume.value = -4 + intensity * 2;
  noise.triggerAttackRelease(0.06);
  setTimeout(() => {
    noise.dispose();
    hp.dispose();
  }, 300);
}

/** Ticket ding — bright metallic chime (MetalSynth, short decay). */
export function ticketDing(zone: ZoneId = 'midway-strip', intensity = 1): void {
  const { sfxBus } = getBuses();
  const ratio = semitonesToRatio(zoneSemitones(zone));
  const metal = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.3 + intensity * 0.1, sustain: 0, release: 0.3 },
    harmonicity: 12,
    modulationIndex: 32,
    resonance: 4000 * ratio,
    octaves: 1.5,
  }).connect(sfxBus);
  metal.volume.value = -14 + intensity * 2;
  metal.triggerAttackRelease('A6', 0.3);
  setTimeout(() => {
    metal.dispose();
  }, 1000);
}

/** Trick whoosh — sweeping band-pass burst, stereo-width panned. */
export function trickWhoosh(zone: ZoneId = 'midway-strip', intensity = 1): void {
  const { sfxBus } = getBuses();
  const ratio = semitonesToRatio(zoneSemitones(zone));
  const startFreq = 200 * ratio;
  const endFreq = 3000 * ratio;
  const noise = new Tone.Noise('pink').start();
  const bp = new Tone.Filter({ type: 'bandpass', frequency: startFreq, Q: 4 });
  const env = new Tone.AmplitudeEnvelope({
    attack: 0.01,
    decay: 0.12,
    sustain: 0.3,
    release: 0.22,
  });
  const panner = new Tone.Panner(intensity > 0.5 ? 0.4 : -0.4).connect(sfxBus);
  noise.connect(bp).connect(env).connect(panner);
  env.triggerAttackRelease(0.3);
  bp.frequency.rampTo(endFreq, 0.3);
  setTimeout(() => {
    noise.stop();
    noise.dispose();
    bp.dispose();
    env.dispose();
    panner.dispose();
  }, 900);
}

/** Plunge swoosh — rapid downward glide, low + high register together. */
export function plungeSwoosh(zone: ZoneId = 'midway-strip', intensity = 1): void {
  const { sfxBus } = getBuses();
  const ratio = semitonesToRatio(zoneSemitones(zone));
  const hiFreq = 1200 * ratio;
  const loFreq = 80 * ratio;

  // High sine glide
  const hiOsc = new Tone.Oscillator({ type: 'sine', frequency: hiFreq });
  const hiEnv = new Tone.AmplitudeEnvelope({
    attack: 0.005,
    decay: 0.06,
    sustain: 0.6,
    release: 0.25,
  });
  hiOsc.connect(hiEnv).connect(sfxBus);
  hiOsc.volume.value = -12 + intensity * 2;
  hiOsc.start();
  hiEnv.triggerAttackRelease(0.35);
  hiOsc.frequency.rampTo(loFreq * 0.5, 0.4);

  // Low sub thump
  const loOsc = new Tone.Oscillator({ type: 'sine', frequency: loFreq });
  const loEnv = new Tone.AmplitudeEnvelope({
    attack: 0.01,
    decay: 0.08,
    sustain: 0.5,
    release: 0.3,
  });
  loOsc.connect(loEnv).connect(sfxBus);
  loOsc.volume.value = -8 + intensity * 2;
  loOsc.start();
  loEnv.triggerAttackRelease(0.3);
  loOsc.frequency.rampTo(loFreq * 0.25, 0.35);

  setTimeout(() => {
    hiOsc.stop();
    hiOsc.dispose();
    hiEnv.dispose();
    loOsc.stop();
    loOsc.dispose();
    loEnv.dispose();
  }, 1100);
}

/** Crash thud — layered impact: sub-frequency membrane + white-noise burst. */
export function crashThud(zone: ZoneId = 'midway-strip', intensity = 1): void {
  const { sfxBus } = getBuses();
  const ratio = semitonesToRatio(zoneSemitones(zone));

  // Membrane kick body
  const membrane = new Tone.MembraneSynth({
    pitchDecay: 0.07,
    octaves: 5,
    envelope: { attack: 0.001, decay: 0.25 + intensity * 0.1, sustain: 0 },
  }).connect(sfxBus);
  membrane.volume.value = -4 + intensity * 3;
  membrane.triggerAttackRelease(60 * ratio, 0.3);

  // Noise impact
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0 },
  });
  const lp = new Tone.Filter(1200 * ratio, 'lowpass').connect(sfxBus);
  noise.connect(lp);
  noise.volume.value = -8 + intensity * 2;
  noise.triggerAttackRelease(0.08);

  setTimeout(() => {
    membrane.dispose();
    noise.dispose();
    lp.dispose();
  }, 800);
}
