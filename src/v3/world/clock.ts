import {easeOutCubic} from '../engine/easing';
import type {World} from './types';

// Held breaths and song time → arc (§2.1, §2.2). Real, not stubs.

export const FREEZES: [number, number][] = [[8.74625, 9.1685], [18.049875, 18.310792], [63.615, 64.03]]; // f525–550, f1083–1098, f3817–3841 (63.615 so f3817 = 63.6167 s is held)
/** Motion time: held at the freeze start inside each breath. Light keeps using real t. */
export const heldTime = (t: number) => {for (const [a, b] of FREEZES) if (t >= a && t < b) return a; return t;};
export const isFrozen = (t: number) => FREEZES.some(([a, b]) => t >= a && t < b);

/** Index of the last sorted time ≤ t, −1 when none. */
export function lastAtOrBefore(times: ArrayLike<number>, t: number) {
  let lo = 0, hi = times.length;
  while (lo < hi) {const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid + 1; else hi = mid;}
  return lo - 1;
}
/** Wick's arc at song time t: one tile per lead note, eased in over .09 s after each note-on; held through freezes. */
export function wickArc(w: World, t: number) {
  const tau = heldTime(t), k = lastAtOrBefore(w.noteStart, tau);
  if (k < 0) return 0;
  const from = k ? w.noteArc[k - 1] : 0;
  return from + easeOutCubic((tau - w.noteStart[k]) / .09) * (w.noteArc[k] - from);
}
/** Smoothed arc for cameras: mean of wickArc over the last .4 s. */
export const camArc = (w: World, t: number) => {let s = 0; for (let j = 0; j < 5; j++) s += wickArc(w, t - .1 * j); return s / 5;};
