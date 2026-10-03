import {getAudioControls} from '../../shared/controls';
import type {Analysis, AudioControls} from '../../shared/types';
import type {SceneId} from '../scenes/registry';
import {occurrenceProgress, recentOccurrences, storyAt} from '../story';
import type {Story, StoryAt} from '../story';
import {FLASHES, LEGATO, LIGHT, TIMELINE} from '../timeline';
import {buildWorld, worldAt} from '../world';
import type {WorldFrame} from '../world';
import {clamp, ease, lerp, smoothstep} from './easing';
import {resolveRef, songEnd} from './time';
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
 * single-pixel freeze dot; offset = crest height above Wick's head in crest units (1, → 0 at the landing).
 */
export type MotifState = {
  center: Vec2; scale: number; glow: number; morph: number; heat: number; pulse: number; growth: number; rings: number[];
  columns: number[]; legato: number; width: number; dot: number; offset: number;
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

function motifState(a: Analysis, story: Story, at: StoryAt, c: AudioControls, t: number, light: number, world: WorldFrame): MotifState {
  const {seen, total} = occurrenceProgress(story, t);
  // Without leitmotifs the glyph follows the melody's freshest note instead.
  const flare = Object.values(at.motifs).reduce((m, x) => Math.max(m, x.pulse), 0);
  const note = c.notes.reduce((m, n) => Math.max(m, n.strength * Math.exp(-n.startAge / .25)), 0);
  const p = total ? flare : .35 * note;
  const growth = total ? seen / total : clamp(t / 86.12);
  const rings = recentOccurrences(story, t, RINGS, 2.5).flatMap(o => [o.age, clamp(o.similarity) / Math.max(1, o.rank)]);
  while (rings.length < RINGS * 2) rings.push(-1, 0);
  return {
    center: [.16 * Math.sin(.13 * t + .7), -.06 + .1 * Math.sin(.083 * t)],
    scale: .045 + .02 * p + .02 * light, glow: (.35 + 1.4 * light) * (.6 + .4 * growth) + 2.5 * p,
    morph: clamp(.1 + .9 * growth), heat: clamp(.15 + .35 * growth + .35 * light + .25 * p), pulse: p, growth, rings,
    // STUB (Phase 0) crest fields, WP5 replaces: columns are all 0, dot follows freezes 1 and 3 outright.
    ...crestStub(a, t, world),
  };
}

function crestStub(a: Analysis, t: number, world: WorldFrame) {
  const legato = keyedAt(a, LEGATO, t);
  return {columns: Array<number>(12).fill(0), legato, width: lerp(.5, .9, legato), dot: world.frozen && (t < 9.1685 || t >= 63.615) ? 1 : 0, offset: 1 - smoothstep(84.615, 84.9, t)};
}

/** One frame of v3 as a pure function of time: called outside the canvas and by validation. */
export function v3Frame(a: Analysis, story: Story, t: number, frame: number, scenes: SceneCameras, entries: readonly Entry[] = TIMELINE): FrameState {
  const c = getAudioControls(a, t), at = storyAt(story, t), light = lightAt(a, t), world = worldAt(buildWorld(a, story), a, t);
  const layers = activeScenes(resolveTimeline(a, entries), t).map(({scene, presence, phase}): Layer => {
    const props: SceneProps = {t, local: t - scene.start, duration: scene.end - scene.start, presence, phase, controls: c, story: at, seed: scene.seed, visit: scene.visit, light, world};
    return {scene, props, camera: scenes[scene.id].camera(props)};
  });
  const motifs = motifState(a, story, at, c, t, light, world);
  const incoming = layers[1]?.scene;
  const kind = incoming?.transition ?? 'dissolve';
  const transition: TransitionState = {
    count: layers.length, kind, kindIndex: TRANSITION_KINDS.indexOf(kind),
    progress: incoming ? clamp((t - incoming.start) / incoming.fadeIn) : 0, seed: (incoming?.seed ?? 0) % 1000 / 1000,
    center: [(motifs.center[0] + 1) / 2, (motifs.center[1] + 1) / 2], wash: .15 + .45 * light,
  };
  const end = songEnd(a);
  return {
    t, frame, controls: c, story: at, world, layers, transition, motifs,
    post: {
      light, exposure: (.1 + .9 * ease(t / 1.2)) * (1 - ease((t - (end - 1.5)) / 1.5)),
      bloom: .7 + .5 * light + .25 * c.kick, saturation: 1.05, grain: .035 + .03 * c.hat, aberration: .15 + .3 * c.kick, vignette: .55, frame,
      ...flashAt(t),
    },
  };
}
