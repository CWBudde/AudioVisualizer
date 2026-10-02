import {createElement} from 'react';
import {Composition, registerRoot} from 'remotion';
import {PixelParade, analysis} from './PixelParade';

registerRoot(() => createElement(Composition, {
  id: 'PixelParadeSquare', component: PixelParade,
  durationInFrames: Math.ceil(analysis.tracks.mix.source.durationSeconds * 60),
  fps: 60, width: 1080, height: 1080,
}));
