import {Backdrop} from '../elements/Backdrop';
import type {CameraPose, SceneProps} from '../engine/frame';
import {routeFrame} from '../world';
import {Walkers} from '../world/Walkers';
import {Wick} from '../world/Wick';
import type {SceneDef} from './registry';

// drift: no floor, embers, the sky shadow and the grid snap (§4.4). Owned by WP4.
// STUB (Phase 0): Wick over nothing, ember-look walkers, the absolute orbit of §2.7.
// a0 should come from cam at 36.6 (A(36.6) ≈ 202 with the real story); the stub reads the route frame at 202.
const start = routeFrame(202), a0 = Math.atan2(-start.h[2] - start.r[2], -start.h[0] - start.r[0]);
const camera = ({t, world}: SceneProps): CameraPose => {
  const {p, y} = world.cam, a = a0 + .12 * (t - 36.6);
  return {position: [p[0] + 12 * Math.cos(a), y + 4 + 1.5 * Math.sin(.21 * t), p[2] + 12 * Math.sin(a)], target: [p[0], y + 1.5, p[2]], fov: 50, roll: .05 * Math.sin(.3 * t)};
};

const Drift = (p: SceneProps) => {
  const {t, light, world} = p;
  return <>
    <Backdrop light={light} glow={.5} center={camera(p).position}/>
    <Walkers t={t} world={world} look="ember" max={200} light={light}/>
    <Wick world={world} light={light}/>
  </>;
};

export const drift: SceneDef = {Component: Drift, camera};
