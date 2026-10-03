import {Backdrop} from '../elements/Backdrop';
import type {CameraPose, SceneProps} from '../engine/frame';
import {blendPose, followRig, move, RIGS} from '../world';
import {GhostLantern} from '../world/GhostLantern';
import {HeraldBeams} from '../world/HeraldBeams';
import {Plain} from '../world/Plain';
import {Walkers} from '../world/Walkers';
import {Wick} from '../world/Wick';
import type {SceneDef} from './registry';

// interlocking: two columns, chevrons, beams, the B7 shadow and the hammer (§4.3). Owned by WP3.
// STUB (Phase 0): plain, walkers, Wick, ghost and beams; topDiag → topDiagLow under the shadow.
const camera = ({t, world}: SceneProps): CameraPose =>
  blendPose(followRig(world, RIGS.topDiag, t), followRig(world, RIGS.topDiagLow, t), move(29.752, 34.324, t));

const Interlocking = (p: SceneProps) => {
  const {t, light, world} = p;
  return <>
    <Backdrop light={light} glow={.4} center={camera(p).position}/>
    <Plain t={t} light={light} world={world}/>
    <Walkers t={t} world={world} max={200} light={light}/>
    <Wick world={world} light={light}/>
    <GhostLantern world={world} light={light}/>
    <HeraldBeams world={world}/>
  </>;
};

export const interlocking: SceneDef = {Component: Interlocking, camera};
