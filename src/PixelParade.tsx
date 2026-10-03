import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {Renderer} from './gl/Renderer';
import {frameUniforms} from './gl/uniforms';
import {assertAnalysis} from './controls';
import type {Analysis} from './types';
import data from '../public/analysis/controls.json';

export const analysis: Analysis = data;
assertAnalysis(analysis);
export const PixelParade = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig();
  return <AbsoluteFill style={{backgroundColor: '#060814', overflow: 'hidden'}}>
    <Audio src={staticFile('audio/PixelParade.wav')}/>
    <Renderer uniforms={frameUniforms(analysis, frame / fps, frame)}/>
  </AbsoluteFill>;
};
