import {getAudioControls} from '../../shared/controls';
import type {Analysis, AudioControls} from '../../shared/types';
import type {SceneId} from '../scenes/registry';
import {occurrenceProgress, recentOccurrences, storyAt} from '../story';
import type {Story, StoryAt} from '../story';
import {FLASHES, LEGATO, LIGHT, TIMELINE} from '../timeline';
import {ANCHOR, CREST_HALF} from '../render/shaders/crest.glsl';
import {buildWorld, WICK_H, worldAt} from '../world';
import type {World, WorldFrame} from '../world';
import {clamp, ease, lerp, smoothstep} from './easing';
import {resolveRef} from './time';
import {activeScenes, resolveTimeline, TRANSITION_KINDS} from './timeline';
import type {Entry, Phase, ResolvedScene, TransitionKind} from './timeline';
import type {TimeRef} from './time';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
/** Camera for one scene layer; roll in radians around the view axis. */
export type CameraPose = {position: Vec3; target: Vec3; fov: number; roll: number};
/**
 * Everything a scene may animate from. t is song time; local = t - start (seconds since it began fading in),
 * duration = end - start. presence (0–1) is its eased share of the frame; phase says which edge it is on.
 * seed is stable per scene id; visit counts earlier appearances of the same id; light is the global arc.
 * world is the shared per-frame world state (the same object for every layer); the static World comes from useWorld().
 */
export type SceneProps = {
  t: number; local: number; duration: number; presence: number; phase: Phase;
  controls: AudioControls; story: StoryAt; seed: number; visit: number; light: number; world: WorldFrame;
};
export type SceneCameras = Record<SceneId, {camera: (p: SceneProps) => CameraPose}>;
export type Layer = {scene: ResolvedScene; props: SceneProps; camera: CameraPose};
/** Blend of layers[0] (outgoing) into layers[1] (incoming); count 1 shows layers[0] alone. */
export type TransitionState = {count: number; kind: TransitionKind; kindIndex: number; progress: number; seed: number; center: Vec2; wash: number};
/**
 * The persistent motif glyph, in NDC (y up). rings: up to 4 recent flares as [age s, strength], age -1 when unused.
 * Crest (§2.3): columns = 12 per-column flares; legato λ 0–1; width = column width share of its cell; dot 1 draws the
 * single-pixel freeze dot (0–1, blends crest → dot); offset 1 = crest above Wick's head, → 0 as it drops onto Wick at the landing.
 * center is the crest ANCHOR point in NDC; a screen point maps to crest coordinates as (ndc − center) / scale + ANCHOR.
 */
export type MotifState = {
  center: Vec2; scale: number; glow: number; morph: number; heat: number; pulse: number; growth: number; rings: number[];
  columns: number[]; legato: number; width: number; dot: number; offset: number;
  /** Crest ember sparkle 0–1 (only while λ > .5; off from 82.35). */
  embers: number;
};
/** flash: global warm flash strength (FLASHES); flashTone: its light-ramp position. */
export type PostState = {light: number; exposure: number; bloom: number; saturation: number; grain: number; aberration: number; vignette: number; frame: number; flash: number; flashTone: number};
export type FrameState = {
  t: number; frame: number; controls: AudioControls; story: StoryAt; world: WorldFrame;
  layers: Layer[]; transition: TransitionState; motifs: MotifState; post: PostState;
};

export const RINGS = 4;

/** Value of sorted [TimeRef, value] keys at t, eased between keys (LIGHT, LEGATO). */
export function keyedAt(a: Analysis, keyed: [TimeRef, number][], t: number) {
  const keys = keyed.map(([r, v]) => [resolveRef(a, r), v] as const);
  const i = keys.findIndex(([time]) => time > t);
  if (i < 0) return keys[keys.length - 1][1];
  if (i === 0) return keys[0][1];
  const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
  return lerp(v0, v1, ease((t - t0) / (t1 - t0)));
}
export const lightAt = (a: Analysis, t: number) => keyedAt(a, LIGHT, t);
/** FLASHES summed: linear attack, exponential decay; tone of the strongest. */
export function flashAt(t: number) {
  let flash = 0, flashTone = .714, best = 0;
  for (const [at, attack, decay, strength, x] of FLASHES) {
    const age = t - at, v = age < 0 ? 0 : strength * (age < attack ? age / attack : Math.exp(-(age - attack) / decay));
    flash += v;
    if (v > best) {best = v; flashTone = x;}
  }
  return {flash, flashTone};
}

