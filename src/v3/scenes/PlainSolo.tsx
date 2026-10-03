import {Backdrop} from '../elements/Backdrop';
import {smoothstep as ss} from '../engine/easing';
import type {CameraPose, SceneProps} from '../engine/frame';
import {mixRGB, scaleRGB, tone} from '../engine/palette';
import {followRig, RIGS} from '../world';
import {Answer} from '../world/Answer';
import {GhostLantern} from '../world/GhostLantern';
import {HeraldBeams} from '../world/HeraldBeams';
import {Plain} from '../world/Plain';
import {Walkers} from '../world/Walkers';
import {Wick} from '../world/Wick';
import type {SceneDef} from './registry';

// sleeping-plain (memory false) and memory-plain (memory true): the same low dolly beside Wick, the callback (§4.1, §4.6).
// Everything that moves comes from the world (§2); this file owns the shot: rig, fill push, freeze dim, sky and fog.
type Props = SceneProps & {memory?: boolean};

// The solo fill and its callback: a small push down (§4.1 `up −= .2·ss(8.03, 8.6)`), mirrored on the 62.89 fill.
const FILL = [[8.03, 8.6], [62.89, 63.46]] as const;
// The held breaths inside these scenes: the plain dims as Wick shrinks to one pixel (§2.1 freeze 1 and 3).
const BREATH = [[8.746, 8.813, .4], [63.615, 63.682, .55]] as const;
const FOG = .026; // exp² density: the plain sinks into ink about 40 tiles out; the 25–45-tile blinks stay readable

/**
 * The dolly rig evaluated at held time, so the bob holds with everything else in a breath. Identical for both
 * scenes: f300 and f3450 (and f540 and f3830) are the same framing on different stretches of the route.
 */
const camera = ({world}: SceneProps): CameraPose => {
  const pose = followRig(world, RIGS.dolly, world.held), push = FILL.reduce((s, [a, b]) => s + ss(a, b, world.held), 0);
  return {...pose, position: [pose.position[0], pose.position[1] - .2 * push, pose.position[2]]};
};

const PlainSolo = (p: Props) => {
  const {t, light, world, memory} = p;
  const [a, b, low] = BREATH[memory ? 1 : 0], dim = 1 - (1 - low) * ss(a, b, t);
  // The band only plays on the pads (memory: amber over bars 24–25); the sleeping sky is a bare ink gradient.
  const band = world.horizon.glow, sky = .1 + .3 * band;
  // Far tiles fade to the sky's horizon colour, warmed a little while the band plays.
  const fog = {density: FOG, color: mixRGB(tone('ink'), scaleRGB(tone('amber'), .08), .6 * band * world.horizon.tint)};
  return <>
    <fogExp2 attach="fog" args={[0, FOG]} color={fog.color} density={FOG}/>
    <Backdrop light={light} glow={sky} center={camera(p).position} tint={world.horizon.tint} shadow={world.shadow.sky}/>
    <Plain t={t} light={light} world={world} residue={memory ? 1.4 : 1} fog={fog} swellGain={0} dim={dim}/>
    <Walkers t={t} world={world} max={memory ? 2048 : 200} light={light} fog={fog}/>
    <Wick world={world} light={light}/>
    <GhostLantern world={world} light={light}/>
    {memory && <><Answer world={world} light={light}/><HeraldBeams world={world}/></>}
  </>;
};

export const sleepingPlain: SceneDef = {Component: p => <PlainSolo {...p}/>, camera};
export const memoryPlain: SceneDef = {Component: p => <PlainSolo {...p} memory/>, camera};
