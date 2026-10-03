import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const clips = [['01-opening', 720], ['02-breakdown-return', 780], ['03-finale-entrance', 480], ['04-ending', 368]] as const;
const reports = clips.map(([name, frames]) => {
  const data = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', `out/previews/${name}.mp4`], {encoding: 'utf8'}));
  const v = data.streams.find((s: {codec_type: string}) => s.codec_type === 'video');
  const a = data.streams.find((s: {codec_type: string}) => s.codec_type === 'audio');
  assert.equal(v.nb_frames, String(frames)); assert.equal(v.width, 1080); assert.equal(v.height, 1080);
  assert.equal(v.r_frame_rate, '60/1'); assert.ok(['yuv420p', 'yuvj420p'].includes(v.pix_fmt)); assert.equal(v.codec_name, 'h264');
  assert.equal(a.codec_name, 'aac'); assert.equal(a.channels, 2); assert.equal(a.sample_rate, '48000');
  return {name, ...data};
});
await writeFile('analysis/preview-validation.json', JSON.stringify(reports, null, 2));
console.log('All four encoded previews passed format/frame/audio checks.');
