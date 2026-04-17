import * as Tone from 'tone';
import type { PickupType, ZoneId } from '../utils/constants';
import { reportError } from './errorBus';

class AudioBus {
  private initialized = false;
  private enabled = true;
  private master: Tone.Volume | null = null;
  private engineSynth: Tone.PolySynth | null = null;
  private ambient: Tone.PolySynth | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();

    this.master = new Tone.Volume(-6).toDestination();
    const compressor = new Tone.Compressor(-18, 4).connect(this.master);

    this.engineSynth = new Tone.PolySynth(Tone.FMSynth, {
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.2 },
      modulationIndex: 6,
      harmonicity: 1.2,
    }).connect(compressor);
    this.engineSynth.volume.value = -16;
    this.engineSynth.triggerAttack('A2');
    new Tone.LFO('6hz', -20, -10).connect(this.engineSynth.volume).start();

    this.ambient = new Tone.PolySynth(Tone.Synth).connect(
      new Tone.Filter(800, 'lowpass').connect(compressor),
    );
    this.ambient.volume.value = -24;

    this.initialized = true;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (this.master) this.master.mute = !v;
  }

  setSpeed(speedMps: number): void {
    if (!this.engineSynth) return;
    this.engineSynth.set({ detune: (speedMps - 40) * 8 });
  }

  playHonk(): void {
    if (!this.initialized || !this.enabled) return;
    const now = Tone.now();
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();
    synth.volume.value = -10;
    const detune = (Math.random() - 0.5) * 80;
    const chord = ['C4', 'Eb4', 'Gb4', 'Bb4'].map((n) =>
      Tone.Frequency(n).transpose(detune / 100).toFrequency(),
    );
    synth.triggerAttackRelease(chord, 0.28, now);
    setTimeout(() => synth.dispose(), 800);
  }

  playCrash(): void {
    if (!this.initialized || !this.enabled) return;
    const noise = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.001, decay: 0.25, sustain: 0 },
    }).toDestination();
    noise.volume.value = -8;
    noise.triggerAttackRelease(0.25);
    setTimeout(() => noise.dispose(), 700);
  }

  playPickup(kind: PickupType): void {
    if (!this.initialized || !this.enabled) return;
    const now = Tone.now();
    const synth = new Tone.Synth({
      oscillator: { type: kind === 'mega' ? 'sawtooth' : 'sine' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.0, release: 0.2 },
    }).toDestination();
    synth.volume.value = kind === 'mega' ? -2 : -10;
    if (kind === 'mega') {
      synth.triggerAttackRelease('C5', 0.08, now);
      synth.triggerAttackRelease('E5', 0.08, now + 0.08);
      synth.triggerAttackRelease('G5', 0.12, now + 0.16);
    } else if (kind === 'boost') {
      synth.triggerAttackRelease('E5', 0.12, now);
    } else {
      synth.triggerAttackRelease('A5', 0.08, now);
    }
    setTimeout(() => synth.dispose(), 700);
  }

  setZone(zone: ZoneId): void {
    if (!this.ambient || !this.enabled) return;
    const notes: Record<ZoneId, string[]> = {
      'midway-strip': ['C3', 'E3', 'G3'],
      'balloon-alley': ['D3', 'F#3', 'A3'],
      'ring-of-fire': ['A2', 'C3', 'E3'],
      'funhouse-frenzy': ['F#2', 'A2', 'C#3'],
    };
    const picks = notes[zone];
    if (!picks) throw new Error(`[audioBus] Unknown zone: ${zone}`);
    this.ambient.triggerAttackRelease(picks, 2);
  }
}

export const audioBus = new AudioBus();

// Error-routing wrapper: only tried on explicit init() call from a user gesture.
export function initAudioBusSafely(): void {
  audioBus.init().catch((err: unknown) => reportError(err, 'audioBus.init'));
}
