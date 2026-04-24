/**
 * @module audio/stingers
 *
 * C4 — Music stingers.
 *
 * One-shot procedural riffs fired on narrative moments:
 *   - Zone transition  → playZoneStinger(zoneId)
 *   - 1000m milestone  → playMilestoneStinger()
 *   - Run clear        → playClearStinger()
 *
 * All stingers are fully procedural (Tone.js only — no samples required)
 * and route through the shared sfxBus. SF2 enhancement is layered on top
 * when the bridge is ready (non-blocking; degrades gracefully if SF2 is
 * not available — the procedural layer always fires).
 *
 * Stingers self-dispose after their natural decay time.
 */

import * as Tone from 'tone';
import type { ZoneId } from '@/utils/constants';
import { getBuses } from './buses';

// ─── Zone stinger archetypes ─────────────────────────────────────────────────

/** Per-zone riff: root MIDI note + interval set + tempo + timbre flavour. */
interface ZoneStingerDef {
  /** MIDI note number of the riff root. */
  root: number;
  /** Scale-degree intervals (semitones above root) in sequence. */
  degrees: number[];
  /** Duration of each note in Tone.js notation. */
  noteDuration: Tone.Unit.Time;
  /** BPM for this stinger phrase. */
  bpm: number;
  /** Synth wave type to reinforce zone identity. */
  waveType: OscillatorType;
}

const ZONE_STINGER_DEFS: Record<ZoneId, ZoneStingerDef> = {
  'midway-strip': {
    root: 60, // C4 — bright, major fanfare
    degrees: [0, 4, 7, 12, 7, 4, 0],
    noteDuration: '8n',
    bpm: 132,
    waveType: 'square',
  },
  'balloon-alley': {
    root: 62, // D4 — playful, pentatonic bounce
    degrees: [0, 3, 5, 7, 10, 7, 5],
    noteDuration: '8n',
    bpm: 152,
    waveType: 'triangle',
  },
  'ring-of-fire': {
    root: 57, // A3 — diminished/tense, minor 2nds
    degrees: [0, 1, 4, 6, 7, 6, 4],
    noteDuration: '16n',
    bpm: 168,
    waveType: 'sawtooth',
  },
  'funhouse-frenzy': {
    root: 65, // F4 — chaotic chromatic, wide leaps
    degrees: [0, 6, 2, 10, 4, 8, 12],
    noteDuration: '8n',
    bpm: 180,
    waveType: 'square',
  },
};

// ─── Zone stinger ────────────────────────────────────────────────────────────

/**
 * Fire a short zone-identity riff.
 * Called by zoneBus when the player crosses a zone boundary.
 */
export function playZoneStinger(zone: ZoneId): void {
  let sfxBus: ReturnType<typeof getBuses>['sfxBus'];
  try {
    sfxBus = getBuses().sfxBus;
  } catch {
    return; // buses not ready — no-op
  }

  const def = ZONE_STINGER_DEFS[zone];
  const synth = new Tone.Synth({
    oscillator: { type: def.waveType },
    envelope: { attack: 0.005, decay: 0.06, sustain: 0.7, release: 0.12 },
  });
  const delay = new Tone.FeedbackDelay('16n', 0.2).connect(sfxBus);
  synth.connect(delay);
  synth.volume.value = -9;

  const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
  const secondsPerBeat = 60 / def.bpm;
  // 8n = 0.5 beat, 16n = 0.25 beat
  const noteS = def.noteDuration === '8n' ? secondsPerBeat * 0.5 : secondsPerBeat * 0.25;

  const now = Tone.now();
  def.degrees.forEach((semitones, i) => {
    synth.triggerAttackRelease(midiToFreq(def.root + semitones), noteS * 0.85, now + i * noteS);
  });

  const totalMs = (def.degrees.length * noteS + 1.0) * 1000;
  setTimeout(() => {
    synth.dispose();
    delay.dispose();
  }, totalMs);
}

// ─── Milestone stinger (1000m, 2000m, …) ────────────────────────────────────

/**
 * Ascending fanfare — bright, triumphant, short.
 * Called once per 1000m milestone by the game loop.
 */
export function playMilestoneStinger(): void {
  let sfxBus: ReturnType<typeof getBuses>['sfxBus'];
  try {
    sfxBus = getBuses().sfxBus;
  } catch {
    return;
  }

  // Ascending major 7th arpeggio at high tempo
  const notes = [60, 64, 67, 71, 72]; // C4–E4–G4–B4–C5
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.004, decay: 0.05, sustain: 0.75, release: 0.2 },
  }).connect(sfxBus);
  synth.volume.value = -8;
  const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
  const now = Tone.now();
  notes.forEach((midi, i) => {
    synth.triggerAttackRelease(midiToFreq(midi), 0.18, now + i * 0.08);
  });
  // Sustain final chord briefly
  synth.triggerAttackRelease(notes.map(midiToFreq), 0.35, now + notes.length * 0.08);

  setTimeout(() => {
    synth.dispose();
  }, 1600);
}

// ─── Run clear stinger ───────────────────────────────────────────────────────

/**
 * Triumphant full-cadence stinger — called when the player completes a run.
 * Longer, more elaborate than a milestone stinger.
 */
export function playClearStinger(): void {
  let sfxBus: ReturnType<typeof getBuses>['sfxBus'];
  try {
    sfxBus = getBuses().sfxBus;
  } catch {
    return;
  }

  const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

  // Calliope lead — ascending then descending run
  const leadNotes = [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 72];
  const lead = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.004, decay: 0.05, sustain: 0.8, release: 0.12 },
  });
  const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.2 }).connect(sfxBus);
  lead.connect(reverb);
  lead.volume.value = -6;

  const now = Tone.now();
  const noteStep = 0.1;
  leadNotes.forEach((midi, i) => {
    lead.triggerAttackRelease(midiToFreq(midi), noteStep * 0.8, now + i * noteStep);
  });

  // Tuba chords beneath the lead (quarter notes, oom-pah figure)
  const tubaNotes = [
    [48, 52], // C3–E3
    [43, 47], // G2–B2
    [45, 48], // A2–C3
    [48, 55], // C3–G3 — final open 5th
  ];
  const tuba = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.3 },
  }).connect(sfxBus);
  tuba.volume.value = -13;
  tubaNotes.forEach((chord, i) => {
    tuba.triggerAttackRelease(chord.map(midiToFreq), 0.35, now + i * 0.3);
  });

  const totalMs = (leadNotes.length * noteStep + tubaNotes.length * 0.3 + 1.5) * 1000;
  setTimeout(() => {
    lead.dispose();
    reverb.dispose();
    tuba.dispose();
  }, totalMs);
}
