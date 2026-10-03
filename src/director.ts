import {clamp, ease, lerp} from './controls';
import type {Analysis, AudioControls} from './types';

/**
 * A shot is everything the renderer needs besides raw audio: world mix, camera
 * and grading. Values come from per-cue presets, crossfaded at cue changes and
 * modulated by the music. Every value is a pure function of time.
 */
export type Shot = {
  void: number; tunnel: number; kaleido: number; aurora: number; fragments: number;
  zoom: number; roll: number; travel: number; folds: number; foldSpin: number; diamond: number;
  bloom: number; grain: number; aberration: number; saturation: number; brightness: number;
  accent: number; collapse: number; ribbon: number; ribbonFold: number;
};
type Preset = Omit<Shot, 'travel' | 'foldSpin'> & {speed: number; punch: number; snareRoll: number};

const base: Preset = {
  void: 0, tunnel: 0, kaleido: 0, aurora: 0, fragments: 0,
  zoom: 1, roll: 0, folds: 6, diamond: 0, bloom: 1, grain: .05, aberration: .3, saturation: 1, brightness: 1,
  accent: 0, collapse: 0, ribbon: 1, ribbonFold: 0, speed: 1, punch: .06, snareRoll: 0,
};
const Q = Math.PI / 4;
// One preset per measured cue, in cue order (see PLAN.md storyboard).
const presets: Preset[] = [
  {...base, void: 1, tunnel: .3, speed: .25, bloom: .7, saturation: .85, brightness: .9, punch: .02, aberration: .15},
  {...base, void: 1, tunnel: .3, speed: .02, bloom: .6, brightness: .7, collapse: 1, ribbon: .4, punch: 0},
  {...base, void: .2, tunnel: 1, diamond: 1, speed: 1, bloom: 1.1, aberration: .6, accent: .3, snareRoll: Math.PI / 16},
  {...base, void: .6, tunnel: .4, diamond: 1, roll: Q, speed: .02, bloom: .6, collapse: 1, ribbon: .4, punch: 0},
  {...base, void: .1, tunnel: .45, kaleido: 1, diamond: 1, roll: Q, speed: 1, bloom: 1.15, aberration: .7, accent: .4, ribbonFold: 1, snareRoll: Math.PI / 12},
  {...base, void: .5, tunnel: .1, aurora: 1, roll: Q, speed: .2, bloom: .95, aberration: .1, saturation: .75, ribbon: 1.25, punch: 0},
  {...base, void: .1, tunnel: 1, speed: 1.5, bloom: 1.15, aberration: .8, accent: .5, punch: .07, snareRoll: Math.PI / 16},
  {...base, void: .4, aurora: .3, fragments: 1, speed: .15, bloom: 1, aberration: .2, saturation: .9, ribbon: 1.15, punch: .02},
  {...base, tunnel: .8, kaleido: .8, fragments: .6, diamond: 1, roll: Q, folds: 8, speed: 2, bloom: 1.35, aberration: 1, accent: 1, punch: .08, ribbonFold: .5, snareRoll: Math.PI / 12},
  {...base, void: 1, tunnel: .2, speed: .3, bloom: .55, saturation: .45, aberration: .05, punch: 0},
];
const keys = Object.keys(base) as (keyof Preset)[];

/** Cue crossfade progress: measured pauses use their own length, 64 s a fast release, others one beat. */
export function transition(a: Analysis, c: AudioControls, t: number) {
  if (c.cueIndex === 0) return 1;
  const duration = c.paused ? c.cue.endSeconds - c.cue.startSeconds : c.cueIndex === 8 ? 1 / 7 : 60 / a.rhythm.bpm;
  return ease((t - c.cue.startSeconds) / duration);
}

// Cumulative tunnel travel at each cue start, so travel is continuous and seek-independent.
const travelTables = new WeakMap<Analysis, number[]>();
function travelAt(a: Analysis, c: AudioControls, t: number) {
  const beatAt = (time: number) => (time - a.rhythm.beatOriginSeconds) * a.rhythm.bpm / 60;
  let table = travelTables.get(a);
  if (!table) {
    table = [0];
    for (const [i, cue] of a.cues.entries()) table.push(table[i] + presets[i].speed * (beatAt(cue.endSeconds) - beatAt(cue.startSeconds)));
    travelTables.set(a, table);
  }
  return table[c.cueIndex] + presets[c.cueIndex].speed * (beatAt(t) - beatAt(c.cue.startSeconds));
}

export function shotAt(a: Analysis, c: AudioControls, t: number): Shot {
  const beat = 60 / a.rhythm.bpm;
  const p = transition(a, c, t);
  const previous = presets[Math.max(0, c.cueIndex - 1)], current = presets[c.cueIndex];
  const s = Object.fromEntries(keys.map(k => [k, lerp(previous[k], current[k], p)])) as Preset;
  switch (c.cue.name) {
    case 'assembly': // The grid fades in, then the camera leans in toward the first pause.
      s.tunnel *= ease(t / 8);
      s.zoom *= 1 + .35 * ease((t - 6.8) / 1.9);
      break;
    case 'interlocking-parade':
      s.folds = lerp(6, 8, ease((t - 27.43) / beat));
      break;
    case 'tunnel-return': // Formation lock: round tunnel snaps into the diamond.
      s.diamond = ease((t - 45.7) / beat);
      break;
    case 'suspended-breakdown': // Pre-drop contraction into the 64 s release.
      s.zoom *= 1 + .7 * ease((t - 62.3) / 1.7);
      s.collapse = .3 * ease((t - 62.3) / 1.7);
      break;
    case 'finale':
      s.folds = lerp(8, 12, ease((t - 73.14) / beat));
      break;
    case 'settle':
      s.collapse = .85 * ease((t - c.cue.startSeconds) / 3.8);
      break;
  }
  const fadeIn = .15 + .85 * ease(t / .75), fadeOut = 1 - ease((t - (86.12 - 1.2)) / 1.2);
  return {
    void: s.void, tunnel: s.tunnel, kaleido: s.kaleido, aurora: s.aurora, fragments: s.fragments,
    zoom: s.zoom * (1 + s.punch * c.kick),
    roll: s.roll + s.snareRoll * c.snareSteps + .04 * Math.sin(c.bar * Math.PI / 4),
    travel: travelAt(a, c, t), folds: s.folds,
    foldSpin: c.snareSteps * Math.PI / Math.max(1, s.folds) + c.beat * .02,
    diamond: s.diamond, bloom: s.bloom * (1 + .25 * c.kick), grain: s.grain + .06 * c.hat,
    aberration: s.aberration * (.25 + c.kick), saturation: s.saturation, brightness: s.brightness * fadeIn * fadeOut,
    accent: s.accent, collapse: clamp(s.collapse), ribbon: s.ribbon, ribbonFold: s.ribbonFold,
  };
}
