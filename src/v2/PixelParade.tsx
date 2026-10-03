import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Renderer} from './gl/Renderer';
import {frameUniforms} from './gl/uniforms';
import {analysis} from '../shared/analysis';
import {Soundtrack} from '../shared/Soundtrack';

export const PixelParadeV2 = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig();
  return <AbsoluteFill style={{backgroundColor: '#060814', overflow: 'hidden'}}>
    <Soundtrack/>
    <Renderer uniforms={frameUniforms(analysis, frame / fps, frame)}/>
  </AbsoluteFill>;
};
