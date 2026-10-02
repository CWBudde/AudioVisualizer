import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {Background} from './Background';
import {Core, Formation, ImpactRings, Ribbons, Tunnel} from './Geometry';
import {Sparks} from './Sparks';
import {sceneAt, sparksAt} from './choreography';
import {assertAnalysis, clamp, ease, getAudioControls} from './controls';
import type {Analysis} from './types';
import data from '../public/analysis/controls.json';

export const analysis: Analysis = data;
assertAnalysis(analysis);
export const PixelParade = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig();
  const t = frame / fps, c = getAudioControls(analysis, t), scene = sceneAt(analysis, c, t);
  const fade = 1 - ease((t - (86.12 - 1.2)) / 1.2);
  const entry = .15 + .85 * ease(t / .75);
  const alpha = fade * entry;
  const trails = !c.paused && c.cueIndex !== 9 && scene.ceiling > .5;
  return <AbsoluteFill style={{backgroundColor: '#060814', overflow: 'hidden'}}>
    <Audio src={staticFile('audio/PixelParade.wav')}/>
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="background"><stop offset="0" stopColor="#111C37"/><stop offset=".65" stopColor="#090D21"/><stop offset="1" stopColor="#060814"/></radialGradient>
        <radialGradient id="coreFill"><stop offset="0" stopColor="#162641" stopOpacity=".9"/><stop offset="1" stopColor="#0B152C" stopOpacity=".85"/></radialGradient>
        <filter id="bloom" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <g opacity={fade}><Background t={t} ceiling={scene.ceiling}/></g>
      <g transform="translate(540,540)" opacity={alpha}>
        <Tunnel c={c} scene={scene} t={t}/>
        <g opacity={.18 + scene.ceiling * .12} filter="url(#bloom)">
          <Ribbons c={c} scene={scene}/><Formation a={analysis} t={t}/><Core c={c} scene={scene} t={t}/>
        </g>
        <Ribbons c={c} scene={scene}/>
        {trails && [1 / 30, 1 / 15].map(delay => <Formation key={delay} a={analysis} t={Math.max(0, t - delay)} trails/>)}
        <ImpactRings a={analysis} c={c} t={t} scene={scene}/>
        <Formation a={analysis} t={t}/>
        <Core c={c} scene={scene} t={t}/>
      </g>
    </svg>
    <Sparks sparks={sparksAt(analysis, t, c, scene)} opacity={alpha * clamp(scene.ceiling)}/>
    {fade < 1 && <AbsoluteFill style={{backgroundColor: '#000', opacity: 1 - fade}}/>}
  </AbsoluteFill>;
};
