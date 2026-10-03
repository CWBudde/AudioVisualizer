import {scaleRGB, tone} from '../engine/palette';
import type {WorldFrame} from './types';

export type AnswerProps = {world: WorldFrame; light: number};

/** STUB (Phase 0): an amber box while world.answer.visible. WP1 replaces it with the 2× amber-headed walker and its light (§2.6). */
export const Answer = ({world: {answer}}: AnswerProps) => answer.visible > 0
  ? <mesh position={[answer.p[0], answer.p[1] + .36 * answer.stand, answer.p[2]]} scale={[.36, .72 * Math.max(answer.stand, .01), .36]}>
    <boxGeometry/><meshBasicMaterial color={scaleRGB(tone('amber'), 1 + answer.glow)}/>
  </mesh>
  : null;
