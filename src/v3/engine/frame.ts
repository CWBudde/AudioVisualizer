import {getAudioControls} from '../../shared/controls';
import type {Analysis, AudioControls} from '../../shared/types';
import type {SceneId} from '../scenes/registry';
import {occurrenceProgress, recentOccurrences, storyAt} from '../story';
import type {Story, StoryAt} from '../story';
import {LIGHT, TIMELINE} from '../timeline';
import {clamp, ease, lerp} from './easing';
import {resolveRef, songEnd} from './time';
import {activeScenes, resolveTimeline, TRANSITION_KINDS} from './timeline';
import type {Entry, Phase, ResolvedScene, TransitionKind} from './timeline';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
/** Camera for one scene layer; roll in radians around the view axis. */
export type CameraPose = {position: Vec3; target: Vec3; fov: number; roll: number};
/**
 * Everything a scene may animate from. t is song time; local = t - start (seconds since it began fading in),
 * duration = end - start. presence (0–1) is its eased share of the frame; phase says which edge it is on.
 * seed is stable per scene id; visit counts earlier appearances of the same id; light is the global arc.
 */
export type SceneProps = {
  t: number; local: number; duration: number; presence: number; phase: Phase;
  controls: AudioControls; story: StoryAt; seed: number; visit: number; light: number;
};
export type SceneCameras = Record<SceneId, {camera: (p: SceneProps) => CameraPose}>;
export type Layer = {scene: ResolvedScene; props: SceneProps; camera: CameraPose};
/** Blend of layers[0] (outgoing) into layers[1] (incoming); count 1 shows layers[0] alone. */
export type TransitionState = {count: number; kind: TransitionKind; kindIndex: number; progress: number; seed: number; center: Vec2; wash: number};
/** The persistent motif glyph, in NDC (y up). rings: up to 4 recent flares as [age s, strength], age -1 when unused. */
export type MotifState = {center: Vec2; scale: number; glow: number; morph: number; heat: number; pulse: number; growth: number; rings: number[]};
export type PostState = {light: number; exposure: number; bloom: number; saturation: number; grain: number; aberration: number; vignette: number; frame: number};
export type FrameState = {
  t: number; frame: number; controls: AudioControls; story: StoryAt;
  layers: Layer[]; transition: TransitionState; motifs: MotifState; post: PostState;
};

export const RINGS = 4;

export function lightAt(a: Analysis, t: number) {
  const keys = LIGHT.map(([r, v]) => [resolveRef(a, r), v] as const);
  const i = keys.findIndex(([time]) => time > t);
  if (i < 0) return keys[keys.length - 1][1];
  if (i === 0) return keys[0][1];
  const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
  return lerp(v0, v1, ease((t - t0) / (t1 - t0)));
}

function motifState(story: Story, at: StoryAt, c: AudioControls, t: number, light: number): MotifState {
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
  };
}

/** One frame of v3 as a pure function of time: called outside the canvas and by validation. */
export function v3Frame(a: Analysis, story: Story, t: number, frame: number, scenes: SceneCameras, entries: readonly Entry[] = TIMELINE): FrameState {
  const c = getAudioControls(a, t), at = storyAt(story, t), light = lightAt(a, t);
  const layers = activeScenes(resolveTimeline(a, entries), t).map(({scene, presence, phase}): Layer => {
    const props: SceneProps = {t, local: t - scene.start, duration: scene.end - scene.start, presence, phase, controls: c, story: at, seed: scene.seed, visit: scene.visit, light};
    return {scene, props, camera: scenes[scene.id].camera(props)};
  });
  const motifs = motifState(story, at, c, t, light);
  const incoming = layers[1]?.scene;
  const kind = incoming?.transition ?? 'dissolve';
  const transition: TransitionState = {
    count: layers.length, kind, kindIndex: TRANSITION_KINDS.indexOf(kind),
    progress: incoming ? clamp((t - incoming.start) / incoming.fadeIn) : 0, seed: (incoming?.seed ?? 0) % 1000 / 1000,
    center: [(motifs.center[0] + 1) / 2, (motifs.center[1] + 1) / 2], wash: .15 + .45 * light,
  };
  const end = songEnd(a);
  return {
    t, frame, controls: c, story: at, layers, transition, motifs,
    post: {
      light, exposure: (.1 + .9 * ease(t / 1.2)) * (1 - ease((t - (end - 1.5)) / 1.5)),
      bloom: .7 + .5 * light + .25 * c.kick, saturation: 1.05, grain: .035 + .03 * c.hat, aberration: .15 + .3 * c.kick, vignette: .55, frame,
    },
  };
}
