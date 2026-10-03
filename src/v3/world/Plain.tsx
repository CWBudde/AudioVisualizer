import type {RGB} from '../engine/palette';
import {scaleRGB, tone} from '../engine/palette';
import {routePoint, VERTICES} from './route';
import type {WorldFrame} from './types';

/**
 * floor: 0 hides the plain (drift); residue: permanent trail level (memory-plain 1.4); fog: exp² fog in linear RGB;
 * swellGain: 1 lets the bass swell lift tiles; dim: overall multiplier (freeze 1 dims to .4).
 */
export type PlainProps = {t: number; light: number; world: WorldFrame; floor?: number; residue?: number; fog?: {density: number; color: RGB}; swellGain?: number; dim?: number};

/** A flat strip from a to b (route tiles are axis-aligned), slightly above the ground. */
const Strip = ({a, b, y, color}: {a: number; b: number; y: number; color: RGB}) => {
  const p = routePoint(a), q = routePoint(b);
  return <mesh position={[(p[0] + q[0]) / 2, y, (p[2] + q[2]) / 2]} scale={[Math.abs(q[0] - p[0]) + .4, .02, Math.abs(q[2] - p[2]) + .4]}>
    <boxGeometry/><meshBasicMaterial color={color}/>
  </mesh>;
};

/**
 * STUB (Phase 0): an ink ground plane, the whole route as a faint purple strip and the walked part as an orange trail.
 * WP1 replaces it with the instanced 160 × 160 tile system and its event textures (§2.4).
 */
export const Plain = ({light, world, floor = 1, dim = 1}: PlainProps) => {
  const k = floor * dim;
  if (k <= 0) return null;
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-.5, 0, -.5]}>
      <planeGeometry args={[160, 160]}/><meshBasicMaterial color={scaleRGB(tone('ink'), k)}/>
    </mesh>
    {VERTICES.slice(1).map(([a1], i) => {
      const a0 = VERTICES[i][0];
      return <group key={a0}>
        <Strip a={a0} b={a1} y={.01} color={scaleRGB(tone('purple'), .25 * k)}/>
        {world.arc > a0 && <Strip a={a0} b={Math.min(a1, world.arc)} y={.02} color={scaleRGB(tone('orange'), (.4 + light) * k)}/>}
      </group>;
    })}
  </group>;
};
