import {mixRGB, scaleRGB, tone} from '../engine/palette';
import {Glow} from './Glow';
import type {WorldFrame} from './types';

/** dim (optional, default 1) multiplies the orb (homecoming's fade to ink). */
export type GhostLanternProps = {world: WorldFrame; light: number; dim?: number};

/** The ghost lantern (§2.6): an additive orb sprite, purple → amber with the light; glow (.6 + .4 light) · world.ghost.glow. */
export const GhostLantern = ({world: {ghost}, light, dim = 1}: GhostLanternProps) =>
  <Glow position={ghost.p} radius={ghost.radius} core={.8}
    color={scaleRGB(mixRGB(tone('purple'), tone('amber'), Math.min(1, light * 1.2)), ghost.glow * (.6 + .4 * light) * dim)}/>;
