import type {Analysis} from '../../shared/types';
import type {SceneId} from '../scenes/registry';
import {clamp, ease} from './easing';
import {seedOf} from './random';
import {resolveRef, songEnd, spanSeconds} from './time';
import type {Span, TimeRef} from './time';

export type TransitionKind = 'dissolve' | 'burn' | 'wash' | 'iris';
export const TRANSITION_KINDS: readonly TransitionKind[] = ['dissolve', 'burn', 'wash', 'iris'];
/** How a scene arrives. anchor 'end' (default): fully in at `from`; 'center': half in; 'start': begins at `from`. */
export type Transition = {kind: TransitionKind; length: Span; anchor?: 'end' | 'center' | 'start'};
/** One timeline boundary: `scene` takes over at `from` and lasts until the next entry takes over. */
export type Entry = {scene: SceneId; from: TimeRef; in?: Transition};
/**
 * A scene on the resolved timeline, in seconds. It is visible on [start, end): fading in over
 * [start, start + fadeIn] and out over [end - fadeOut, end]. `visit` counts earlier entries with the same id.
 */
export type ResolvedScene = {
  id: SceneId; index: number; visit: number; from: number; start: number; end: number;
  fadeIn: number; fadeOut: number; transition: TransitionKind; seed: number;
};
export type Phase = 'in' | 'hold' | 'out';
export type Active = {scene: ResolvedScene; presence: number; phase: Phase};

/** Used when an entry has no `in`: there are no hard cuts. */
export const DEFAULT_IN: Transition = {kind: 'dissolve', length: {beats: 1}};
const cache = new WeakMap<readonly Entry[], WeakMap<Analysis, ResolvedScene[]>>();

/** Transition window [start, end] in seconds for the arrival at boundary `from`. */
export function windowOf(a: Analysis, from: number, transition: Transition) {
  const length = spanSeconds(a, transition.length);
  const start = transition.anchor === 'start' ? from : transition.anchor === 'center' ? from - length / 2 : from - length;
  return {start, end: start + length, length};
}

export function resolveTimeline(a: Analysis, entries: readonly Entry[]): ResolvedScene[] {
  let byAnalysis = cache.get(entries);
  if (!byAnalysis) cache.set(entries, byAnalysis = new WeakMap());
  let resolved = byAnalysis.get(a);
  if (resolved) return resolved;
  const visits = new Map<SceneId, number>();
  resolved = entries.map((e, index) => {
    const from = resolveRef(a, e.from), w = index ? windowOf(a, from, e.in ?? DEFAULT_IN) : {start: from, length: 0};
    const visit = visits.get(e.scene) ?? 0; visits.set(e.scene, visit + 1);
    return {id: e.scene, index, visit, from, start: w.start, end: songEnd(a), fadeIn: w.length, fadeOut: 0, transition: index ? (e.in ?? DEFAULT_IN).kind : 'dissolve', seed: seedOf(e.scene)};
  });
  for (let i = 0; i + 1 < resolved.length; i++) {
    const next = resolved[i + 1];
    resolved[i].end = next.start + next.fadeIn; resolved[i].fadeOut = next.fadeIn;
  }
  byAnalysis.set(a, resolved);
  return resolved;
}

/** Visible scenes at t, outgoing first: one, or two during a transition. */
export function activeScenes(r: ResolvedScene[], t: number): Active[] {
  const last = r.length - 1;
  return r.filter(s => t >= s.start && (t < s.end || s.index === last)).map(scene => {
    const fadeIn = scene.fadeIn > 0 ? ease((t - scene.start) / scene.fadeIn) : 1;
    const fadeOut = scene.fadeOut > 0 ? 1 - ease((t - (scene.end - scene.fadeOut)) / scene.fadeOut) : 1;
    const phase: Phase = t < scene.start + scene.fadeIn ? 'in' : scene.fadeOut > 0 && t >= scene.end - scene.fadeOut ? 'out' : 'hold';
    return {scene, presence: clamp(fadeIn * fadeOut), phase};
  });
}
