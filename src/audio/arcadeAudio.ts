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
  setMusicPlaying(on: boolean): void;
  pickupDing(): void;
  hitThud(): void;
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

  // Wind/rush: pink-noise low-passed. Gain + filter cutoff grow with speed
  // so idle is silent and cruising has a clear "air rushing past" layer.
  const windFilter = new Tone.Filter(400, 'lowpass').connect(master);
  windFilter.Q.value = 0.7;
  const windNoise = new Tone.Noise('pink').connect(windFilter);
  const windGain = new Tone.Gain(0).connect(windFilter);
  windNoise.connect(windGain);
  windNoise.start();

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

  // Circus organ bed — a PolySynth on a looped carnival progression (I → V → vi → IV)
  // played as short chord stabs. Ducked below engine so it sits under.
  const musicGain = new Tone.Gain(0).connect(master);
  const organ = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.04, decay: 0.3, sustain: 0.3, release: 0.4 },
  }).connect(musicGain);
  organ.volume.value = -8;
  const chords: string[][] = [
    ['C4', 'E4', 'G4'],
    ['G3', 'B3', 'D4'],
    ['A3', 'C4', 'E4'],
    ['F3', 'A3', 'C4'],
  ];
  const loop = new Tone.Loop((time) => {
    const idx = Math.floor(Tone.Transport.seconds / 1.2) % chords.length;
    const chord = chords[idx];
    if (chord) organ.triggerAttackRelease(chord, 0.6, time);
  }, 1.2);

  // Pickup ding — short bright blip.
  const dingEnv = new Tone.AmplitudeEnvelope({
    attack: 0.005,
    decay: 0.2,
    sustain: 0,
    release: 0.1,
  }).connect(master);
  const dingOsc = new Tone.Oscillator(880, 'triangle').connect(dingEnv);
  dingOsc.volume.value = -10;
  dingOsc.start();

  // Hit thud — low body thunk.
  const thudEnv = new Tone.AmplitudeEnvelope({
    attack: 0.002,
    decay: 0.15,
    sustain: 0,
    release: 0.08,
  }).connect(master);
  const thudOsc = new Tone.Oscillator(90, 'sine').connect(thudEnv);
  thudOsc.volume.value = -6;
  thudOsc.start();

  handle = {
    updateEngine(speedMps, cruiseMps) {
      const norm = Math.min(1, Math.max(0, speedMps / Math.max(1, cruiseMps)));
      const baseFreq = 55 + norm * norm * 165;
      engineOsc.frequency.rampTo(baseFreq, 0.05);
      engineOsc2.frequency.rampTo(baseFreq * 1.5, 0.05);
      engineGain.gain.rampTo(0.15 + norm * 0.25, 0.05);
      // Wind: gain + brightness scale with speed squared so it's absent at
      // idle and dominant at cruise.
      windGain.gain.rampTo(norm * norm * 0.18, 0.05);
      windFilter.frequency.rampTo(400 + norm * 2200, 0.05);
    },
    setTireSqueal(active) {
      squealGain.gain.rampTo(active ? 0.1 : 0, 0.08);
    },
    honk() {
      hornEnv.triggerAttackRelease(0.25);
    },
    setMusicPlaying(on) {
      if (on) {
        musicGain.gain.rampTo(0.25, 0.4);
        // Conductor owns the Tone.Transport lifecycle — calling start/stop
        // from here too races with conductor.stop() on game-over and
        // silently drops pending triggerAttackRelease events scheduled on
        // the other side of the Transport. Resume the context only (safe
        // and idempotent) and trust the conductor to keep Transport live.
        const ctx = Tone.getContext();
        if (ctx.state === 'suspended') ctx.resume();
        if (loop.state !== 'started') loop.start(0);
      } else {
        musicGain.gain.rampTo(0, 0.3);
      }
    },
    pickupDing() {
      dingEnv.triggerAttackRelease(0.18);
      dingOsc.frequency.setValueAtTime(880 + Math.random() * 220, Tone.now());
    },
    hitThud() {
      thudEnv.triggerAttackRelease(0.12);
    },
    dispose() {
      loop.stop();
      loop.dispose();
      organ.dispose();
      dingOsc.stop();
      thudOsc.stop();
      engineOsc.stop();
      engineOsc2.stop();
      squealNoise.stop();
      windNoise.stop();
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
