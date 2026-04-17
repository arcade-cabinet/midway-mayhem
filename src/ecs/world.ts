/**
 * The single koota world for the whole game. One universe, one source of
 * truth. All state flows through traits and systems — no zustand, no
 * scattered stores. Hot-reload safe: the world is a stable module export.
 */
import { createWorld } from 'koota';

export const world = createWorld();

export type World = typeof world;
