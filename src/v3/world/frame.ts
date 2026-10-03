import type {Analysis} from '../../shared/types';
import type {Vec3} from '../engine/frame';
import {camArc, heldTime, isFrozen, lastAtOrBefore, wickArc} from './clock';
import {causewayY, routeCrisp, routeFrame} from './route';
import type {World, WorldFrame} from './types';

/** The last n times ≤ t, newest first, padded with −1e3. */
function lastN(times: Float64Array, t: number, n: number) {
  const out: number[] = [];
  for (let i = lastAtOrBefore(times, t); out.length < n; i--) out.push(i >= 0 ? times[i] : -1e3);
  return out;
}
const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/**
 * Per-frame world state at song time t (pure; numbers only).
 * REAL (Phase 0): held, frozen, arc, camArc, wick p/h/r (crisp), cam (smoothed) + causeway y, kicks/snares/hats, sparkle,
 * ghost default position (D 70, H 5), swell center.
 * STUB (Phase 0), WP1 replaces: wick y (causeway only: no hop/climb), wick scale 1 / glow 1 / dot 0, pedal 0, swell amp 0,
 * ghost glow/radius constant (no stabs, turns, tunnel/descent/join paths), answer invisible at its home,
 * shadow/horizon/hammer/ring zero, beams empty.
 */
export function worldAt(w: World, a: Analysis, t: number): WorldFrame {
  const held = heldTime(t), arc = wickArc(w, t), ca = camArc(w, t);
  const wick = routeCrisp(arc), cam = routeFrame(ca), yCam = causewayY(w, ca, t);
  return {
    held, frozen: +isFrozen(t), arc, camArc: ca,
    wick: {...wick, y: causewayY(w, arc, t), scale: 1, glow: 1, dot: 0},
    cam: {...cam, y: yCam},
    pedal: 0,
    swell: {center: routeFrame(arc - 10).p, amp: 0},
    kicks: lastN(w.kicks, held, 6), snares: lastN(w.snares, held, 2), hats: lastN(w.hats, held, 4),
    ghost: {p: add(add(add(cam.p, cam.h, 70), [0, 5 + yCam, 0]), cam.r, -4), glow: .35, radius: 1.2},
    answer: {p: w.answerHome, glow: 0, visible: 0, stand: 0},
    shadow: {strength: 0, frontArc: 0, sky: 0, pulse: 0},
    horizon: {glow: 0, tint: 0},
    hammer: 0,
    ring: {center: wick.p, radius: 0, flash: 0},
    beams: [],
    sparkle: t < 82.35 ? 1 : 0,
  };
}
