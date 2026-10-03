import {execFileSync} from 'node:child_process';

/** Mean full-range luma (YAVG, 0–255) of an image via ffmpeg signalstats; a blank WebGL capture reads near 0. */
export function meanLuma(file: string) {
  const out = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=out_range=full,format=yuv444p,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'], {encoding: 'utf8'});
  const match = /YAVG=([\d.]+)/.exec(out);
  if (!match) throw new Error(`No signalstats for ${file}`);
  return Number(match[1]);
}
