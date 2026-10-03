import {Backdrop} from '../elements/Backdrop';
import type {CameraPose, SceneProps} from '../engine/frame';
import {blendPose, followRig, move, RIGS} from '../world';
import {GhostLantern} from '../world/GhostLantern';
import {Plain} from '../world/Plain';
import {Walkers} from '../world/Walkers';
import {Wick} from '../world/Wick';
import type {SceneDef} from './registry';

// first-parade (grand false) and grand-parade (grand true): the rise out of a breath into the march (§4.2, §4.7). Owned by WP3.
// STUB (Phase 0): plain, walkers, Wick and ghost; cameras rise along the §4 rig blends.
type Props = SceneProps & {grand?: boolean};

const firstCamera = ({t, world}: SceneProps): CameraPose =>
  blendPose(followRig(world, RIGS.dolly, t), followRig(world, RIGS.paradeHigh, t), move(9.1685, 11.467, t));
const grandCamera = ({t, world}: SceneProps): CameraPose => {
  const high = blendPose(followRig(world, RIGS.dolly, t), followRig(world, RIGS.grandHigh, t), move(64.038, 66.324, t));
  return blendPose(high, followRig(world, RIGS.grandCauseway, t), move(72, 73.6, t));
};

const Procession = (p: Props) => {
  const {t, light, world, grand} = p;
  return <>
    <Backdrop light={light} glow={.4} center={(grand ? grandCamera : firstCamera)(p).position}/>
    <Plain t={t} light={light} world={world} swellGain={1}/>
    <Walkers t={t} world={world} max={grand ? 2048 : 200} light={light}/>
    <Wick world={world} light={light}/>
    <GhostLantern world={world} light={light}/>
  </>;
};

export const firstParade: SceneDef = {Component: p => <Procession {...p}/>, camera: firstCamera};
export const grandParade: SceneDef = {Component: p => <Procession {...p} grand/>, camera: grandCamera};
