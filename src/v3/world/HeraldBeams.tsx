import {scaleRGB, tone} from '../engine/palette';
import type {WorldFrame} from './types';

export type HeraldBeamsProps = {world: WorldFrame};

/** STUB (Phase 0): a thin box per active beam. WP1 replaces it with cylindrical-billboard additive quads (§2.6). */
export const HeraldBeams = ({world: {beams}}: HeraldBeamsProps) => <>
  {beams.map((b, i) => <mesh key={i} position={[b.p[0], b.p[1] + b.height / 2, b.p[2]]} scale={[.14, Math.max(b.height, .01), .14]}>
    <boxGeometry/><meshBasicMaterial color={scaleRGB(tone('yellow'), b.glow)}/>
  </mesh>)}
</>;
