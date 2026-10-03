import {Backdrop} from '../elements/Backdrop';
import type {CameraPose, SceneProps} from '../engine/frame';
import {blendPose, followRig, move, RIGS, TOP_POSE} from '../world';
import {GhostLantern} from '../world/GhostLantern';
import {Plain} from '../world/Plain';
import {Walkers} from '../world/Walkers';
import {Wick} from '../world/Wick';
import type {SceneDef} from './registry';

// homecoming: the crane to top-down, the lock and the crest fill (§4.8). Owned by WP2.
// STUB (Phase 0): plain, walkers, Wick and ghost; crane grandCauseway → top over [82.35, 84.9].
const camera = ({t, world}: SceneProps): CameraPose => blendPose(followRig(world, RIGS.grandCauseway, t), TOP_POSE(t), move(82.35, 84.9, t));

const Homecoming = (p: SceneProps) => {
  const {t, light, world} = p;
  return <>
    <Backdrop light={light} glow={.4} center={camera(p).position}/>
    <Plain t={t} light={light} world={world}/>
    <Walkers t={t} world={world} max={2048} light={light}/>
    <Wick world={world} light={light}/>
    <GhostLantern world={world} light={light}/>
  </>;
};

export const homecoming: SceneDef = {Component: Homecoming, camera};
