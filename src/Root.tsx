import {Composition, Folder, staticFile} from 'remotion';
import type {CalculateMetadataFunction} from 'remotion';
import {PixelParadeV1} from './v1/PixelParade';
import {PixelParadeV2} from './v2/PixelParade';
import {PixelParadeV3} from './v3/PixelParade';
import type {V3Props} from './v3/PixelParade';
import {assertStory} from './v3/story';
import {FPS, FRAMES, SIZE, compositionId} from './versions';

const format = {durationInFrames: FRAMES, fps: FPS, width: SIZE, height: SIZE};
// story.json is optional: without it v3 falls back to the beat grid (no motifs).
const loadStory: CalculateMetadataFunction<V3Props> = async () => {
  const response = await fetch(staticFile('analysis/story.json'));
  if (!response.ok) return {props: {story: null}};
  const story: unknown = await response.json();
  assertStory(story);
  return {props: {story}};
};
export const Root = () => <Folder name="PixelParade">
  <Composition id={compositionId('v1')} component={PixelParadeV1} {...format}/>
  <Composition id={compositionId('v2')} component={PixelParadeV2} {...format}/>
  <Composition id={compositionId('v3')} component={PixelParadeV3} {...format} defaultProps={{story: null}} calculateMetadata={loadStory}/>
</Folder>;
