import {mixRGB, scaleRGB, tone} from '../engine/palette';
import {Glow} from './Glow';
import type {WorldFrame} from './types';

export type WickProps = {world: WorldFrame; light: number};

/**
 * Wick's in-world body (§2.3): the .4 × .8 × .4 flare box at the crisp route point (bottom at wick.y), a head halo
 * (radius .6) and, in the tile shader, its pool of light. Scales down in freezes 1 and 3; glow dims in arp rests.
 * The screen-space crest is the motif layer's.
 */
export const Wick = ({world: {wick}}: WickProps) => {
  const s = wick.scale, top = wick.y + .8 * s;
  return <>
    <mesh position={[wick.p[0], wick.y + .4 * s, wick.p[2]]} rotation={[0, Math.atan2(wick.h[0], wick.h[2]), 0]} scale={[.4 * s, .8 * s, .4 * s]}>
      <boxGeometry/><meshBasicMaterial color={scaleRGB(tone('flare'), .45 + .55 * wick.glow)}/>
    </mesh>
    <Glow position={[wick.p[0], top - .1 * s, wick.p[2]]} radius={.6 * (.4 + .6 * s)} color={scaleRGB(mixRGB(tone('yellow'), tone('flare'), wick.glow), .6 * wick.glow)} core={.4}/>
  </>;
};
