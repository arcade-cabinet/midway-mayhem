import * as Tone from 'tone';
import { tunables } from '@/config';
import type { ZoneId } from '@/utils/constants';
import { getBuses } from './buses';

/**
 * CircusConductor — phrase-grammar procedural music engine.
 *
 * Layers:
 *   1. Calliope lead (square wave + vibrato + reverb) — signature timbre
 *   2. Oom-pah backing (tuba staccato + chord stabs) — march pulse
 *
 * Each zone gets a distinct phrase arrangement + key signature.
 * Phrase templates drive the melody; transforms (octave shift, chromatic
 * neighbor, rhythmic augmentation) add variation.
 *
 * Zone key config (root/tempo) is sourced from `tunables.zones` so tuning
 * the calliope's per-zone mood is a config edit, not a code change.
 */

type PhraseDegree = number;

/** A phrase is a scale-degree sequence with note durations (16th-notes). */
interface Phrase {
  degrees: PhraseDegree[];
  durations: number[];
}

const PHRASES: Phrase[] = [
  // A-strain fanfare
  {
    degrees: [1, 3, 5, 8, 5, 3, 2, 1],
    durations: [1, 1, 1, 2, 1, 1, 1, 2],
  },
  // B-strain — chromatic descent
  {
    degrees: [8, 7, 6, 5, 4, 3, 2, 1],
    durations: [2, 1, 1, 2, 1, 1, 2, 2],
  },
  // Tritone run (Gladiators-style)
  {
    degrees: [5, 6, 7, 8, 7, 6, 5, 1],
    durations: [1, 1, 1, 2, 1, 1, 1, 2],
  },
  // Oom-pah melody simple
  {
    degrees: [1, 5, 3, 1, 4, 2, 5, 1],
    durations: [1, 1, 1, 1, 1, 1, 1, 2],
  },
];

function getZoneKey(zone: ZoneId): { root: string; tempo: number } {
  return tunables.zones[zone];
}

const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11, 12, 14];

class CircusConductor {
  private calliope: Tone.PolySynth | null = null;
  private tuba: Tone.MonoSynth | null = null;
  private reverb: Tone.Reverb | null = null;
  private currentZone: ZoneId | null = null;
  private sequence: Tone.Part | null = null;
  private bassLoop: Tone.Loop | null = null;

  init(): void {
    if (this.calliope) return;
    const { musicBus } = getBuses();

    this.reverb = new Tone.Reverb({ decay: 2.2, wet: 0.22 }).connect(musicBus);

    this.calliope = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'pulse', width: 0.35 },
      envelope: { attack: 0.01, decay: 0.08, sustain: 0.85, release: 0.15 },
    }).connect(new Tone.Vibrato(5, 0.04).connect(this.reverb));
    this.calliope.volume.value = -8;

    this.tuba = new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      filter: { Q: 2, frequency: 600, type: 'lowpass' },
      envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.08 },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0,
        release: 0.1,
        baseFrequency: 100,
        octaves: 2,
      },
    }).connect(musicBus);
    this.tuba.volume.value = -10;
  }

  start(zone: ZoneId = 'midway-strip'): void {
    this.init();
    this.setZone(zone);
    Tone.Transport.start();
  }

  stop(): void {
    this.bassLoop?.stop();
    this.bassLoop?.dispose();
    this.bassLoop = null;
    if (this.sequence) {
      this.sequence.stop();
      this.sequence.dispose();
      this.sequence = null;
    }
    // Clear currentZone so start(zone) with the same zone rebuilds the sequence
    this.currentZone = null;
    Tone.Transport.stop();
  }

  setZone(zone: ZoneId): void {
    if (this.currentZone === zone) return;
    this.currentZone = zone;
    const cfg = getZoneKey(zone);
    Tone.Transport.bpm.value = cfg.tempo;
    this.buildSequence(cfg.root);
  }

  private buildSequence(rootPitch: string): void {
    this.bassLoop?.stop();
    this.bassLoop?.dispose();
    this.bassLoop = null;
    if (this.sequence) {
      this.sequence.stop();
      this.sequence.dispose();
    }
    const rootFreq = Tone.Frequency(rootPitch).toFrequency();

    // Build a 16-bar pattern by cycling through phrase templates
    // biome-ignore lint/suspicious/noExplicitAny: Tone.Part event shape
    const events: Array<[string, any]> = [];
    let bar = 0;
    for (let p = 0; p < 4; p++) {
      const phrase = PHRASES[p % PHRASES.length];
      if (!phrase) {
        throw new Error(`[conductor] missing phrase at index ${p % PHRASES.length}`);
      }
      if (phrase.degrees.length !== phrase.durations.length) {
        throw new Error(
          `[conductor] phrase ${p} has mismatched degrees (${phrase.degrees.length}) and durations (${phrase.durations.length})`,
        );
      }
      let sixteenthInBar = 0;
      for (let i = 0; i < phrase.degrees.length; i++) {
        const degRaw = phrase.degrees[i];
        const dur = phrase.durations[i];
        if (degRaw === undefined || dur === undefined) {
          throw new Error(`[conductor] phrase ${p} has undefined note at index ${i}`);
        }
        const deg = degRaw - 1;
        const semitone = MAJOR_SCALE_STEPS[deg] ?? 0;
        const freq = rootFreq * 2 ** (semitone / 12);
        const time = `${bar}:0:${sixteenthInBar}`;
        events.push([time, { freq, dur: `${dur}*16n` }]);
        sixteenthInBar += dur;
        if (sixteenthInBar >= 16) {
          bar++;
          sixteenthInBar = 0;
        }
      }
      // Finish the bar if not full
      if (sixteenthInBar > 0) bar++;
    }

    // biome-ignore lint/suspicious/noExplicitAny: Tone.Part callback
    this.sequence = new Tone.Part((time: number, event: any) => {
      if (!this.calliope) return;
      this.calliope.triggerAttackRelease(event.freq, event.dur, time);
    }, events);
    this.sequence.loop = true;
    this.sequence.loopEnd = `${bar}m`;
    this.sequence.start(0);

    // Oom-pah bass on downbeats
    this.bassLoop = new Tone.Loop((time) => {
      if (!this.tuba) return;
      const rootOctDown = Tone.Frequency(rootPitch).transpose(-12).toFrequency();
      this.tuba.triggerAttackRelease(rootOctDown, '8n', time);
    }, '4n').start(0);
  }

  dispose(): void {
    this.stop(); // also disposes bassLoop and sequence, clears currentZone
    this.calliope?.dispose();
    this.tuba?.dispose();
    this.reverb?.dispose();
    this.calliope = null;
    this.tuba = null;
    this.reverb = null;
  }
}

export const conductor = new CircusConductor();
