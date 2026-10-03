import {Backdrop} from '../elements/Backdrop';
import {Embers} from '../elements/Embers';
import {easeOutCubic} from '../engine/easing';
import type {SceneProps} from '../engine/frame';
import {lightRamp, scaleRGB, tone} from '../engine/palette';
import type {SceneDef} from './registry';

const CUBES = 24;
// Placeholder: a burning core with a ring of orbiting pixels and a gathering ember shell.
const EmberField = ({t, presence, controls: c, seed, light}: SceneProps) => {
  const open = easeOutCubic(presence);
  return <>
    <Backdrop light={light} glow={.7 * presence}/>
    <ambientLight color={tone('plum')} intensity={.4}/>
    <pointLight color={lightRamp(.7 + .2 * light)} intensity={15 + 40 * c.kick} distance={0} decay={2}/>
    <mesh rotation={[.3 * t, .2 * t, 0]} scale={.75 * open * (1 + .12 * c.kick)}>
      <icosahedronGeometry args={[1, 0]}/>
      <meshStandardMaterial color={tone('crimson')} emissive={scaleRGB(lightRamp(.45 + .3 * light), .5 + 1.2 * c.kick)} flatShading roughness={.6}/>
    </mesh>
    {Array.from({length: CUBES}, (_, i) => {
      const a = i / CUBES * Math.PI * 2 + .35 * t, r = 2.4 * open + .15 * Math.sin(3 * a + t);
      return <mesh key={i} position={[Math.cos(a) * r, .35 * Math.sin(2 * a + .5 * t), Math.sin(a) * r]} rotation={[a, a + t, 0]} scale={.16 * (1 + .6 * c.snare)}>
        <boxGeometry/>
        <meshStandardMaterial color={tone('orange')} emissive={scaleRGB(lightRamp(.4 + .4 * (i % 4) / 3), .2 + .8 * c.hat)} roughness={.4}/>
      </mesh>;
    })}
    <Embers seed={seed} count={420} t={t} presence={presence} mode="gather" radius={3.4} light={light} pulse={c.kick} size={.07}/>
  </>;
};

export const emberField: SceneDef = {
  Component: EmberField,
  camera: ({t, local, seed}) => {
    const a = .12 * local + seed % 7;
    return {position: [7 * Math.sin(a), 1.6 + .4 * Math.sin(.2 * t), 7 * Math.cos(a)], target: [0, 0, 0], fov: 45, roll: .05 * Math.sin(.15 * t)};
  },
};
