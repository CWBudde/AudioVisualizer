import {scaleRGB, tone} from '../engine/palette';
import {Glow} from './Glow';
import type {WorldFrame} from './types';

/** dim (optional, default 1) multiplies everything it emits. */
export type AnswerProps = {world: WorldFrame; light: number; dim?: number};

/**
 * The answer light (§2.6): a walker that is not one of the 2,048 — a crimson foot and an amber head at twice a walker's
 * head glow — with its own halo (its pool of light on the tiles is in the plain shader).
 */
export const Answer = ({world: {answer}, light, dim = 1}: AnswerProps) => {
  if (answer.visible <= 0) return null;
  const s = Math.max(answer.stand, .001), [x, y, z] = answer.p, g = answer.glow * dim;
  return <>
    <mesh position={[x, y + .18 * s, z]} scale={.36 * s}>
      <boxGeometry/><meshBasicMaterial color={scaleRGB(tone('crimson'), .3 * dim)}/>
    </mesh>
    <mesh position={[x, y + .54 * s, z]} scale={.36 * s}>
      <boxGeometry/><meshBasicMaterial color={scaleRGB(tone('amber'), 4 * g)}/>
    </mesh>
    <Glow position={[x, y + .6 * s, z]} radius={.9} color={scaleRGB(tone('amber'), (.5 + .5 * light) * g)} core={.5}/>
  </>;
};
