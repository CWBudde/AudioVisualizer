import {bundle} from '@remotion/bundler';
import {openBrowser, renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const mode = process.argv[2] ?? 'master';
if (!['master', 'preview', 'stills'].includes(mode)) throw new Error('Use master, preview or stills');
await mkdir('out/previews', {recursive: true});
await mkdir('out/stills', {recursive: true});
let progress = -1;
console.log('Bundling PixelParade…');
const serveUrl = await bundle({entryPoint: 'src/index.ts', outDir: resolve('.cache/remotion-bundle'), onProgress: p => {const bucket = Math.floor(p / 25); if (bucket > progress) {console.log(`Bundle ${p}%`); progress = bucket;}}});
const browser = await openBrowser('chrome', {browserExecutable: resolve('.cache/browser/chrome-headless-shell-linux64/chrome-headless-shell'), logLevel: 'info'});
try {
  const composition = await selectComposition({serveUrl, id: 'PixelParadeSquare', puppeteerInstance: browser});
  const common = {serveUrl, composition, puppeteerInstance: browser};
  if (mode === 'stills') {
    const frames = [0, 180, 525, 550, 1083, 1099, 1646, 2196, 2400, 2664, 2850, 3294, 3720, 3840, 3900, 4388, 4620, 4938, 5100, 5167];
    for (const frame of frames) {console.log(`Still ${frame} (${(frame / 60).toFixed(2)}s)`); await renderStill({...common, frame, output: `out/stills/${String(frame).padStart(4, '0')}.png`});}
    const hashes: Record<string, string> = {};
    // Render in a different order, compare actual captured pixels, not just poses.
    for (const frame of [3900, 180, 2400]) {
      const output = `out/stills/repeat-${frame}.png`;
      await renderStill({...common, frame, output});
      const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
      const original = hash(await readFile(`out/stills/${String(frame).padStart(4, '0')}.png`));
      if (hash(await readFile(output)) !== original) throw new Error(`Nondeterministic captured frame ${frame}`);
      hashes[frame] = original;
    }
    await writeFile('analysis/frame-determinism.json', JSON.stringify(hashes, null, 2));
  } else {
    const clips = mode === 'preview' ? [
      {name: '01-opening', range: [0, 719]}, {name: '02-breakdown-return', range: [2040, 2819]},
      {name: '03-finale-entrance', range: [3600, 4079]}, {name: '04-ending', range: [4800, 5167]},
    ] : [{name: 'PixelParade', range: [0, 5167]}];
    for (const clip of clips.slice(mode === 'preview' ? Number(process.argv[3] ?? 0) : 0)) {
      const output = mode === 'master' ? 'out/PixelParade.mp4' : `out/previews/${clip.name}.mp4`;
      let lastLog = 0;
      console.log(`Rendering ${output} (${clip.range[1] - clip.range[0] + 1} frames)`);
      const start = Date.now();
      await renderMedia({...common, outputLocation: output, codec: 'h264', pixelFormat: 'yuv420p', crf: 18,
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
