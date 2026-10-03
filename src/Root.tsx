import {Composition, Folder} from 'remotion';
import {PixelParadeV1} from './v1/PixelParade';
import {PixelParadeV2} from './v2/PixelParade';
import {FPS, FRAMES, SIZE, compositionId} from './versions';

const format = {durationInFrames: FRAMES, fps: FPS, width: SIZE, height: SIZE};
export const Root = () => <Folder name="PixelParade">
  <Composition id={compositionId('v1')} component={PixelParadeV1} {...format}/>
  <Composition id={compositionId('v2')} component={PixelParadeV2} {...format}/>
</Folder>;
