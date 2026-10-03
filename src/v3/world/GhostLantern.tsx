import {mixRGB, scaleRGB, tone} from '../engine/palette';
import {Glow} from './Glow';
import type {WorldFrame} from './types';

/** dim (optional, default 1) multiplies the orb (homecoming's fade to ink). */
export type GhostLanternProps = {world: WorldFrame; light: number; dim?: number};

/**
 * The ghost lantern (§2.6): an additive orb sprite, purple → amber with the light; glow (.6 + .4 light) · world.ghost.glow.
 * From the stair descent (ghost.lantern) it also has a body, a small amber lantern below the orb's centre, never as hot
 * as Wick's flare.
 */
export const GhostLantern = ({world: {ghost}, light, dim = 1}: GhostLanternProps) => {
  const tint = mixRGB(tone('purple'), tone('amber'), Math.min(1, light * 1.2)), g = ghost.glow * (.6 + .4 * light) * dim, k = ghost.lantern;
  return <>
    <Glow position={ghost.p} radius={ghost.radius} core={.8 + .6 * k} color={scaleRGB(tint, g * (1 - .3 * k))}/>
    {k > 0 && <mesh position={[ghost.p[0], ghost.p[1] - .05, ghost.p[2]]} scale={[.3 * k, .42 * k, .3 * k]}>
      <boxGeometry/><meshBasicMaterial color={scaleRGB(mixRGB(tint, tone('yellow'), .3), (.5 + .5 * Math.min(g, 2)) * dim)}/>
    </mesh>}
  </>;
};
