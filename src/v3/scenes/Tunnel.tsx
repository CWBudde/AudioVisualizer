import {Embers} from '../elements/Embers';
import type {SceneProps} from '../engine/frame';
import {lightRamp, PALETTE, scaleRGB} from '../engine/palette';
import type {SceneDef} from './registry';

const RINGS = 26, SPACING = 1.6, LENGTH = RINGS * SPACING;
// Placeholder: glowing rings rushing past on the beat grid, fading into fog.
const Tunnel = ({t, presence, controls: c, seed, light}: SceneProps) => {
  const travel = c.beat * .9;
  return <>
    <color attach="background" args={[PALETTE.void]}/>
    <fogExp2 attach="fog" args={[PALETTE.void, .055]}/>
    {Array.from({length: RINGS}, (_, i) => {
      const z = -((((i * SPACING - travel) % LENGTH) + LENGTH) % LENGTH), depth = -z / LENGTH;
      const hot = (i % 4 === 0 ? 1.2 : .22) * (1 + 1.5 * c.kick);
      return <mesh key={i} position={[0, 0, z]} rotation={[0, 0, i * .3 + .1 * t]} scale={1 + .05 * Math.sin(i + t)}>
        <torusGeometry args={[2.4, .045 + .03 * c.bass, 6, 64]}/>
        <meshBasicMaterial color={scaleRGB(lightRamp(.22 + .5 * light * (1 - .7 * depth)), hot * (.5 + .5 * presence))}/>
      </mesh>;
    })}
    <group position={[0, 0, -8]}>
      <Embers seed={seed} count={300} t={t} presence={presence} mode="drift" radius={5} light={light} pulse={c.kick} size={.06} speed={1.4}/>
    </group>
  </>;
};

export const tunnel: SceneDef = {
  Component: Tunnel,
  camera: ({t, controls: c}) => ({position: [.3 * Math.sin(.3 * t), .2 * Math.cos(.23 * t), 2], target: [0, 0, -10], fov: 60, roll: .12 * c.bar + .08 * Math.sin(.2 * t)}),
};
