import {Backdrop} from '../elements/Backdrop';
import {clamp, smoothstep as ss} from '../engine/easing';
import type {CameraPose, SceneProps, Vec3} from '../engine/frame';
import {mixRGB, scaleRGB, tone} from '../engine/palette';
import {blendPose, followRig, move, RIGS, routeFrame} from '../world';
import type {Rig, WorldFrame} from '../world';
import {Answer} from '../world/Answer';
import {GhostLantern} from '../world/GhostLantern';
import {HeraldBeams} from '../world/HeraldBeams';
import {LoopRing} from '../world/LoopRing';
import {Plain} from '../world/Plain';
import {Walkers} from '../world/Walkers';
import {Wick} from '../world/Wick';
import type {SceneDef} from './registry';

// first-parade (grand false) and grand-parade (grand true): the rise out of a held breath into the march (§4.2, §4.7).
// Everything that moves comes from the world (§2); this file owns the shot: the rise, the stair swoop, sky and fog.
// The grand parade is the callback of the first: the same rise from the same dolly, wider (40 → 2,000 walkers).
type Props = SceneProps & {grand?: boolean};

/**
 * The high rigs look back down the line from ahead-left of Wick: a procession reads from the front, and a rig behind
 * Wick (§2.7 paradeHigh/grandHigh as tabled) can never see the walkers that follow it. grandHigh is paradeHigh × 2.2,
 * so f700 and f3900 share one composition: Wick front-left, the line streaming back to the right.
 */
const PARADE_HIGH: Rig = {back: -20, side: -24, up: 14, ahead: -8, lift: 0, fov: 45};
const WIDER = 2.2;
/** The rise starts from the plains' low dolly: walkers next to its lens fade out as they do there (WP2-R6). */
const NEAR: [number, number] = [2.5, 9];
const GRAND_HIGH: Rig = {back: PARADE_HIGH.back * WIDER, side: PARADE_HIGH.side * WIDER, up: PARADE_HIGH.up * WIDER, ahead: PARADE_HIGH.ahead * WIDER, lift: 0, fov: 50};
/** Low beside the head of the line: the M4 ring closes around it and the stair rises in profile (§4.7 70.9–72.0). */
const STAIR: Rig = {back: 0, side: -18, up: 7, ahead: 2, lift: 1.5, fov: 45};
/** Heading chord (arc tiles each side) for the wide rigs: the ±8 camera frame would swing them through every stair step. */
const CHORD = 30;

/** world with the camera frame's heading taken over a ±CHORD chord, so wide rigs ride the route's general direction. */
function steady(world: WorldFrame): WorldFrame {
  const a = routeFrame(world.camArc - CHORD).p, b = routeFrame(world.camArc + CHORD).p, dx = b[0] - a[0], dz = b[2] - a[2], n = Math.hypot(dx, dz);
  if (n < 1) return world;
  const h: Vec3 = [dx / n, 0, dz / n];
  return {...world, cam: {...world.cam, h, r: [-h[2], 0, h[0]]}};
}

/** The plain scenes' dolly (bob at held time, lowered by their fill pushes): the iris opens on the same framing. */
function dolly(world: WorldFrame, push: number): CameraPose {
  const pose = followRig(world, RIGS.dolly, world.held);
  return {...pose, position: [pose.position[0], pose.position[1] - .2 * push, pose.position[2]]};
}

/**
 * The rise: out of the breath the camera bursts up and round to the front (a sine ease-out over the bar, not §4.2's
 * eioc, so the line is in view by the second beat: f3900 already shows the whole risen plain).
 */
const rise = (a: number, b: number, t: number) => Math.sin(Math.PI / 2 * clamp((t - a) / (b - a)));

const firstCamera = ({t, world}: SceneProps): CameraPose =>
  blendPose(dolly(world, 1), followRig(steady(world), PARADE_HIGH, t), rise(9.1685, 11.467, t));

/**
 * The same rise wider; a dive to the head on the M4 cadence, then up with the ascending run onto the causeway rig
 * homecoming's crane starts from (§4.7: grandHigh → grandCauseway over [72.0, 73.6]).
 */
const grandCamera = ({t, world}: SceneProps): CameraPose => {
  const w = steady(world);
  const high = blendPose(dolly(world, 2), followRig(w, GRAND_HIGH, t), rise(64.038, 66.324, t));
  const dive = blendPose(high, followRig(w, STAIR, t), move(70.4, 71.9, t));
  // On the steady heading too: by the final descent (≈ 80 s) it equals the camera frame's, so the pose homecoming's
  // crane starts from (followRig(world, grandCauseway)) is met without a jump at the wash.
  return blendPose(dive, followRig(w, RIGS.grandCauseway, t), move(72, 73.6, t));
};

const Procession = (p: Props) => {
  const {t, light, world, grand} = p;
  const camera = (grand ? grandCamera : firstCamera)(p);
  // Far tiles sink into ink that warms with the light: the march is the only light out there. Densities suit the rig
  // distances (about 34 and 75 tiles to Wick): Wick stays clear, the tail of the line fades.
  const fog = grand ? .0065 : .01, fogColor = mixRGB(tone('ink'), scaleRGB(tone('amber'), .07), .5 * light);
  const fogged = {density: fog, color: fogColor}, swellGain = grand ? 1 - ss(82.04, 82.35, t) : 1;
  // A faint horizon only (the high rigs see a lot of sky, and the band widens with light); the band itself belongs to
  // the pads (§2.6 Horizon band).
  const sky = .05 + world.horizon.glow;
  return <>
    <fogExp2 attach="fog" args={[0, fog]} color={fogColor} density={fog}/>
    <Backdrop light={light} glow={sky} center={camera.position} tint={world.horizon.tint} shadow={0}/>
    <Plain t={t} light={light} world={world} fog={fogged} swellGain={swellGain}/>
    <Walkers t={t} world={world} max={grand ? 2048 : 200} light={light} fog={fogged} swellGain={swellGain} near={NEAR}/>
    <LoopRing world={world}/>
    {grand && <><Answer world={world} light={light}/><HeraldBeams world={world}/></>}
    <GhostLantern world={world} light={light}/>
    <Wick world={world} light={light}/>
  </>;
};

export const firstParade: SceneDef = {Component: p => <Procession {...p}/>, camera: firstCamera};
export const grandParade: SceneDef = {Component: p => <Procession {...p} grand/>, camera: grandCamera};
