import {scaleRGB, tone} from '../engine/palette';
import type {WorldFrame} from './types';

export type WickProps = {world: WorldFrame; light: number};

/**
 * STUB (Phase 0): the .4 × .8 × .4 flare box at the crisp route point.
 * WP1 adds the head halo sprite and the pool light (§2.3).
 */
export const Wick = ({world: {wick}}: WickProps) =>
  <mesh position={[wick.p[0], wick.y + .4 * wick.scale, wick.p[2]]} rotation={[0, Math.atan2(-wick.h[0], -wick.h[2]), 0]} scale={[.4 * wick.scale, .8 * wick.scale, .4 * wick.scale]}>
    <boxGeometry/><meshBasicMaterial color={scaleRGB(tone('flare'), 1.5 + 2 * wick.glow)}/>
  </mesh>;
