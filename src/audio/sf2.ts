import { WorkletSynthesizer } from 'spessasynth_lib';
// Processor worklet script must be registered with the audio context BEFORE
// constructing a WorkletSynthesizer. Vite rewrites this `?url` import to the
// emitted asset URL at build time so it works in both dev + production.
import spessasynthProcessorUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url';
import * as Tone from 'tone';
import { reportError } from '@/game/errorBus';
import { getBuses } from './buses';

/**
 * SF2 sampled sweetener — GeneralUser GS soundfont loaded via
 * spessasynth_lib, routed through the shared musicBus so it sits
 * underneath the procedural calliope for sampled warmth on specific hits
 * (zone transitions, mega-boost cue, applause bed, etc.).
 *
 * Deliberately NOT the primary music engine — that's conductor.ts.
 * This layer is a punch-in "real instrument" on top.
 *
 * Soundfont is fetched at runtime from public/soundfonts/GeneralUser-GS.sf2
 * (gitignored, download via scripts/fetch-soundfonts.ts).
 *
 * Routing: WorkletSynthesizer → Tone.ToneAudioNode.output → musicBus.
 * SpessaSynth exposes a plain AudioNode via the standard `connect()` method;
 * we wrap it in a Tone.Gain so it lives in the Tone graph just like everything
 * else in buses.ts.
 */

// General MIDI program numbers (0-indexed) we care about.
export const GM = {
  ACCORDION: 21,
  HARMONICA: 22,
  TUBA: 57,
  MUTED_TRUMPET: 59,
  PICCOLO: 72,
  APPLAUSE: 126,
} as const;

class SF2Bridge {
  private synth: WorkletSynthesizer | null = null;
  private ready = false;
  private readyPromise: Promise<void> | null = null;
  private disabled = false;

  async init(soundfontUrl: string): Promise<void> {
    if (this.ready || this.readyPromise) return this.readyPromise ?? Promise.resolve();

    this.readyPromise = (async () => {
      await Tone.start();
      const toneCtx = Tone.getContext();
      const ctx = toneCtx.rawContext as unknown as AudioContext;

      // Tone.js wraps its AudioContext via the `standardized-audio-context`
      // polyfill. Chrome's native `AudioWorkletNode` rejects that wrapper
      // because it isn't a true `BaseAudioContext`. We detect the mismatch
      // and skip SF2 rather than halt the whole game — the procedural
      // calliope in conductor.ts is the primary music engine; SF2 is a
      // nice-to-have sweetener. See docs/ARCHITECTURE.md#audio.
      if (!(ctx instanceof (globalThis.BaseAudioContext ?? AudioContext))) {
        reportError(
          new Error('SF2 disabled: AudioContext wrapper incompatible with AudioWorklet'),
          'sf2Bridge.init',
        );
        this.disabled = true;
        return;
      }

      // Spessasynth requires the processor module to be registered on the
      // audio context BEFORE the WorkletSynthesizer is constructed.
      try {
        await ctx.audioWorklet.addModule(spessasynthProcessorUrl);
      } catch (err) {
        reportError(err, 'sf2Bridge.init — addModule failed');
        this.disabled = true;
        return;
      }

      // Fetch SF2 bytes. If the fetch 404s (SF2 not downloaded into
      // public/soundfonts/), fall back to disabled mode so the procedural
      // layer keeps working.
      const resp = await fetch(soundfontUrl);
      if (!resp.ok) {
        reportError(
          new Error(`SF2 soundfont not found at ${soundfontUrl} (status ${resp.status})`),
          'sf2Bridge.init',
        );
        this.disabled = true;
        return;
      }
      const buffer = await resp.arrayBuffer();

      const synth = new WorkletSynthesizer(ctx);
      await synth.isReady;
      await synth.soundBankManager.addSoundBank(buffer, 'gu-gs');

      const { musicBus } = getBuses();
      const sink = new Tone.Gain(1);
      sink.connect(musicBus);
      synth.connect(sink.input);

      this.synth = synth;
      this.ready = true;
    })().catch((err: unknown) => {
      reportError(err, 'sf2Bridge.init');
      this.disabled = true;
    });

    return this.readyPromise;
  }

  /** Trigger a single sampled note through program `program` on channel 0. */
  triggerNote(midiNote: number, velocity: number, durationS: number, program: number): void {
    if (!this.ready || !this.synth || this.disabled) return;
    this.synth.programChange(0, program);
    this.synth.noteOn(0, midiNote, velocity);
    setTimeout(() => {
      if (this.synth) this.synth.noteOn(0, midiNote, 0); // note off via vel=0
    }, durationS * 1000);
  }

  /** Fire a chord of sampled notes (e.g. a tuba stinger on zone change). */
  triggerChord(midiNotes: number[], velocity: number, durationS: number, program: number): void {
    if (!this.ready || !this.synth || this.disabled) return;
    this.synth.programChange(0, program);
    for (const n of midiNotes) this.synth.noteOn(0, n, velocity);
    setTimeout(() => {
      if (!this.synth) return;
      for (const n of midiNotes) this.synth.noteOn(0, n, 0);
    }, durationS * 1000);
  }

  isReady(): boolean {
    return this.ready;
  }

  isDisabled(): boolean {
    return this.disabled;
  }
}

export const sf2Bridge = new SF2Bridge();

export function initSF2Safely(baseUrl: string): void {
  const url = `${baseUrl.replace(/\/$/, '')}/soundfonts/GeneralUser-GS.sf2`;
  sf2Bridge.init(url).catch((err: unknown) => reportError(err, 'sf2Bridge.init'));
}
