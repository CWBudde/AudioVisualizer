import {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {analysis} from '../shared/analysis';
import {Soundtrack} from '../shared/Soundtrack';
import {SIZE} from '../versions';
import {v3Frame} from './engine/frame';
import {PALETTE} from './engine/palette';
import {Compositor} from './render/Compositor';
import {SCENES} from './scenes/registry';
import {storyFromAnalysis} from './story';
import type {Story} from './story';

/** story comes from calculateMetadata (public/analysis/story.json); null falls back to the beat grid. */
export type V3Props = {story: Story | null};

export const PixelParadeV3 = ({story}: V3Props) => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig();
  // The whole frame is computed here, outside the canvas, as a pure function of time.
  const state = useMemo(() => v3Frame(analysis, story ?? storyFromAnalysis(analysis), frame / fps, frame, SCENES), [story, frame, fps]);
  return <AbsoluteFill style={{backgroundColor: PALETTE.void}}>
    <Soundtrack/>
    <ThreeCanvas width={SIZE} height={SIZE} dpr={1} flat
      gl={{preserveDrawingBuffer: true, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance'}}>
      <Compositor state={state}/>
    </ThreeCanvas>
  </AbsoluteFill>;
};
