import {mixRGB, scaleRGB, tone} from '../engine/palette';
import type {WorldFrame} from './types';

export type GhostLanternProps = {world: WorldFrame; light: number};

/** STUB (Phase 0): a plain orb at world.ghost. WP1 replaces it with the additive orb sprite (§2.6). */
export const GhostLantern = ({world: {ghost}, light}: GhostLanternProps) =>
  <mesh position={ghost.p} scale={.5 * ghost.radius}>
    <sphereGeometry args={[1, 16, 8]}/><meshBasicMaterial color={scaleRGB(mixRGB(tone('purple'), tone('amber'), light), 2 * ghost.glow)}/>
  </mesh>;
