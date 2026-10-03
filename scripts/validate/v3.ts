import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Analysis} from '../../src/shared/types';
import {v3Frame} from '../../src/v3/engine/frame';
import {resolveRef, songEnd} from '../../src/v3/engine/time';
import {activeScenes, resolveTimeline, TRANSITION_KINDS} from '../../src/v3/engine/timeline';
import {SCENES} from '../../src/v3/scenes/registry';
import {assertStory, storyFromAnalysis} from '../../src/v3/story';
import type {Story} from '../../src/v3/story';
import {LIGHT, TIMELINE} from '../../src/v3/timeline';
import {FPS, FRAMES} from '../../src/versions';
import {checkSeeks} from './common';

// Determinism: v3 frames are pure functions of the frame number; no wall clock, no hidden state.
const FORBIDDEN: [RegExp, string][] = [
  [/Math\.random/, 'Math.random'], [/\bDate\b/, 'Date'], [/performance\.now/, 'performance.now'], [/\.clock\b/, 'R3F clock'],
  [/\bdelta\b/, 'frame delta'], [/@react-three\/drei|@react-three\/postprocessing/, 'wall-clock helper packages'],
];
const STORY = 'public/analysis/story.json';

function validateTimeline(a: Analysis) {
  const r = resolveTimeline(a, TIMELINE), end = songEnd(a), frame = 1 / FPS;
  const cues = new Set(a.cues.map(c => c.name));
  for (const ref of [...TIMELINE.map(e => e.from), ...LIGHT.map(([ref]) => ref)]) if ('cue' in ref) assert.ok(cues.has(ref.cue), `Unknown cue ${ref.cue}`);
  assert.equal(r[0].from, 0, 'Timeline must start at 0');
  assert.ok(r.length >= 1 && r[r.length - 1].end === end, 'Timeline must run to the end of the song');
  r.forEach((s, i) => {
    assert.ok(s.id in SCENES, `Unregistered scene ${s.id}`);
    assert.ok(TRANSITION_KINDS.includes(s.transition), `Unknown transition ${s.transition}`);
    if (!i) return;
    const previous = r[i - 1], next = r[i + 1];
    assert.ok(s.from > previous.from, `Timeline not sorted at entry ${i} (${s.id})`);
    assert.notEqual(s.id, previous.id, `Entry ${i} repeats ${s.id} back to back`);
    assert.ok(s.fadeIn >= 4 * frame - 1e-9, `Transition into ${s.id} (entry ${i}) is shorter than 4 frames`);
    assert.ok(s.start >= 0 && s.start + s.fadeIn <= end, `Transition into ${s.id} (entry ${i}) leaves the song`);
    // Inside both scenes: the outgoing one is fully in first, and this one is fully in before it starts leaving.
    assert.ok(s.start >= previous.start + previous.fadeIn - 1e-9, `Transition into ${s.id} (entry ${i}) overlaps the previous transition`);
    if (next) assert.ok(next.start >= s.start + s.fadeIn - 1e-9, `Transition into ${next.id} (entry ${i + 1}) starts before ${s.id} is fully in`);
  });
  for (let f = 0; f < FRAMES; f++) {
    const n = activeScenes(r, f / FPS).length;
    assert.ok(n >= 1 && n <= 2, `${n} active scenes at frame ${f}`);
  }
  return {entries: r.length, kinds: [...new Set(r.slice(1).map(s => s.transition))], transitions: r.slice(1).map(s => ({into: s.id, kind: s.transition, start: +s.start.toFixed(3), seconds: +s.fadeIn.toFixed(3)}))};
}

/** Every number reachable in the frame state must be finite. */
function assertFinite(value: unknown, path: string): void {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${path} is ${value}`);
  else if (Array.isArray(value)) value.forEach((x, i) => assertFinite(x, `${path}[${i}]`));
  else if (value && typeof value === 'object') for (const [k, x] of Object.entries(value)) assertFinite(x, `${path}.${k}`);
}

async function sourceFiles(dir: string): Promise<string[]> {
  return (await readdir(dir, {recursive: true, withFileTypes: true})).filter(e => e.isFile() && /\.tsx?$/.test(e.name)).map(e => join(e.parentPath, e.name));
}
async function validateTokens() {
  for (const file of await sourceFiles('src/v3')) {
    const text = await readFile(file, 'utf8');
    for (const [pattern, what] of FORBIDDEN) assert.ok(!pattern.test(text), `${what} in ${file}`);
    if (file !== join('src/v3/render/Compositor.tsx')) assert.ok(!/useFrame/.test(text), `useFrame outside the compositor: ${file}`);
  }
}

export async function validateV3(a: Analysis) {
  const timeline = validateTimeline(a);
  let story: Story, storyReport: Record<string, unknown>;
  if (existsSync(STORY)) {
    const data: unknown = JSON.parse(await readFile(STORY, 'utf8'));
    assertStory(data);
    const end = songEnd(a);
    for (const m of data.leitmotifs) for (const o of m.occurrences) assert.ok(o.startSeconds >= 0 && o.endSeconds <= end, `Motif ${m.id} occurrence outside the song`);
    story = data;
    storyReport = {story: STORY, bars: data.bars.length, leitmotifs: data.leitmotifs.map(m => ({id: m.id, role: m.role, occurrences: m.occurrences.length}))};
  } else {
    story = storyFromAnalysis(a);
    storyReport = {story: 'missing: beat-grid fallback', bars: story.bars.length};
  }
  const at = (t: number) => v3Frame(a, story, t, Math.round(t * FPS), SCENES);
  checkSeeks(at);
  for (let frame = 0; frame < FRAMES; frame += 3) {
    const s = at(frame / FPS);
    assertFinite(s, `frame ${frame}`);
    assert.ok(s.layers.length >= 1 && s.layers.length <= 2 && s.transition.count === s.layers.length);
    for (const l of s.layers) {
      assert.ok(l.props.presence >= 0 && l.props.presence <= 1, `Presence out of range at frame ${frame}`);
      assert.ok(l.camera.fov > 1 && l.camera.fov < 179, `Camera fov out of range at frame ${frame}`);
    }
    assert.ok(s.transition.progress >= 0 && s.transition.progress <= 1);
  }
  await validateTokens();
  for (const [ref] of LIGHT) resolveRef(a, ref);
  return {timeline, ...storyReport, deterministicSeeks: 'passed', finiteFrameState: 'passed', forbiddenTokens: 'none'};
}
