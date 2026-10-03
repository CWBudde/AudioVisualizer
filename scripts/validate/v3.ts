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
import {LEGATO, LIGHT, TIMELINE} from '../../src/v3/timeline';
import {buildWorld, cellOf, heldTime, L, POSE, posesAt, routeFrame, routePoint, tileReport, VERTICES, wickArc} from '../../src/v3/world';
import type {World} from '../../src/v3/world';
import {FPS, FRAMES} from '../../src/versions';
import {checkSeeks} from './common';

// Determinism: v3 frames are pure functions of the frame number; no wall clock, no hidden state.
const FORBIDDEN: [RegExp, string][] = [
  [/Math\.random/, 'Math.random'], [/\bDate\b/, 'Date'], [/performance\.now/, 'performance.now'], [/\.clock\b/, 'R3F clock'],
  [/\bdelta\b/, 'frame delta'], [/@react-three\/drei|@react-three\/postprocessing/, 'wall-clock helper packages'],
];
const STORY = 'public/analysis/story.json';
const frameT = (f: number) => f / FPS;

// docs/v3/script.md, the numbers the checks hold the build to.
/** §2.2 route vertices [arc, X, Z]. */
const ROUTE: [number, number, number][] = [
  [0, -60, 42], [84, -60, -42], [94, -50, -42], [136, -50, 0], [146, -40, 0], [176, -40, 30], [186, -30, 30], [240, -30, -24],
  [250, -20, -24], [274, -20, 0], [284, -10, 0], [290, -10, -6], [300, 0, -6], [306, 0, -12], [316, 10, -12], [322, 10, -6],
  [332, 20, -6], [338, 20, -12], [348, 30, -12], [360, 30, 0], [370, 40, 0], [380, 50, 0], [386, 50, -6], [396, 60, -6], [441, 60, 39],
];
/** §3 scene ids in order and §2.2 arc at each scene's boundary (its `from`). */
const SCENE_IDS = ['sleeping-plain', 'first-parade', 'interlocking', 'drift', 'tunnel', 'memory-plain', 'grand-parade', 'homecoming'];
const BOUNDARY_ARC = [0, 46, 100, 202, 244, 292, 328, 430];
/** §5 transition windows [start, end] in seconds, entries 1–7. */
const WINDOWS: [number, number][] = [[9.1685, 9.6185], [18.0508, 18.3108], [34.85, 36.6], [45.402, 45.752], [54.9, 57.3], [64.038, 64.388], [82.04, 82.35]];
/** §2.1 freezes as inclusive frame ranges. */
const FREEZE_FRAMES: [number, number][] = [[525, 550], [1083, 1098], [3817, 3841]];

// Tile tables (§2.4): slot j of cell i at events[j >> 2][i * 4 + (j & 3)], packed kind · 128 + time.
function eventsOf(w: World, cell: number) {
  const out: {kind: number; time: number}[] = [];
  for (let j = 0; j < 8; j++) {
    const v = w.tiles.events[j >> 2][cell * 4 + (j & 3)];
    if (v >= 0) {const kind = Math.floor(v / 128); out.push({kind, time: v - kind * 128});}
  }
  return out;
}

function validateTimeline(a: Analysis) {
  const r = resolveTimeline(a, TIMELINE), end = songEnd(a), frame = 1 / FPS;
  const cues = new Set(a.cues.map(c => c.name));
  for (const ref of [...TIMELINE.map(e => e.from), ...LIGHT.map(([ref]) => ref), ...LEGATO.map(([ref]) => ref)]) if ('cue' in ref) assert.ok(cues.has(ref.cue), `Unknown cue ${ref.cue}`);
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
  // §7.1.6: exactly the eight WICK scenes, with the §5 windows (within one frame).
  assert.deepEqual(r.map(s => s.id), SCENE_IDS, 'Scene ids differ from §3');
  r.slice(1).forEach((s, i) => {
    const [start, stop] = WINDOWS[i];
    assert.ok(Math.abs(s.start - start) <= frame && Math.abs(s.start + s.fadeIn - stop) <= frame,
      `Window into ${s.id}: ${s.start.toFixed(4)}–${(s.start + s.fadeIn).toFixed(4)}, §5 says ${start}–${stop}`);
  });
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
/** §7.1.8: the scan covers all of src/v3, world/** included. */
async function validateTokens() {
  const files = await sourceFiles('src/v3');
  assert.ok(files.some(f => f.startsWith(join('src/v3/world'))), 'Token scan does not reach src/v3/world');
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const [pattern, what] of FORBIDDEN) assert.ok(!pattern.test(text), `${what} in ${file}`);
    if (file !== join('src/v3/render/Compositor.tsx')) assert.ok(!/useFrame/.test(text), `useFrame outside the compositor: ${file}`);
  }
  return files.length;
}

