import {Backdrop} from '../elements/Backdrop';
import {Embers} from '../elements/Embers';
import {easeOutCubic} from '../engine/easing';
import type {SceneProps} from '../engine/frame';
import {lightRamp, scaleRGB, tone} from '../engine/palette';
import type {SceneDef} from './registry';

const PETALS = 14;
// Placeholder: a sunburst of petals opening around a white-hot core, embers streaming out.
const Bloom = ({t, presence, controls: c, seed, light}: SceneProps) => {
  const open = easeOutCubic(presence);
  return <>
    <Backdrop light={light * .8} glow={.5 * presence} horizon={-.2}/>
    <pointLight color={lightRamp(.85)} intensity={20 + 50 * c.kick} distance={0} decay={2}/>
    <mesh scale={.42 * (1 + .15 * c.kick) * open}>
      <sphereGeometry args={[1, 32, 16]}/>
      <meshBasicMaterial color={scaleRGB(tone('flare'), 2 + 2 * c.kick)}/>
    </mesh>
    <group rotation={[0, 0, .12 * t]}>
      {Array.from({length: PETALS}, (_, i) => {
        const a = i / PETALS * Math.PI * 2, length = (1.6 + .5 * (i % 2)) * open * (1 + .2 * c.snare), r = .7 + length / 2;
        return <mesh key={i} position={[Math.cos(a) * r, Math.sin(a) * r, -.1 * (i % 2)]} rotation={[0, 0, a - Math.PI / 2]} scale={[.32, length, .1]}>
          <coneGeometry args={[1, 1, 4]}/>
          <meshStandardMaterial color={tone('amber')} emissive={scaleRGB(lightRamp(.5 + .3 * (i % 3) / 2), .35 + .8 * c.kick)} roughness={.5}/>
        </mesh>;
      })}
    </group>
    <Embers seed={seed} count={500} t={t} presence={presence} mode="scatter" radius={5} light={light} pulse={c.kick} size={.08} morph={.9}/>
  </>;
};

export const bloom: SceneDef = {
  Component: Bloom,
  camera: ({t, local}) => ({position: [.5 * Math.sin(.1 * t), .3 * Math.cos(.13 * t), 8 - .05 * local], target: [0, 0, 0], fov: 45, roll: .05 * t}),
};
