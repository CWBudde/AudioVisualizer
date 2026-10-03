import {mixRGB, scaleRGB, tone} from '../engine/palette';
import {WICK_H, WICK_W} from './frame';
import {Glow} from './Glow';
import type {WorldFrame} from './types';

export type WickProps = {world: WorldFrame; light: number};


/**
 * Wick's in-world body (§2.3): a small, hot flare box at the crisp route point (bottom at wick.y) with a tight head halo
 * (its pool of light is in the tile shader). Kept small so that at dolly distance it reads as a pixel flame, not a lamp;
 * kept the hottest emitter so it stays the brightest point of every frame. Scales down in freezes 1 and 3; glow dims in
 * arp rests. The screen-space crest is the motif layer's (its base sits just above WICK_H).
 */
export const Wick = ({world: {wick}}: WickProps) => {
  const s = wick.scale, top = wick.y + WICK_H * s;
  return <>
    <mesh position={[wick.p[0], wick.y + WICK_H / 2 * s, wick.p[2]]} rotation={[0, Math.atan2(wick.h[0], wick.h[2]), 0]} scale={[WICK_W * s, WICK_H * s, WICK_W * s]}>
      <boxGeometry/><meshBasicMaterial color={scaleRGB(tone('flare'), .5 + 1.1 * wick.glow)}/>
    </mesh>
    <Glow position={[wick.p[0], top - .1 * s, wick.p[2]]} radius={.32 * (.4 + .6 * s)} color={scaleRGB(mixRGB(tone('yellow'), tone('flare'), wick.glow), .4 * wick.glow)} core={.6}/>
  </>;
};