/** §7.1.1 */
function checkRoute() {
  const near = (p: number[], q: number[], what: string) => assert.ok(p.every((x, i) => Math.abs(x - q[i]) < 1e-9), `${what}: ${p} ≠ ${q}`);
  near(routePoint(0), [-60, 0, 42], 'routePoint(0)');
  near(routePoint(441), [60, 0, 39], 'routePoint(441)');
  assert.equal(L, 441);
  assert.deepEqual(VERTICES.map(v => [...v]), ROUTE, 'Route vertices differ from §2.2');
  ROUTE.forEach(([s, x, z], i) => {
    near(routePoint(s), [x, 0, z], `routePoint(${s})`);
    if (!i) return;
    const [s0, x0, z0] = ROUTE[i - 1];
    assert.ok(x === x0 || z === z0, `Segment ${s0}→${s} is not axis-aligned`);
    assert.equal(s - s0, Math.abs(x - x0) + Math.abs(z - z0), `Segment ${s0}→${s} length ≠ arc`);
  });
  let worst = 0;
  for (let s = -240; s <= 500; s += .05) {
    const {h} = routeFrame(s);
    worst = Math.max(worst, Math.abs(Math.hypot(...h) - 1), Math.abs(h[1]));
  }
  assert.ok(worst < 1e-6, `routeFrame heading off unit length by ${worst}`);
  return {vertices: ROUTE.length, headingError: worst};
}

/** §7.1.2 */
function checkWick(a: Analysis, w: World) {
  let previous = -Infinity;
  const arcs = Array.from({length: FRAMES}, (_, f) => wickArc(w, frameT(f)));
  arcs.forEach((arc, f) => {assert.ok(arc >= previous - 1e-9, `wickArc decreases at frame ${f}: ${previous} → ${arc}`); previous = arc;});
  for (const [f0, f1] of FREEZE_FRAMES) for (let f = f0; f <= f1; f++) assert.equal(arcs[f], arcs[f0], `wickArc moves inside the freeze at frame ${f}`);
  // The last step eases over .09 s from 84.615, so 84.7 is within 2e-4 of the end.
  assert.ok(Math.abs(wickArc(w, 84.7) - 441) < 1e-3, `wickArc(84.7) = ${wickArc(w, 84.7)}, not 441`);
  const boundaries = resolveTimeline(a, TIMELINE).map((s, i) => {
    const arc = wickArc(w, s.from);
    assert.ok(Math.abs(arc - BOUNDARY_ARC[i]) <= 1, `Arc at ${s.id} (${s.from.toFixed(3)} s) is ${arc.toFixed(2)}, §2.2 says ${BOUNDARY_ARC[i]}`);
    return +arc.toFixed(2);
  });
  return {boundaries};
}

