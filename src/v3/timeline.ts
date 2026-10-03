import type {Entry} from './engine/timeline';
import type {TimeRef} from './engine/time';

// THE story data. Each entry takes over at `from` and lasts until the next one; `in` says how it arrives.
// Retime or reorder scenes here only. Placeholder cut: proves every transition kind across all ten cues.
export const TIMELINE: Entry[] = [
  {scene: 'void', from: {s: 0}},
  // The parade burns through the darkness; the front completes on the first-parade downbeat, across the pause.
  {scene: 'ember-field', from: {cue: 'first-parade'}, in: {kind: 'burn', length: {beats: 3}}},
  // Light floods in around the second pause.
  {scene: 'tunnel', from: {cue: 'interlocking-parade'}, in: {kind: 'wash', length: {beats: 2}, anchor: 'center'}},
  {scene: 'void', from: {cue: 'open-breakdown'}, in: {kind: 'dissolve', length: {bars: 1}}},
  {scene: 'tunnel', from: {cue: 'tunnel-return'}, in: {kind: 'wash', length: {beats: 2}}},
  {scene: 'ember-field', from: {cue: 'suspended-breakdown'}, in: {kind: 'dissolve', length: {bars: 1}}},
  // The 62.3 s contraction opens through the motif glyph into the finale.
  {scene: 'bloom', from: {cue: 'finale'}, in: {kind: 'iris', length: {s: 1.7}}},
  {scene: 'void', from: {cue: 'settle'}, in: {kind: 'dissolve', length: {bars: 1}, anchor: 'start'}},
];

/** Global position on the darkness→light arc (0–1), eased between keys. */
export const LIGHT: [TimeRef, number][] = [
  [{s: 0}, .05], [{cue: 'first-pause'}, .15], [{cue: 'first-parade'}, .35], [{cue: 'second-pause'}, .3],
  [{cue: 'interlocking-parade', offsetBars: 2}, .5], [{cue: 'open-breakdown'}, .45], [{cue: 'open-breakdown', offsetBars: 2}, .3],
  [{cue: 'tunnel-return'}, .55], [{cue: 'suspended-breakdown'}, .5], [{cue: 'finale'}, .85], [{cue: 'finale', offsetBars: 6}, 1],
  [{cue: 'settle'}, .7], [{s: 86.12}, .25],
];
