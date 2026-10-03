import type {World} from './types';

export const TILES = 160, MAX_EVENTS = 8;
/** Event kinds packed as kind · 128 + time (§2.4). */
export const EVENT = {contact: 1, contactCold: 2, wake: 3, stampAmber: 4, stampCrimson: 5, blink: 6, crestFill: 7, answer: 8} as const;

/**
 * STUB (Phase 0): allocates the tile tables only. Events are all empty (−1), arc/lateral/crest are zero.
 * WP1 replaces this with the real per-cell tileArc/tileLateral/crest and every event source of §2.4/§2.6.
 */
export function buildTiles(): World['tiles'] {
  const n = TILES * TILES, events: [Float32Array, Float32Array] = [new Float32Array(n * 4).fill(-1), new Float32Array(n * 4).fill(-1)];
  return {size: TILES, events, arc: new Float32Array(n), lateral: new Float32Array(n), crest: new Uint8Array(n)};
}