/** §7.1.3 and §7.1.4: walkers over every frame. */
function checkWalkers(w: World) {
  const n = w.walkers.count, {cohort, wake, restLight} = w.walkers;
  const copy = (f: number) => posesAt(w, frameT(f)).slice();
  const pose = (p: Float32Array, k: number) => p.subarray(k * POSE, k * POSE + POSE);
  let prev: Float32Array | null = null, maxStep = 0;
  const counts: Record<number, {visible: number; lying: number; standing: number}> = {};
  for (let f = 0; f < FRAMES; f++) {
    const p = copy(f), tau = heldTime(frameT(f));
    // Every 17th walker: finite, and no teleports (except where it stands up from invisible).
    for (let k = 0; k < n; k += 17) {
      const q = pose(p, k);
      assert.ok(q.every(Number.isFinite), `Walker ${k} pose not finite at frame ${f}`);
      if (!prev) continue;
      const o = pose(prev, k);
      if (o[5] <= 0 || q[5] <= 0) continue;
      const step = Math.hypot(q[0] - o[0], q[1] - o[1], q[2] - o[2]);
      maxStep = Math.max(maxStep, step);
      assert.ok(step <= 2, `Walker ${k} (cohort ${cohort[k]}) jumps ${step.toFixed(2)} tiles at frame ${f}`);
    }
    // Visible walkers are exactly those whose wake (cohorts 0/1) or rest light (cohort 2) has passed.
    let visible = 0, lo = 0, hi = 0, lying = 0, standing = 0;
    for (let k = 0; k < n; k++) {
      const x = cohort[k] === 2 ? restLight[k] : wake[k], q = pose(p, k);
      if (x < tau) lo++;
      if (x <= tau) hi++;
      if (q[5] > 0) {visible++; if (q[4] > .9) lying++; if (q[4] < .1 && q[5] > .99) standing++;}
    }
    assert.ok(visible >= lo && visible <= hi, `${visible} visible walkers at frame ${f}, expected ${lo === hi ? lo : `${lo}–${hi}`}`);
    if ([600, 1110, 2800, 3500, 3900].includes(f)) counts[f] = {visible, lying, standing};
    prev = p;
  }
  assert.ok(counts[600].visible >= 46, `Only ${counts[600].visible} walkers visible at f600 (≥ 46)`);
  assert.equal(counts[1110].visible, 200, 'Visible walkers at f1110');
  assert.equal(counts[2800].visible, 200, 'Visible walkers at f2800');
  assert.equal(counts[3500].lying, 2048, 'Lying walkers (lie > .9) at f3500');
  assert.equal(counts[3900].standing, 2048, 'Standing walkers (lie < .1) at f3900');
  // Freezes hold every pose.
  for (const [f0, f1] of FREEZE_FRAMES) {
    const held = copy(f0);
    for (let f = f0 + 1; f <= f1; f++) assert.deepEqual(copy(f), held, `Poses move inside the freeze at frame ${f}`);
  }
  // Seeking backwards gives the same poses as playing forwards.
  const sample = Array.from({length: Math.ceil(FRAMES / 37)}, (_, i) => i * 37), forward = sample.map(copy);
  for (let i = sample.length - 1; i >= 0; i--) assert.deepEqual(copy(sample[i]), forward[i], `posesAt differs on a reverse seek to frame ${sample[i]}`);
  return {maxStep: +maxStep.toFixed(3), counts};
}

/** §7.1.5 */
function checkTiles(w: World) {
  const cells = w.tiles.size * w.tiles.size;
  const report = tileReport(w.tiles);
  assert.ok(report, 'No tile report for the built tiles');
  let answers = 0, full = 0, unsorted = 0;
  for (let c = 0; c < cells; c++) {
    const e = eventsOf(w, c);
    assert.ok(e.every(x => x.kind >= 1 && x.kind <= 8), `Unknown event kind in cell ${c}`);
    answers += e.filter(x => x.kind === 8).length;
    if (e.length === 8) full++;
    if (e.some((x, i) => i && x.time < e[i - 1].time - 1e-3)) unsorted++; // float32 packing: allow ties
  }
  assert.equal(unsorted, 0, `${unsorted} cells with events out of time order`);
  for (let i = 0; i <= Math.min(w.final, 441); i++) {
    const [x, , z] = routePoint(w.noteArc[i]), cell = cellOf(x, z);
    assert.ok(cell >= 0 && eventsOf(w, cell).some(e => (e.kind === 1 || e.kind === 2) && Math.abs(e.time - w.noteStart[i]) < 2e-3),
      `Route cell ${i} (${x}, ${z}) has no contact event at ${w.noteStart[i].toFixed(3)}`);
  }
  assert.equal(w.m2.length, 5, 'Chevrons (M2 occurrences)');
  assert.equal(w.m4.length, 3, 'Loop rings (M4 occurrences)');
  assert.equal(w.m6.reduce((s, m) => s + m.hits.length, 0), 16, 'Hammer hits (M6)');
  assert.equal(answers, 1, 'Answer events (kind 8)');
  // Over the cap the packer drops events: any drop means a cell asked for more than 8.
  assert.equal(report.dropped.length, 0, `${report.dropped.length} tile events dropped by the 8-per-cell cap (first: ${JSON.stringify(report.dropped[0])})`);
  return {fullCells: full, maxPerCell: report.maxPerCell, answers};
}

