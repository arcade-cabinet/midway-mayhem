/**
 * Procedural arcade audio — engine growl that tracks Speed, honk clusters
 * on command, tire squeal when hard-steering.
 *
 * Tone.js requires a user gesture to start the AudioContext, so the
 * entire module is lazy: the first call to `startArcadeAudio()` does
 * the Tone.start() handshake, builds the synths, and returns a handle.
 * Subsequent calls are no-ops.
 *
 * NO soundfonts. Every sound is synthesized at runtime so the bundle
 * stays small and the circus feel is instantly re-themable.
 */
import * as Tone from 'tone';

export interface ArcadeAudioHandle {
  updateEngine(speedMps: number, cruiseMps: number): void;
  setTireSqueal(active: boolean): void;
  honk(): void;
  dispose(): void;
}

let handle: ArcadeAudioHandle | null = null;

export async function startArcadeAudio(): Promise<ArcadeAudioHandle> {
  if (handle) return handle;
  await Tone.start();

  const master = new Tone.Gain(0.3).toDestination();

  // Engine: low sawtooth whose frequency follows speed, with a second
  // detuned voice for body. Filter cuts the top off so it growls instead
  // of whining.
  const engineFilter = new Tone.Filter(800, 'lowpass').connect(master);
  const engineOsc = new Tone.Oscillator(55, 'sawtooth').connect(engineFilter);
  const engineOsc2 = new Tone.Oscillator(83, 'sawtooth').connect(engineFilter);
  const engineGain = new Tone.Gain(0).connect(engineFilter);
  engineOsc.connect(engineGain);
  engineOsc2.connect(engineGain);
  engineOsc.start();
  engineOsc2.start();

  // Tire squeal: band-passed noise, ducked by default.
  const squealFilter = new Tone.Filter(2400, 'bandpass').connect(master);
  squealFilter.Q.value = 8;
  const squealNoise = new Tone.Noise('white').connect(squealFilter);
  const squealGain = new Tone.Gain(0).connect(squealFilter);
  squealNoise.connect(squealGain);
  squealNoise.start();

  // Horn: clown-car cluster — two detuned square waves, quick envelope.
  const hornEnv = new Tone.AmplitudeEnvelope({
    attack: 0.01,
    decay: 0.08,
    sustain: 0.4,
    release: 0.3,
  }).connect(master);
  const hornOsc1 = new Tone.Oscillator(392, 'square').connect(hornEnv);
  const hornOsc2 = new Tone.Oscillator(523, 'square').connect(hornEnv);
  hornOsc1.volume.value = -12;
  hornOsc2.volume.value = -14;
  hornOsc1.start();
  hornOsc2.start();

  handle = {
    updateEngine(speedMps, cruiseMps) {
      const norm = Math.min(1, Math.max(0, speedMps / Math.max(1, cruiseMps)));
      const baseFreq = 55 + norm * norm * 165;
      engineOsc.frequency.rampTo(baseFreq, 0.05);
      engineOsc2.frequency.rampTo(baseFreq * 1.5, 0.05);
      engineGain.gain.rampTo(0.15 + norm * 0.25, 0.05);
    },
    setTireSqueal(active) {
      squealGain.gain.rampTo(active ? 0.1 : 0, 0.08);
    },
    honk() {
      hornEnv.triggerAttackRelease(0.25);
    },
    dispose() {
      engineOsc.stop();
      engineOsc2.stop();
      squealNoise.stop();
      hornOsc1.stop();
      hornOsc2.stop();
      master.disconnect();
      handle = null;
    },
  };
  return handle;
}

export function isArcadeAudioStarted(): boolean {
  return handle !== null;
}
