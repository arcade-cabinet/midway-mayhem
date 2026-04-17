/**
 * @/audio — public barrel for the audio sub-package.
 * Import from here, not from deep paths.
 */
export { audioBus, initAudioBusSafely } from '@/audio/audioBus';
export { honk, onHonk } from '@/audio/honkBus';
export { getBuses, initBuses } from '@/audio/buses';
export type { Buses } from '@/audio/buses';
