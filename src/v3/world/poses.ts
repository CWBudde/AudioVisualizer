import {hash01} from '../engine/random';
import type {WalkerTable, World} from './types';

export const WALKERS = 2048, POSE = 8; // pose stride: [x, y, z, yaw, lie, stand, head, spark]

/**
 * STUB (Phase 0): cohort and seed are real (0–45 trail, 46–199 guard, 200+ plain); every slot, wake and
 * rest time is zero. WP1 replaces this with the cohort/slot table of §2.5.
 */
export function buildWalkers(): WalkerTable {
  const n = WALKERS, f = () => new Float32Array(n);
  const cohort = new Uint8Array(n), seed = new Float32Array(n);
  for (let k = 0; k < n; k++) {cohort[k] = k < 46 ? 0 : k < 200 ? 1 : 2; seed[k] = hash01(0x5eed, k);}
  return {count: n, cohort, homeArc: f(), homeLat: f(), wake: f(), restLight: f(), b1a: f(), b1b: f(), b2: f(), l2: f(), row2: new Uint16Array(n), b3: f(), l3: f(), seed};
}

let cache: {w: World; t: number; poses: Float32Array} | null = null;
/**
 * All walker poses at t: WALKERS × [x, y, z, yaw, lie, stand, head, spark], single-entry cache keyed by t
 * so both layers of a transition share one evaluation. Treat the result as read-only.
 * STUB (Phase 0): every walker is invisible (stand 0) and parked at the origin. WP1 implements walkerPose (§2.5).
 */
export function posesAt(w: World, t: number): Float32Array {
  if (cache && cache.w === w && cache.t === t) return cache.poses;
  const poses = cache?.w === w ? cache.poses : new Float32Array(w.walkers.count * POSE);
  cache = {w, t, poses};
  return poses;
}
