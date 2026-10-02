import {clamp, ease, getAudioControls, lerp, sample} from './controls';
import type {Analysis, AudioControls} from './types';

export const TAU = Math.PI * 2;
export const COLORS = ['#36E5FF', '#FF3DA8', '#8658FF', '#E9FF70'];
export const seeded = (id: number) => {const x = Math.sin((id + 42) * 127.1) * 43758.5453; return x - Math.floor(x);};
export type Scene = {count: number; ceiling: number; travel: number; ribbons: number; tunnel: number; rotation: number};
export type Pose = {x: number; y: number; angle: number; size: number; opacity: number};
const scenes: Scene[] = [
  {count: 24, ceiling: .45, travel: .26, ribbons: 1, tunnel: 0, rotation: 0},
  {count: 24, ceiling: .1, travel: 0, ribbons: 0, tunnel: 0, rotation: 0},
  {count: 48, ceiling: .83, travel: 1, ribbons: 3, tunnel: 0, rotation: 0},
  {count: 48, ceiling: .1, travel: 0, ribbons: 0, tunnel: 0, rotation: Math.PI / 4},
  {count: 48, ceiling: .86, travel: .9, ribbons: 3, tunnel: .15, rotation: Math.PI / 4},
  {count: 24, ceiling: .32, travel: .15, ribbons: 2, tunnel: 0, rotation: 0},
  {count: 48, ceiling: .88, travel: 1, ribbons: 3, tunnel: 1, rotation: 0},
  {count: 24, ceiling: .27, travel: .09, ribbons: 1, tunnel: .15, rotation: 0},
  {count: 80, ceiling: 1, travel: 1.2, ribbons: 5, tunnel: .4, rotation: Math.PI / 4},
  {count: 24, ceiling: .25, travel: .07, ribbons: 0, tunnel: 0, rotation: 0},
];
export function transition(a: Analysis, c: AudioControls, t: number) {
  const index = c.cueIndex;
  const duration = c.paused ? c.cue.endSeconds - c.cue.startSeconds : index === 8 ? 1 / 7 : 60 / a.rhythm.bpm;
  return index === 0 ? 1 : ease((t - c.cue.startSeconds) / duration);
}
export function sceneAt(a: Analysis, c: AudioControls, t: number): Scene {
  const target = {...scenes[c.cueIndex]};
  if (c.cueIndex === 0) target.count = lerp(12, 24, ease(t / 6));
  const prev = scenes[Math.max(0, c.cueIndex - 1)];
  const p = transition(a, c, t);
  return Object.fromEntries(Object.keys(target).map(key => [key, lerp(prev[key as keyof Scene], target[key as keyof Scene], p)])) as Scene;
}
function rotate(x: number, y: number, angle: number) {return {x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle)};}
function rawPose(id: number, index: number, t: number, c: AudioControls): Pose {
  const phase = c.beat * TAU / 32;
  const noise = seeded(id), side = id % 2 === 0 ? 1 : -1;
  let x = 0, y = 0, angle = 0, depth = 1;
  if (index === 0) {
    angle = id / 12 * TAU + phase * side * .7;
    const radius = id < 12 ? 205 : 300;
    x = Math.cos(angle) * radius + side * 30; y = Math.sin(angle) * radius * .75;
  } else if (index === 1 || index === 3) {
    angle = id / 24 * TAU + phase * .3;
    x = Math.cos(angle) * (26 + id % 3 * 13); y = Math.sin(angle) * (26 + id % 3 * 13);
  } else if (index === 2 || index === 4) {
    const lane = id % 4, row = Math.floor(id / 4) % 12;
    const q = (row / 12 + t * .065) % 1;
    const ranks = rotate((q - .5) * 660, (lane - 1.5) * 100 + Math.sin(q * TAU + lane) * 24, Math.PI / 4);
    const theta = id / 24 * TAU + phase * side;
    const radius = 185 + (id % 3) * 66;
    const orbit = {x: Math.cos(theta) * radius, y: Math.sin(theta) * radius * .78};
    const morph = index === 4 ? ease((t - 27.43) / 1.142857) : 0;
    // Traveling ranks fade at wrap; nested orbits keep persistent identities.
    depth = lerp(Math.pow(Math.sin(q * Math.PI), .35), 1, morph);
    x = lerp(ranks.x, orbit.x, morph); y = lerp(ranks.y, orbit.y, morph);
    angle = theta + Math.PI / 4 * morph;
  } else if (index === 5 || index === 7) {
    angle = id / 24 * TAU + side * phase * .22;
    const contraction = index === 7 ? 1 - .55 * ease((t - 62.3) / 1.7) : 1;
    const radius = (205 + noise * 130) * contraction;
    x = Math.cos(angle) * radius;
    y = Math.sin(angle) * radius * .72 + Math.sin(t * .6 + id) * 26;
  } else if (index === 6) {
    const z = (id / 48 + (t - 44.4) * .08) % 1;
    const theta = id / 16 * TAU + phase * side * .8;
    const radius = 95 + z * 255;
    const ringRadius = 145 + Math.floor(id / 16) % 3 * 92;
    const lock = ease((t - 45.7) / .571429);
    x = Math.cos(theta) * lerp(radius, ringRadius, lock);
    y = Math.sin(theta) * lerp(radius, ringRadius, lock) * .83;
    depth = lerp(Math.sin(z * Math.PI), 1, lock); angle = theta + phase;
  } else if (index === 8) {
    const theta = id / 80 * TAU + phase * side;
    const radius = 190 + 140 * (.5 + .5 * Math.sin(id / 80 * TAU * 5 + phase));
    const first = {x: Math.cos(theta) * radius, y: Math.sin(theta) * radius};
    const flowerAngle = id / 80 * TAU + phase * .45;
    const petal = 270 + 64 * Math.sin(id / 80 * TAU * 6 + phase * 2);
    const morph = ease((t - 73.14) / 1.142857);
    x = lerp(first.x, Math.cos(flowerAngle) * petal, morph);
    y = lerp(first.y, Math.sin(flowerAngle) * petal, morph); angle = lerp(theta, flowerAngle, morph);
  } else {
    angle = id / 24 * TAU + phase * .2;
    const radius = lerp(180, 66, ease((t - 82.3) / 2.5));
    x = Math.cos(angle) * radius; y = Math.sin(angle) * radius;
  }
  const deformation = c.harmonic * 18 * Math.sin(angle * 3 + c.beat * TAU / 8);
  if (index !== 1 && index !== 3) {x += Math.cos(angle) * deformation; y += Math.sin(angle) * deformation;}
  return {x: x * c.spread, y, angle: angle * 180 / Math.PI + id * 17, size: (7 + noise * 10) * (.85 + .15 * depth), opacity: depth};
}
export function tokenPose(a: Analysis, id: number, t: number, c = getAudioControls(a, t), scene = sceneAt(a, c, t)): Pose {
  const p = transition(a, c, t);
  const target = rawPose(id, c.cueIndex, t, c);
  const previous = rawPose(id, Math.max(0, c.cueIndex - 1), t, c);
  const pose = Object.fromEntries(Object.keys(target).map(key => [key, lerp(previous[key as keyof Pose], target[key as keyof Pose], p)])) as Pose;
  const rotated = rotate(pose.x, pose.y, scene.rotation);
  pose.x = rotated.x; pose.y = rotated.y;
  pose.angle += scene.rotation * 180 / Math.PI;
  pose.opacity *= clamp(scene.count - id) * (.45 + scene.ceiling * .5);
  return pose;
}
export type Spark = {x: number; y: number; vx: number; vy: number; alpha: number; color: string; size: number};
export function sparksAt(a: Analysis, t: number, c: AudioControls, scene: Scene): Spark[] {
  if (c.paused || c.cueIndex === 9) return [];
  const sparks: Spark[] = [];
  a.tracks.drums.onsets.forEach((event, e) => {
    const age = t - event.timeSeconds;
    if (age < 0 || age > .45) return;
    const hi = Math.max(sample(a.tracks.drums.bandControls[3], event.timeSeconds, a.stepSeconds), sample(a.tracks.drums.bandControls[4], event.timeSeconds, a.stepSeconds));
    if (hi < .16 || event.strength < .18) return;
    const count = Math.ceil(12 * hi * scene.ceiling);
    for (let i = 0; i < count && sparks.length < 240; i++) {
      const seed = e * 31 + i, angle = seeded(seed) * TAU, speed = 170 + seeded(seed + 80) * 300;
      const radius = 108 + seeded(seed + 100) * 140;
      sparks.push({x: Math.cos(angle) * (radius + speed * age), y: Math.sin(angle) * (radius + speed * age), vx: Math.cos(angle), vy: Math.sin(angle), alpha: Math.pow(1 - age / .45, 2) * event.strength, color: COLORS[i % 4], size: 1.6 + seeded(seed + 160) * 2.4});
    }
  });
  return sparks;
}
