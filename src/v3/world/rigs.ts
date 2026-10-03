import type {CameraPose, Vec3} from '../engine/frame';
import {easeInOutCubic, lerp, smoothstep} from '../engine/easing';
import type {Rig, WorldFrame} from './types';

// Camera rigs (§2.7). Real, not stubs.

export type RigName = 'dolly' | 'paradeHigh' | 'topDiag' | 'topDiagLow' | 'chase' | 'grandHigh' | 'grandCauseway';
export const RIGS: Record<RigName, Rig> = {
  dolly: {back: 1.5, side: -6.5, up: 1.4, ahead: 3, lift: .5, fov: 40},        // + .15 sin(.4t) bob, added by followRig
  paradeHigh: {back: 10, side: -8, up: 9, ahead: 5, lift: 0, fov: 45},
  topDiag: {back: 8, side: -8, up: 24, ahead: 4, lift: 0, fov: 42},
  topDiagLow: {back: 12, side: -9, up: 12, ahead: 6, lift: .5, fov: 44},
  chase: {back: 7, side: 0, up: 1.8, ahead: 10, lift: 1.2, fov: 62},          // roll .04 sin(.5t) + .03 c.kick: the tunnel scene adds it
  grandHigh: {back: 22, side: -18, up: 20, ahead: 8, lift: 0, fov: 50},
  grandCauseway: {back: 26, side: -20, up: 26, ahead: 10, lift: 0, fov: 52},
};

/** A camera riding the smoothed camera frame (f.cam), raised with the causeway; the target tilts forward on the D pedal. */
export function followRig(f: WorldFrame, rig: Rig, t: number): CameraPose {
  const {p, h, r, y} = f.cam, up = rig.up + (rig === RIGS.dolly ? .15 * Math.sin(.4 * t) : 0);
  const position: Vec3 = [p[0] - h[0] * rig.back + r[0] * rig.side, up + y, p[2] - h[2] * rig.back + r[2] * rig.side];
  const target: Vec3 = [p[0] + h[0] * rig.ahead, rig.lift + y - .5 * f.pedal, p[2] + h[2] * rig.ahead];
  return {position, target, fov: rig.fov, roll: rig.roll ?? 0};
}
const mix3 = (a: Vec3, b: Vec3, x: number): Vec3 => [lerp(a[0], b[0], x), lerp(a[1], b[1], x), lerp(a[2], b[2], x)];
/** Lerps position, target, fov and roll; x is used as given (ease it at the call site). */
export const blendPose = (a: CameraPose, b: CameraPose, x: number): CameraPose =>
  ({position: mix3(a.position, b.position, x), target: mix3(a.target, b.target, x), fov: lerp(a.fov, b.fov, x), roll: lerp(a.roll, b.roll, x)});
/** The absolute homecoming crane end: framing the whole crest, pushing in 140 → 136 over the crest fill. */
export const TOP_POSE = (t: number): CameraPose => {
  const k = smoothstep(84.9, 85.6, t);
  return {position: [0, lerp(140, 136, k), lerp(14, 13.6, k)], target: [0, 0, -2], fov: 52, roll: 0};
};
/** Eased blend weight of a camera move over [a, b] (eioc, the §4 convention). */
export const move = (a: number, b: number, t: number) => easeInOutCubic((t - a) / (b - a));