/** NDC (square aspect) of world point x through pose, as the compositor applies it: lookAt with up +Y, then roll about the view axis. */
export function projectNdc(pose: CameraPose, x: Vec3): Vec2 {
  const [px, py, pz] = pose.position, [tx, ty, tz] = pose.target;
  let fx = tx - px, fy = ty - py, fz = tz - pz;
  const fn = Math.hypot(fx, fy, fz) || 1; fx /= fn; fy /= fn; fz /= fn;
  // right = f × Y, up = right × f.
  let rx = -fz, rz = fx;
  const rn = Math.hypot(rx, rz) || 1; rx /= rn; rz /= rn;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const dx = x[0] - px, dy = x[1] - py, dz = x[2] - pz;
  const cx = dx * rx + dz * rz, cy = dx * ux + dy * uy + dz * uz, cz = Math.max(dx * fx + dy * fy + dz * fz, .05);
  const c = Math.cos(pose.roll), s = Math.sin(pose.roll), k = 1 / (cz * Math.tan(pose.fov / 2 * Math.PI / 180));
  return [clamp((cx * c + cy * s) * k, -1.5, 1.5), clamp((-cx * s + cy * c) * k, -1.5, 1.5)];
}

/** Index of the first sorted time > t. */
const upperBound = (times: ArrayLike<number>, t: number) => {
  let lo = 0, hi = times.length;
  while (lo < hi) {const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid + 1; else hi = mid;}
  return lo;
};
/** Per-column crest flares (§2.3): the strongest recent lead note under each column, staccato → legato by λ. Motion: evaluated at held τ. */
function crestColumns(w: World, tau: number, legato: number) {
  const columns = Array<number>(12).fill(0);
  for (let i = upperBound(w.noteStart, tau) - 1; i >= 0 && w.noteStart[i] >= tau - 1.5; i--) {
    const age = tau - w.noteStart[i], dur = w.noteEnd[i] - w.noteStart[i];
    const stacc = Math.exp(-age / .09), leg = age < dur ? 1 : Math.exp(-(age - dur) / .25);
    const v = (w.noteVel[i] / 127) ** .7 * lerp(stacc, leg, legato) * (w.noteMotif[i] === 1 ? 1 : .7), k = w.noteCol[i];
    if (v > columns[k]) columns[k] = v;
  }
  return columns;
}
/** The 1-px freeze shrink of freezes 1 and 3 (4 frames in, restored over the iris that follows). */
export const crestShrink = (t: number) =>
  smoothstep(8.746, 8.813, t) * (1 - smoothstep(9.1685, 9.6185, t)) + smoothstep(63.615, 63.682, t) * (1 - smoothstep(64.038, 64.388, t));

/**
 * Wick's crest on the motif layer (§2.3). center is the crest ANCHOR in NDC: the crest base sits .012 above Wick's head as
 * projected through the layer camera(s) (mixed by the eased transition progress); at the landing (offset → 0) the crest
 * drops so its lower-right end — where the route ends on the giant crest — sits on Wick.
 */
