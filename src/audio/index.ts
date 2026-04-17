/**
 * @/audio — public barrel for the audio sub-package.
 * Import from here, not from deep paths.
 */
export { audioBus, initAudioBusSafely } from '../systems/audioBus';
export { honk, onHonk } from '../systems/honkBus';
export { getBuses, initBuses } from '../systems/audio/buses';
export type { Buses } from '../systems/audio/buses';
