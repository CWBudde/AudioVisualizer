import {Backdrop} from '../elements/Backdrop';
import type {CameraPose, SceneProps} from '../engine/frame';
import {followRig, RIGS} from '../world';
import {GhostLantern} from '../world/GhostLantern';
import {Plain} from '../world/Plain';
import {Walkers} from '../world/Walkers';
import {Wick} from '../world/Wick';
import type {SceneDef} from './registry';

// sleeping-plain (memory false) and memory-plain (memory true): the same dolly shot, the callback (§4.1, §4.6). Owned by WP2.
// STUB (Phase 0): plain, walkers, Wick and ghost on the dolly rig; no freeze dim, fill flicker, residue look or answer yet.
type Props = SceneProps & {memory?: boolean};

const camera = ({t, world}: SceneProps): CameraPose => followRig(world, RIGS.dolly, t);

const PlainSolo = (p: Props) => {
  const {t, light, world, memory} = p;
  return <>
    <Backdrop light={light} glow={.4} center={camera(p).position}/>
    <Plain t={t} light={light} world={world} residue={memory ? 1.4 : 1}/>
    <Walkers t={t} world={world} max={memory ? 2048 : 200} light={light}/>
    <Wick world={world} light={light}/>
    <GhostLantern world={world} light={light}/>
  </>;
};

export const sleepingPlain: SceneDef = {Component: p => <PlainSolo {...p}/>, camera};
export const memoryPlain: SceneDef = {Component: p => <PlainSolo {...p} memory/>, camera};
