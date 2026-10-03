import {scaleRGB, tone} from '../engine/palette';
import type {WorldFrame} from './types';

export type LoopRingProps = {world: WorldFrame};

/** STUB (Phase 0): a flat annulus while the ring flashes. WP1 replaces it with the annulus sprite (§2.6 Loop ring). */
export const LoopRing = ({world: {ring}}: LoopRingProps) => ring.flash > 0 && ring.radius > 0
  ? <mesh position={[ring.center[0], .05, ring.center[2]]} rotation={[-Math.PI / 2, 0, 0]}>
    <ringGeometry args={[ring.radius - .15, ring.radius + .15, 64]}/><meshBasicMaterial color={scaleRGB(tone('amber'), 3 * ring.flash)}/>
  </mesh>
  : null;