/** §7.1.7: the frame state, every frame. */
function checkFrames(at: (t: number) => ReturnType<typeof v3Frame>) {
  let worstDirY = 0, closest = Infinity;
  for (let frame = 0; frame < FRAMES; frame++) {
    const s = at(frameT(frame));
    assertFinite(s, `frame ${frame}`);
    assert.ok(s.layers.length >= 1 && s.layers.length <= 2 && s.transition.count === s.layers.length);
    for (const l of s.layers) {
      assert.ok(l.props.presence >= 0 && l.props.presence <= 1, `Presence out of range at frame ${frame}`);
      assert.ok(l.camera.fov > 1 && l.camera.fov < 179, `Camera fov out of range at frame ${frame}`);
      const d = l.camera.target.map((x, i) => x - l.camera.position[i]), len = Math.hypot(...d), dirY = Math.abs(d[1]) / len;
      closest = Math.min(closest, len); worstDirY = Math.max(worstDirY, dirY);
      assert.ok(len > 1, `${l.scene.id} camera target only ${len.toFixed(3)} from its position at frame ${frame}`);
      assert.ok(dirY < .995, `${l.scene.id} camera vertical (|dir.y| ${dirY.toFixed(4)}) at frame ${frame}`);
    }
    assert.ok(s.transition.progress >= 0 && s.transition.progress <= 1);
    const m = s.motifs;
    assert.equal(m.columns.length, 12, 'Crest needs 12 columns');
    assert.ok(m.dot >= 0 && m.dot <= 1 && m.offset >= 0 && m.offset <= 1 && m.legato >= 0 && m.legato <= 1, `Crest state out of range at frame ${frame}`);
    assert.ok(s.post.flash >= 0 && s.post.exposure > 0, `Post out of range at frame ${frame}`);
  }
  return {closestCamera: +closest.toFixed(3), worstDirY: +worstDirY.toFixed(4)};
}

/** Runs every named check and reports all failures together (another package's stub can fail one without hiding the rest). */
function runChecks(checks: Record<string, () => unknown>) {
  const report: Record<string, unknown> = {}, failed: string[] = [];
  for (const [name, check] of Object.entries(checks)) {
    try {report[name] = check() ?? 'passed';} catch (e) {failed.push(`${name}: ${(e as Error).message.split('\n')[0]}`); report[name] = 'FAILED';}
  }
  if (failed.length) {console.log(JSON.stringify(report, null, 2)); throw new Error(`v3 checks failed:\n  ${failed.join('\n  ')}`);}
  return report;
}

export async function validateV3(a: Analysis) {
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
  for (const [ref] of [...LIGHT, ...LEGATO]) resolveRef(a, ref);
  const w = buildWorld(a, story), at = (t: number) => v3Frame(a, story, t, Math.round(t * FPS), SCENES);
  let sourceCount = 0;
  const report = runChecks({
    '1 route': checkRoute,
    '2 wick': () => checkWick(a, w),
    '3+4 walkers': () => checkWalkers(w),
    '5 tiles': () => checkTiles(w),
    '6 timeline': () => validateTimeline(a),
    '7 frame state': () => checkFrames(at),
    '8 determinism': () => {checkSeeks(at); return 'seeks passed; repeat-still hashes run in render:stills';},
  });
  sourceCount = await validateTokens();
  return {...storyReport, ...report, forbiddenTokens: `none in ${sourceCount} files`};
}
