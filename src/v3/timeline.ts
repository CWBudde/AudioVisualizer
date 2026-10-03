import type {Entry} from './engine/timeline';
import type {TimeRef} from './engine/time';

// THE story data (docs/v3/script.md §2.8, §3). Each entry takes over at `from` and lasts until the next one; `in` says how it arrives.
// Retime or reorder scenes here only.
export const TIMELINE: Entry[] = [
  {scene: 'sleeping-plain', from: {s: 0}},
  // Out of the first held breath, the world opens through Wick's crest on the downbeat.
  {scene: 'first-parade', from: {cue: 'first-parade'}, in: {kind: 'iris', length: {s: .45}, anchor: 'start'}},
  // One blink across the second breath: a re-angle onto two columns.
  {scene: 'interlocking', from: {cue: 'interlocking-parade'}, in: {kind: 'dissolve', length: {s: .26}}},
  // The drop-out taper: the floor burns away from the head of the line as the kick thins.
  {scene: 'drift', from: {cue: 'open-breakdown'}, in: {kind: 'burn', length: {s: 1.75}}},
  // Two-stage re-entry: embers gridded on the 44.03 snare in drift, then the bass slide brings the walls.
  {scene: 'tunnel', from: {bar: 20}, in: {kind: 'dissolve', length: {s: .35}}},
  // Crossfade while the pad bridges and the noise band falls.
  {scene: 'memory-plain', from: {cue: 'suspended-breakdown'}, in: {kind: 'dissolve', length: {s: 2.4}, anchor: 'start'}},
  // The mirror of 9.18 with a bigger release (plus the FLASHES wash at 64.038).
  {scene: 'grand-parade', from: {bar: 28}, in: {kind: 'iris', length: {s: .35}, anchor: 'start'}},
  // The early C chord floods amber; the spectral collapse lands at 82.35.
  {scene: 'homecoming', from: {s: 82.35}, in: {kind: 'wash', length: {s: .31}}},
];

/** Global position on the darkness→light arc (0–1), eased between keys. Sorted. */
export const LIGHT: [TimeRef, number][] = [
  [{s: 0}, .08], [{s: 8.03}, .08], [{s: 8.6}, .12], [{cue: 'first-pause'}, .06], [{cue: 'first-parade'}, .06], [{s: 9.7}, .35],
  [{cue: 'second-pause'}, .38], [{cue: 'interlocking-parade'}, .4], [{bar: 9}, .5], [{bar: 13}, .5], [{s: 31.2}, .4],
  [{s: 34.85}, .4], [{cue: 'open-breakdown'}, .26], [{bar: 18}, .2], [{s: 44.03}, .22], [{bar: 20}, .45], [{bar: 21}, .55],
  [{bar: 23}, .55], [{s: 54.2}, .6], [{cue: 'suspended-breakdown'}, .45], [{s: 57.3}, .3], [{s: 63.62}, .28], [{bar: 28}, .3],
  [{s: 64.6}, .75], [{bar: 32}, .85], [{bar: 35}, .95], [{s: 82.04}, .95], [{s: 82.35}, .72], [{s: 85.73}, .7], [{s: 86.12}, .35],
];
/** Crest staccato (0) → legato (1). Same interpolation as LIGHT. */
export const LEGATO: [TimeRef, number][] = [
  [{s: 0}, 0], [{cue: 'first-parade'}, 0], [{bar: 5}, .25], [{cue: 'interlocking-parade'}, .4], [{cue: 'open-breakdown'}, .4],
  [{s: 37.2}, .1], [{bar: 20}, .1], [{s: 46.3}, .45], [{cue: 'suspended-breakdown'}, .45], [{s: 57.3}, .3], [{bar: 28}, .3],
  // The crown is full by 64.6 (with the light), not only at bar 29 (§2.8): §4.7 has the crest regrow as a full crown out of
  // the 64.04 iris, and f3900 must show it amber.
  [{s: 64.6}, 1], [{s: 86.12}, 1],
];
/** Global warm flashes added in the composite (post.flash): [time, attack s, decay s, strength, ramp x]. */
// 64.038 at .4 (§2.8 says .7): with 1,848 wake tiles and 2,048 head flashes on top, .7 blew the crest iris out (YAVG ≈ 150 at f3853).
export const FLASHES: [number, number, number, number, number][] = [[9.18, .02, .3, .3, .857], [64.038, .04, .5, .4, .714]];
