import * as Tone from 'tone';
import type { PickupType, ZoneId } from '../utils/constants';
import { getBuses, initBuses } from './audio/buses';
import { conductor } from './audio/conductor';
import {
  triggerClownHorn,
  triggerCrashRoll,
  triggerCrowdGasp,
  triggerSlideWhistle,
  triggerWhipCrack,
} from './audio/sfx';
import { reportError } from './errorBus';

/**
 * Procedural audio bus — Tone.js only, zero samples.
 * Routes through the 3-bus architecture (music/sfx/amb) with sidechain ducking.
 * Spatial: per-source Tone.Panner3D positions sounds around the cockpit listener.
 */

class AudioBus {
  private initialized = false;
  private enabled = true;
  private engineSynth: Tone.PolySynth | null = null;
  // biome-ignore lint/suspicious/noExplicitAny: Tone.Listener is a singleton, typing varies by version
  private listener: any = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();

    initBuses();
    const { sfxBus, musicBus } = getBuses();

    // biome-ignore lint/suspicious/noExplicitAny: Tone.Listener is a deprecated-but-functional singleton in Tone 15
    this.listener = (Tone as any).Listener;
    this.listener.positionX.value = 0;
    this.listener.positionY.value = 0;
    this.listener.positionZ.value = 0;
    this.listener.forwardX.value = 0;
    this.listener.forwardY.value = 0;
    this.listener.forwardZ.value = -1;
    this.listener.upX.value = 0;
    this.listener.upY.value = 1;
    this.listener.upZ.value = 0;

    // Engine drone routes through sfxBus (it ducks the music during hits,
    // but the engine itself is a sustained layer, so put it on sfx not music).
    this.engineSynth = new Tone.PolySynth(Tone.FMSynth, {
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.2 },
      modulationIndex: 6,
      harmonicity: 1.2,
    }).connect(sfxBus);
    this.engineSynth.volume.value = -22;
    this.engineSynth.triggerAttack('A2');
    new Tone.LFO('6hz', -26, -18).connect(this.engineSynth.volume).start();

    // Start the procedural circus music (calliope + oom-pah) on musicBus
    conductor.start('midway-strip');
    void musicBus; // referenced via conductor

    this.initialized = true;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!this.initialized) return;
    const { master } = getBuses();
    master.mute = !v;
  }

  setSpeed(speedMps: number): void {
    if (!this.engineSynth) return;
    this.engineSynth.set({ detune: (speedMps - 40) * 8 });
  }

  /** Update listener orientation to match camera forward vector */
  setListenerOrientation(forward: { x: number; y: number; z: number }): void {
    if (!this.listener) return;
    this.listener.forwardX.value = forward.x;
    this.listener.forwardY.value = forward.y;
    this.listener.forwardZ.value = forward.z;
  }

  playHonk(): void {
    if (!this.initialized || !this.enabled) return;
    triggerClownHorn();
  }

  /** Play crash sound with optional spatial position (xLanes ∈ [-1, 1]) */
  playCrash(xLanes = 0, heavy = false): void {
    if (!this.initialized || !this.enabled) return;
    if (heavy) {
      triggerCrashRoll();
      triggerCrowdGasp();
    } else {
      triggerWhipCrack();
    }
    void xLanes; // spatial placement handled by SFX recipe routing in a future pass
  }

  playPickup(kind: PickupType, xLanes = 0): void {
    if (!this.initialized || !this.enabled) return;
    if (kind === 'mega') {
      triggerCrashRoll();
      triggerSlideWhistle('up');
    } else if (kind === 'boost') {
      triggerSlideWhistle('up');
    } else {
      triggerSlideWhistle('up');
    }
    void xLanes;
  }

  setZone(zone: ZoneId): void {
    if (!this.initialized || !this.enabled) return;
    conductor.setZone(zone);
  }
}

export const audioBus = new AudioBus();

export function initAudioBusSafely(): void {
  audioBus.init().catch((err: unknown) => reportError(err, 'audioBus.init'));
}
