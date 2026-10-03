// Persist video sections so an interrupted production job can resume safely.
import {bundle} from '@remotion/bundler';
import {ensureBrowser, openBrowser, renderMedia, selectComposition} from '@remotion/renderer';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, readdir, writeFile, rename} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {FPS, FRAMES, SIZE, compositionId} from '../src/versions';
import type {Version} from '../src/versions';
import {pathsFor, versionFromEnv} from './version';

const CHUNK = 600;
const version = versionFromEnv(), paths = pathsFor(version);
// WebGL versions need ANGLE for a GPU-backed headless context; the setting is part of the signature.
const chromiumOptions = {gl: 'angle'} as const;
const encoding = {codec: 'h264', pixelFormat: 'yuv420p', colorSpace: 'bt709', crf: 18, x264Preset: 'fast'} as const;
const settings = {version, gl: chromiumOptions.gl, ...encoding, fps: FPS, width: SIZE, height: SIZE} as const;
const mode = process.argv[2] ?? 'all';
if (!['all', 'prepare', 'chunk', 'assemble'].includes(mode)) throw new Error('Use all, prepare, chunk <index>, or assemble');
// Only shared code and this version's sources count, so editing one version keeps the others' finished sections.
async function sourceFiles(v: Version) {
  const files = ['src/index.ts', 'src/Root.tsx', 'src/versions.ts'];
  for (const root of ['src/shared', `src/${v}`])
    for (const e of await readdir(root, {recursive: true, withFileTypes: true}))
      if (e.isFile() && /\.(tsx?|json|glsl)$/.test(e.name)) files.push(join(e.parentPath, e.name));
  return files.sort();
}
const signature = async () => {
  const hash = createHash('sha256'); hash.update(JSON.stringify(settings));
  for (const file of await sourceFiles(version)) {hash.update(file + '\0'); hash.update(await readFile(file));}
  hash.update(await readFile('public/analysis/controls.json'));
  hash.update(await readFile('public/audio/PixelParade.wav'));
  hash.update(await readFile('scripts/render-master.ts'));
  hash.update(await readFile('scripts/version.ts'));
  hash.update(await readFile('bun.lock'));
  return hash.digest('hex');
};
const current = await signature();
const dir = `${paths.segments}/${current.slice(0, 12)}`;
const fileFor = (i: number) => `${dir}/${String(i).padStart(2, '0')}.mp4`;
const ranges = Array.from({length: Math.ceil(FRAMES / CHUNK)}, (_, i) => [i * CHUNK, Math.min(FRAMES - 1, (i + 1) * CHUNK - 1)] as [number, number]);
await mkdir(dir, {recursive: true});
const manifestPath = paths.manifest;
if (mode === 'prepare' || mode === 'all') {
  console.log(`Preparing resumable ${version} master bundle (${current.slice(0, 12)})`);
  await bundle({entryPoint: 'src/index.ts', outDir: resolve(paths.masterBundle)});
  await writeFile(manifestPath, JSON.stringify({signature: current, settings, ranges, directory: dir}, null, 2));
} else {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.signature !== current) throw new Error('Source or settings changed; prepare a fresh master bundle');
}
async function validSegment(i: number) {
  try {
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', fileFor(i)], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}));
    const v = probe.streams[0];
    return probe.streams.length === 1 && v.codec_name === 'h264' && v.pix_fmt === 'yuv420p' && v.color_space === 'bt709' && v.color_range === 'tv' && v.width === SIZE && v.height === SIZE && v.r_frame_rate === '60/1' && Number(v.nb_frames) === ranges[i][1] - ranges[i][0] + 1;
  } catch {return false;}
}
if (mode === 'all' || mode === 'chunk') {
  const selected = mode === 'chunk' ? [Number(process.argv[3])] : ranges.map((_, i) => i);
  if (selected.some(i => !Number.isInteger(i) || i < 0 || i >= ranges.length)) throw new Error('Invalid section index');
  await ensureBrowser();
  const browser = await openBrowser('chrome', {chromiumOptions, browserExecutable: process.env.PP_BROWSER ?? null});
  try {
    const serveUrl = resolve(paths.masterBundle);
    const composition = await selectComposition({serveUrl, id: compositionId(version), puppeteerInstance: browser, chromiumOptions});
    for (const i of selected) {
      if (await validSegment(i)) {console.log(`Section ${i + 1}/${ranges.length} already complete`); continue;}
      let last = 0;
      const temp = fileFor(i).replace('.mp4', '.partial.mp4');
      console.log(`Rendering section ${i + 1}/${ranges.length}: frames ${ranges[i].join('–')}`);
      await renderMedia({serveUrl, composition, puppeteerInstance: browser, chromiumOptions, outputLocation: temp, ...encoding,
        concurrency: 2, muted: true, frameRange: ranges[i],
        onProgress: p => {if (Date.now() - last > 10000) {console.log(`Section ${i + 1}: ${p.renderedFrames} frames, ${(p.progress * 100).toFixed(1)}%`); last = Date.now();}},
      });
      await rename(temp, fileFor(i));
      if (!await validSegment(i)) throw new Error(`Section ${i + 1} failed export checks`);
      console.log(`Section ${i + 1}/${ranges.length} saved and verified`);
    }
  } finally {await browser.close({silent: true});}
}
if (mode === 'all' || mode === 'assemble') {
  for (let i = 0; i < ranges.length; i++) if (!await validSegment(i)) throw new Error(`Missing or invalid section ${i + 1}`);
  const list = `${dir}/concat.txt`;
  // Paths are generated here from a hexadecimal signature and fixed filenames.
  await writeFile(list, ranges.map((_, i) => `file '${resolve(fileFor(i))}'`).join('\n') + '\n');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', 'public/audio/PixelParade.wav', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', paths.master]);
  await mkdir(paths.analysis, {recursive: true});
  await writeFile(`${paths.analysis}/render-production.json`, JSON.stringify({signature: current, settings, ranges, directory: dir, originalAudio: 'public/audio/PixelParade.wav', audioEncoding: 'AAC stereo 48kHz 320k; one encode from source', assembly: 'video stream copy; fast start'}, null, 2));
  console.log(`Assembled ${paths.master} with complete original soundtrack.`);
}
