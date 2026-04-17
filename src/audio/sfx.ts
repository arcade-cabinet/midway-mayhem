import * as Tone from 'tone';
import { getBuses } from './buses';

/**
 * Procedural SFX recipes — infinite variation, CC-clean, spatializable.
 * Each returns a trigger function that routes through the sfxBus.
 * Per reference_circus_audio_architecture.md.
 */

/**
 * Slide whistle — pratfalls, reactions.
 * Sine osc with exponential freq ramp, short envelope, tiny tremolo.
 */
export function triggerSlideWhistle(direction: 'up' | 'down' = 'up'): void {
  const { sfxBus } = getBuses();
  const osc = new Tone.Oscillator({ type: 'sine', frequency: direction === 'up' ? 200 : 1200 });
  const env = new Tone.AmplitudeEnvelope({ attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.3 });
  const tremolo = new Tone.Tremolo(6, 0.08).start();
  osc.connect(env).connect(tremolo).connect(sfxBus);
  osc.start();
  env.triggerAttackRelease(0.45);
  osc.frequency.rampTo(direction === 'up' ? 1600 : 160, 0.35);
  setTimeout(() => {
    osc.stop();
    osc.dispose();
    env.dispose();
    tremolo.dispose();
  }, 800);
}

/**
 * Whip crack — 30ms white noise burst with highpass sweep 2k → 8k.
 */
export function triggerWhipCrack(): void {
  const { sfxBus } = getBuses();
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0 },
  });
  const filter = new Tone.Filter(2000, 'highpass').connect(sfxBus);
  filter.Q.value = 2;
  noise.connect(filter);
  noise.volume.value = -6;
  noise.triggerAttackRelease(0.06);
  filter.frequency.rampTo(8000, 0.04);
  setTimeout(() => {
    noise.dispose();
    filter.dispose();
  }, 300);
}

/**
 * Clown bulb horn — squeezed-bulb character via detuned square + pitch dip.
 */
export function triggerClownHorn(): void {
  const { sfxBus } = getBuses();
  const synth = new Tone.DuoSynth({
    vibratoAmount: 0.2,
    vibratoRate: 8,
    voice0: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.02, sustain: 0.7, release: 0.08 },
    },
    voice1: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.02, sustain: 0.7, release: 0.08 },
    },
  });
  synth.harmonicity.value = 1.012; // 12-cent detune between voices
  const dist = new Tone.Distortion(0.2).connect(sfxBus);
  synth.connect(dist);
  synth.volume.value = -10;
  const now = Tone.now();
  synth.triggerAttackRelease('D4', 0.22, now);
  setTimeout(() => {
    synth.dispose();
    dist.dispose();
  }, 700);
}

/**
 * Drumroll + cymbal crash stinger — the universal "trick landed" punch.
 * MembraneSynth at 32nd-notes, randomized velocity, resolving into MetalSynth.
 */
export function triggerCrashRoll(): void {
  const { sfxBus } = getBuses();
  const membrane = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
  }).connect(sfxBus);
  const metal = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.6, sustain: 0.05, release: 1.2 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).connect(sfxBus);
  membrane.volume.value = -6;
  metal.volume.value = -12;

  const now = Tone.now();
  // 32nd-note roll for ~0.5 seconds
  for (let i = 0; i < 14; i++) {
    const vel = 0.3 + Math.random() * 0.5;
    membrane.triggerAttackRelease('C3', 0.05, now + i * 0.04, vel);
  }
  // Cymbal crash resolution
  metal.triggerAttackRelease('A5', 0.4, now + 14 * 0.04);

  setTimeout(() => {
    membrane.dispose();
    metal.dispose();
  }, 2200);
}

/**
 * Crowd gasp — low-passed pink noise swell, triggered on near-misses.
 */
export function triggerCrowdGasp(): void {
  const { ambBus } = getBuses();
  const noise = new Tone.Noise('pink').start();
  const filter = new Tone.Filter(800, 'lowpass').connect(ambBus);
  filter.Q.value = 0.7;
  const env = new Tone.AmplitudeEnvelope({
    attack: 0.4,
    decay: 0.1,
    sustain: 0.6,
    release: 0.8,
  });
  noise.connect(env).connect(filter);
  env.triggerAttackRelease(0.2);
  filter.frequency.rampTo(1600, 0.5);
  setTimeout(() => {
    noise.stop();
    noise.dispose();
    env.dispose();
    filter.dispose();
  }, 1500);
}

/**
 * Applause bed — sustained pink noise bandpassed + amp-modulated.
 * Three instances at hard L, hard R, center = crowd surrounding you.
 */
export function startApplauseBed(volume = -16): () => void {
  const { ambBus } = getBuses();
  const layers: Array<{
    noise: Tone.Noise;
    filter: Tone.Filter;
    clapMod: Tone.LFO;
    panner: Tone.Panner;
    gain: Tone.Gain;
  }> = [];

  for (const pan of [-0.85, 0, 0.85]) {
    const noise = new Tone.Noise('pink').start();
    const filter = new Tone.Filter(2000, 'bandpass');
    filter.Q.value = 1.5;
    const clapMod = new Tone.LFO({
      frequency: 12 + Math.random() * 6,
      min: 0.1,
      max: 1.0,
      type: 'sine',
    }).start();
    const gain = new Tone.Gain(0.5);
    const panner = new Tone.Panner(pan).connect(ambBus);
    noise.connect(filter).connect(gain).connect(panner);
    clapMod.connect(gain.gain);
    layers.push({ noise, filter, clapMod, panner, gain });
  }
  // biome-ignore lint/suspicious/noExplicitAny: gain channel setter
  for (const l of layers) (l.panner as any).volume.value = volume;

  return () => {
    for (const l of layers) {
      l.noise.stop();
      l.noise.dispose();
      l.filter.dispose();
      l.clapMod.dispose();
      l.panner.dispose();
      l.gain.dispose();
    }
  };
}
