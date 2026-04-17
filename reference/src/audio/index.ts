/**
 * @/audio — public barrel for the audio sub-package.
 * Import from here, not from deep paths.
 */
export { audioBus, initAudioBusSafely } from '@/audio/audioBus';
export type { Buses } from '@/audio/buses';
export { getBuses, initBuses } from '@/audio/buses';
export { honk, onHonk } from '@/audio/honkBus';
