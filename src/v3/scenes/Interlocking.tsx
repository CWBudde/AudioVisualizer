import {Backdrop} from '../elements/Backdrop';
import {clamp, ease, smoothstep as ss} from '../engine/easing';
import type {CameraPose, SceneProps, Vec3} from '../engine/frame';
import {mixRGB, scaleRGB, tone} from '../engine/palette';
import {blendPose, move, routeFrame} from '../world';
import type {WorldFrame} from '../world';
import {GhostLantern} from '../world/GhostLantern';
import {HeraldBeams} from '../world/HeraldBeams';
import {Plain} from '../world/Plain';
import {Walkers} from '../world/Walkers';
import {Wick} from '../world/Wick';
import type {SceneDef} from './registry';

// interlocking: two columns, M2 chevrons, M5 beams, ghost blinks, the B7 shadow from 29.75 and the M6 hammer (§4.3).
// Everything that moves comes from the world (§2); this file owns the shot: the descent onto the columns, the drift
// lower under the shadow, the sky and fog, and the floor burning away from Wick into drift (§5 #3).

/**
 * The line is a 100-tile hairpin here and the route U-turns twice, so these rigs hang at fixed world offsets from the
 * camera frame point (south-east of the meander) instead of riding the heading: heading-relative rigs would whip
 * round the U-turns, and topDiag as tabled in §2.7 sees only Wick's next tiles, not the columns.
 * TOP_WIDE is the dissolve's top-down re-angle (all 200 frozen lights), TOP_DIAG the high diagonal that holds both
 * columns, the chevrons, the beams and the shadow front, TOP_DIAG_LOW the lower view the camera drifts to under the
 * shadow. offset: camera from the target; look: the target sits this share of the way from the camera frame point
 * to the route `behind` arc tiles back, so the frame centres on the line rather than on the dark plain ahead.
 */
type Fixed = {offset: Vec3; look: number; behind: number; lift: number; fov: number};
const TOP_WIDE: Fixed = {offset: [15, 80, 20], look: .4, behind: 40, lift: 0, fov: 52};
const TOP_DIAG: Fixed = {offset: [15, 34, 35], look: .5, behind: 30, lift: 0, fov: 52};
const TOP_DIAG_LOW: Fixed = {offset: [15, 14, 20], look: .2, behind: 20, lift: .5, fov: 52};
const BURN: [number, number] = [34.85, 36.6]; // §5 #3: the floor burns away from the head of the line as the kick thins

/** A fixed-offset rig on the smoothed camera frame point: raised with the causeway, tilting forward on the D pedal like followRig. */
function fixed({cam, camArc, pedal}: WorldFrame, {offset, look, behind, lift, fov}: Fixed): CameraPose {
  const b = routeFrame(camArc - behind).p;
  const target: Vec3 = [cam.p[0] + (b[0] - cam.p[0]) * look, cam.y + lift - .5 * pedal, cam.p[2] + (b[2] - cam.p[2]) * look];
  return {position: [target[0] + offset[0], cam.y + lift + offset[1], target[2] + offset[2]], target, fov, roll: 0};
}

/** Descend onto the columns over bar 8 as the trail slots into its lanes, then drift lower under the shadow. */
const camera = ({t, world}: SceneProps): CameraPose =>
  blendPose(blendPose(fixed(world, TOP_WIDE), fixed(world, TOP_DIAG), move(18.311, 21.5, t)), fixed(world, TOP_DIAG_LOW), move(29.752, 34.324, t));

const Interlocking = (p: SceneProps) => {
  const {t, light, world} = p;
  const shadow = world.shadow.strength / .65, blink = clamp(world.ghost.glow - .35, 0, 2);
  // Fog: ink that warms on the ghost's stabs and swells (the orb itself sits beyond the top of a top-down frame),
  // then sours toward crimson-purple under the B7 cloud.
  const fog = .011, warm = mixRGB(scaleRGB(tone('amber'), .07), scaleRGB(tone('crimson'), .05), shadow);
  const fogColor = mixRGB(tone('ink'), warm, clamp(.3 * light + .3 * blink));
  const fogged = {density: fog, color: fogColor};
  const burn = ease((t - BURN[0]) / (BURN[1] - BURN[0]));
  return <>
    <fogExp2 attach="fog" args={[0, fog]} color={fogColor} density={fog}/>
    <Backdrop light={light} glow={.12 + world.horizon.glow} center={camera(p).position} tint={world.horizon.tint} shadow={.5 * shadow}/>
    <Plain t={t} light={light} world={world} fog={fogged} swellGain={1 - .5 * ss(29.752, 31, t)} residue={1 + .5 * burn} burn={burn}/>
    <Walkers t={t} world={world} max={200} light={light} fog={fogged} swellGain={1 - .5 * ss(29.752, 31, t)}/>
    <HeraldBeams world={world}/>
    <GhostLantern world={world} light={light}/>
    <Wick world={world} light={light}/>
  </>;
};

export const interlocking: SceneDef = {Component: Interlocking, camera};