function motifState(a: Analysis, w: World, story: Story, t: number, light: number, world: WorldFrame, layers: Layer[], mix: number): MotifState {
  const tau = world.held, legato = keyedAt(a, LEGATO, t), columns = crestColumns(w, tau, legato);
  const shrink = crestShrink(t), offset = 1 - smoothstep(84.615, 84.9, t);
  const scale = lerp(lerp(.05, .08, smoothstep(64.038, 66.324, t)), .004, shrink);
  const {p, y, scale: ws} = world.wick, head: Vec3 = [p[0], y + lerp(WICK_H / 2, WICK_H + .15, offset) * ws, p[2]];
  const h0 = projectNdc(layers[0].camera, head), h1 = layers[1] ? projectNdc(layers[1].camera, head) : h0;
  const base: Vec2 = [lerp(h0[0], h1[0], mix), lerp(h0[1], h1[1], mix) + .012 * offset];
  const q0: Vec2 = [(1 - offset) * CREST_HALF, (1 - offset) * 3 / 84];
  const center: Vec2 = [base[0] + (ANCHOR[0] - q0[0]) * scale, base[1] + (ANCHOR[1] - q0[1]) * scale];
  const {seen, total} = occurrenceProgress(story, tau), growth = total ? seen / total : clamp(t / 86.12);
  // Rings only from M4 and M5 (loop ring and herald), crest-shaped, at ×.6; gone after the collapse so only the giant crest
  // and the small one on Wick share the reveal.
  const ringGain = .6 * (1 - smoothstep(82.35, 82.9, t));
  const rings = recentOccurrences(story, tau, 16, 2.5).filter(o => o.id === 'M4' || o.id === 'M5').slice(0, RINGS).flatMap(o => [o.age, ringGain * clamp(o.similarity || 1)]);
  while (rings.length < RINGS * 2) rings.push(-1, 0);
  const pulse = Math.max(...columns);
  return {
    // Through the release the crest sinks into Wick's ember, so one ember survives the fade to ink.
    center, scale, glow: (.6 + 1.2 * light) * world.wick.glow * (1 - .85 * smoothstep(85.73, 86.05, t)), morph: clamp(.1 + .9 * growth), heat: clamp(.15 + .35 * growth + .35 * light + .25 * pulse), pulse, growth, rings,
    columns, legato, width: lerp(.5, .9, legato), dot: shrink, offset, embers: smoothstep(.5, .65, legato) * world.sparkle,
  };
}

/** One frame of v3 as a pure function of time: called outside the canvas and by validation. */
export function v3Frame(a: Analysis, story: Story, t: number, frame: number, scenes: SceneCameras, entries: readonly Entry[] = TIMELINE): FrameState {
  const c = getAudioControls(a, t), at = storyAt(story, t), light = lightAt(a, t), w = buildWorld(a, story), world = worldAt(w, a, t);
  const layers = activeScenes(resolveTimeline(a, entries), t).map(({scene, presence, phase}): Layer => {
    const props: SceneProps = {t, local: t - scene.start, duration: scene.end - scene.start, presence, phase, controls: c, story: at, seed: scene.seed, visit: scene.visit, light, world};
    return {scene, props, camera: scenes[scene.id].camera(props)};
  });
  const incoming = layers[1]?.scene;
  const kind = incoming?.transition ?? 'dissolve', progress = incoming ? clamp((t - incoming.start) / incoming.fadeIn) : 0;
  const motifs = motifState(a, w, story, t, light, world, layers, ease(progress));
  const transition: TransitionState = {
    count: layers.length, kind, kindIndex: TRANSITION_KINDS.indexOf(kind), progress, seed: (incoming?.seed ?? 0) % 1000 / 1000,
    center: [(motifs.center[0] + 1) / 2, (motifs.center[1] + 1) / 2], wash: .15 + .45 * light,
  };
  return {
    t, frame, controls: c, story: at, world, layers, transition, motifs,
    post: {
      // Ends on an ink glow at 18 % (Wick's ember stays readable), not black.
      light, exposure: (.1 + .9 * ease(t / 1.2)) * (1 - .82 * ease((t - 85.73) / .32)),
      bloom: .7 + .5 * light + .25 * c.kick, saturation: 1.05, grain: .035 + .03 * c.hat, aberration: .15 + .3 * c.kick, vignette: .55, frame,
      ...flashAt(t),
    },
  };
}
