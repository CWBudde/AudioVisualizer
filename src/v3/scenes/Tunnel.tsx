import {Backdrop} from '../elements/Backdrop';
import type {CameraPose, SceneProps} from '../engine/frame';
import {followRig, RIGS} from '../world';
import {GhostLantern} from '../world/GhostLantern';
import {HeraldBeams} from '../world/HeraldBeams';
import {Plain} from '../world/Plain';
import {Walkers} from '../world/Walkers';
import {Wick} from '../world/Wick';
import type {SceneDef} from './registry';

// tunnel: instanced walls along the route, the crimson chevron, hammer and the ghost in the mouth (§4.5). Owned by WP4.
// STUB (Phase 0): no walls yet; plain at .6, walkers, Wick, ghost, beams on the chase rig.
const camera = ({t, world, controls: c}: SceneProps): CameraPose => {
  const pose = followRig(world, RIGS.chase, t);
  return {...pose, roll: .04 * Math.sin(.5 * t) + .03 * c.kick};
};

const Tunnel = (p: SceneProps) => {
  const {t, light, world} = p;
  return <>
    <Backdrop light={light} glow={.3} center={camera(p).position}/>
    <Plain t={t} light={light} world={world} floor={.6} swellGain={1}/>
    <Walkers t={t} world={world} max={200} light={light}/>
    <Wick world={world} light={light}/>
    <GhostLantern world={world} light={light}/>
    <HeraldBeams world={world}/>
  </>;
};

export const tunnel: SceneDef = {Component: Tunnel, camera};
