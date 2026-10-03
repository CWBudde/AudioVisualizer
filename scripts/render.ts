import {bundle} from '@remotion/bundler';
import {ensureBrowser, openBrowser, renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import type {Analysis} from '../src/shared/types';
import {resolveTimeline} from '../src/v3/engine/timeline';
import {TIMELINE} from '../src/v3/timeline';
import {compositionId, FPS} from '../src/versions';
import {meanLuma} from './luma';
import {pathsFor, versionFromEnv} from './version';

// The production master goes through render-master.ts, which can resume interrupted jobs.
const mode = process.argv[2] ?? 'stills';
if (!['preview', 'stills'].includes(mode)) throw new Error('Use preview or stills');
const version = versionFromEnv(), paths = pathsFor(version);
// PP_WORKSPACE isolates the bundle and stills of concurrent look-dev runs.
const workspace = process.env.PP_WORKSPACE;
if (workspace && !/^[\w-]+$/.test(workspace)) throw new Error('PP_WORKSPACE must be a plain name');
if (workspace) paths.stills = `${paths.stills}/${workspace}`;
await mkdir(paths.previews, {recursive: true});
await mkdir(paths.stills, {recursive: true});
await mkdir(paths.analysis, {recursive: true});
const stillPath = (frame: number) => `${paths.stills}/${String(frame).padStart(4, '0')}.png`;
let progress = -1;
// v3: the docs/v3/script.md §7.2 stills, plus 180 and 2400 for the repeat-hash check and 2340 / 2580 where the drift climb and
// the B7 rise have actually happened (2330 and 2500 land just before them), and 2990 where chevron #5 is fully lit (its
// first arm lights at f2891, so 2890 shows only the crimson pulse); transition midpoints are added below.
const V3_STILLS = [30, 180, 300, 500, 540, 563, 700, 900, 1022, 1090, 1120, 1150, 1237, 1800, 2075, 2143, 2250, 2330, 2340, 2400, 2500, 2580, 2660,
  2734, 2790, 2890, 2990, 3050, 3180, 3240, 3366, 3450, 3620, 3780, 3830, 3853, 3900, 4000, 4314, 4350, 4420, 4800, 4900, 4930, 4960, 5040, 5080, 5120, 5160];
console.log(`Bundling PixelParade ${version}…`);
const serveUrl = await bundle({entryPoint: 'src/index.ts', outDir: resolve(workspace ? `.cache/remotion-bundle-${workspace}` : '.cache/remotion-bundle'), onProgress: p => {const bucket = Math.floor(p / 25); if (bucket > progress) {console.log(`Bundle ${p}%`); progress = bucket;}}});
await ensureBrowser();
// The scene is WebGL2; ANGLE gives headless Chrome a GPU-backed context on macOS and Linux.
const chromiumOptions = {gl: 'angle'} as const;
const browser = await openBrowser('chrome', {logLevel: 'info', chromiumOptions});
try {
  const composition = await selectComposition({serveUrl, id: compositionId(version), puppeteerInstance: browser, chromiumOptions});
  const common = {serveUrl, composition, puppeteerInstance: browser, chromiumOptions};
  // `stills 540 1200` renders just those frames for quick look-dev, without the determinism check.
  const requested = process.argv.slice(3).map(Number);
  if (mode === 'stills' && requested.length) {
    for (const frame of requested) {console.log(`Still ${frame} (${(frame / 60).toFixed(2)}s)`); await renderStill({...common, frame, output: stillPath(frame)});}
  } else if (mode === 'stills') {
    // Cue edges and in-cue changes: 0, 8.75, 9.17, 18.05, 18.31, 27.43, 36.6, 44.4, 45.7, 54.9, 62.3, 64, 73.14, 82.3, end.
    const frames = version === 'v3' ? [...V3_STILLS] : [0, 180, 525, 550, 720, 1083, 1099, 1646, 1800, 2196, 2400, 2664, 2742, 2850, 3294, 3738, 3840, 3900, 4388, 4620, 4938, 5100, 5167];
    if (version === 'v3') {
      // Transition midpoints are where hard cuts, black layers or broken blends would show.
      const a: Analysis = JSON.parse(await readFile('public/analysis/controls.json', 'utf8'));
      const midpoints = resolveTimeline(a, TIMELINE).filter(s => s.fadeIn > 0).map(s => Math.round((s.start + s.fadeIn / 2) * FPS));
      console.log(`Transition midpoints: ${midpoints.join(', ')}`);
      frames.push(...midpoints.filter(f => !frames.includes(f)));
      frames.sort((x, y) => x - y);
    }
    for (const frame of frames) {console.log(`Still ${frame} (${(frame / 60).toFixed(2)}s)`); await renderStill({...common, frame, output: stillPath(frame)});}
    if (version === 'v3') {
      // A blank WebGL capture reads as black: everything between 10 and 80 s must carry some light.
      const luma = Object.fromEntries(frames.map(f => [f, meanLuma(stillPath(f))]));
      await writeFile(`${paths.analysis}/still-luma.json`, JSON.stringify(luma, null, 2));
      const dark = frames.filter(f => f >= 10 * FPS && f <= 80 * FPS && luma[f] < 2);
      if (dark.length) throw new Error(`Blank captures (YAVG < 2) at frames ${dark.join(', ')}`);
      // The film ends on ink with one ember (§7.2 f5160); drift and freeze 3 aim for YAVG ≥ 5 (design target: warn only).
      if (luma[5160] >= 4) throw new Error(`Ending too bright: YAVG ${luma[5160].toFixed(2)} at frame 5160 (must be < 4)`);
      const dim = [2250, 2340, 2580, 2660, 3830].filter(f => luma[f] < 5);
      if (dim.length) console.warn(`Below the YAVG 5 design target: ${dim.map(f => `${f} (${luma[f].toFixed(2)})`).join(', ')}`);
    }
    const hashes: Record<string, string> = {};
    // Render in a different order, compare actual captured pixels, not just poses.
    for (const frame of [3900, 180, 2400]) {
      const output = `${paths.stills}/repeat-${frame}.png`;
      await renderStill({...common, frame, output});
      const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
      const original = hash(await readFile(stillPath(frame)));
      if (hash(await readFile(output)) !== original) throw new Error(`Nondeterministic captured frame ${frame}`);
      hashes[frame] = original;
    }
    await writeFile(`${paths.analysis}/frame-determinism.json`, JSON.stringify(hashes, null, 2));
  } else {
    const clips = [
      {name: '01-opening', range: [0, 719]}, {name: '02-breakdown-return', range: [2040, 2819]},
      {name: '03-finale-entrance', range: [3600, 4079]}, {name: '04-ending', range: [4800, 5167]},
    ];
    for (const clip of clips.slice(Number(process.argv[3] ?? 0))) {
      const output = `${paths.previews}/${clip.name}.mp4`;
      let lastLog = 0;
      console.log(`Rendering ${output} (${clip.range[1] - clip.range[0] + 1} frames)`);
      const start = Date.now();
      await renderMedia({...common, outputLocation: output, codec: 'h264', pixelFormat: 'yuv420p', colorSpace: 'bt709', crf: 18, x264Preset: 'fast',
        audioCodec: 'aac', audioBitrate: '320k', concurrency: 2,
        frameRange: [clip.range[0], clip.range[1]],
        onProgress: p => {if (Date.now() - lastLog > 10000) {console.log(`${clip.name}: ${p.renderedFrames} rendered, ${p.encodedFrames} encoded, ${(p.progress * 100).toFixed(1)}%`); lastLog = Date.now();}},
      });
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', output, '-map', '0', '-c', 'copy', '-movflags', '+faststart', `${output}.fast.mp4`]);
      await rename(`${output}.fast.mp4`, output);
      console.log(`Completed ${output} in ${((Date.now() - start) / 1000).toFixed(1)}s`);
    }
  }
} finally { await browser.close({silent: true}); }
