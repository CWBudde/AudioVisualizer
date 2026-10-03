import {Backdrop} from '../elements/Backdrop';
import {Embers} from '../elements/Embers';
import type {SceneProps} from '../engine/frame';
import type {SceneDef} from './registry';

// Placeholder: darkness, a low horizon glow and a slow ember drift.
const Void = ({t, presence, controls: c, seed, light}: SceneProps) => <>
  <Backdrop light={light * .6} glow={.3 + .4 * presence} horizon={-.05}/>
  <Embers seed={seed} count={260} t={t} presence={presence} mode="drift" radius={7} light={light * .8} pulse={.4 * c.kick} size={.1} intensity={1.6} speed={.6}/>
</>;

export const voidScene: SceneDef = {
  Component: Void,
  camera: ({t, local}) => ({position: [.6 * Math.sin(.05 * t), .4, 9 - .08 * local], target: [0, .2, 0], fov: 42, roll: .03 * Math.sin(.1 * t)}),
};
