import {Backdrop} from '../elements/Backdrop';
import {lerp, smoothstep as ss} from '../engine/easing';
import type {CameraPose, SceneProps, Vec3} from '../engine/frame';
import {mixRGB, scaleRGB, tone} from '../engine/palette';
import {followRig, move, RIGS, TOP_POSE} from '../world';
import {Answer} from '../world/Answer';
import {GhostLantern} from '../world/GhostLantern';
import {HeraldBeams} from '../world/HeraldBeams';
import {LoopRing} from '../world/LoopRing';
import {Plain} from '../world/Plain';
import {Walkers} from '../world/Walkers';
import {Wick} from '../world/Wick';
import type {SceneDef} from './registry';

// homecoming: the collapse, the crane up to the whole crest, the lock on the final G and the amber fill (§4.8).
// Walkers settling, the causeway lowering, the lock and fill events all come from the world; this file owns the
// crane, the fog that thins as it rises, and the fade to ink that leaves Wick's ember alone.

const CRANE: [number, number] = [82.35, 84.9];
const RELEASE: [number, number] = [85.73, 86.05]; // the chord releases: everything but Wick fades to ink

type Polar = {d: number; yaw: number; pitch: number};
const polar = ([x, y, z]: Vec3): Polar => {const d = Math.hypot(x, y, z); return {d, yaw: Math.atan2(z, x), pitch: Math.asin(y / d)};};
const wrap = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

/**
 * The crane grandCauseway → top (§4.8), as an orbit about a travelling target instead of a straight blend of
 * positions (a straight blend passes through vertical; the compositor's up is +Y, so |dir.y| must stay < .995).
 * The target slides from the line's head to the crest centre and the distance grows log-linearly over the crane;
 * the pitch rises with it (60° at about 83.7 s) and only ever lies between the two end pitches (32° and TOP's 83.5°);
 * the yaw swing (≈150°, round through east) lags, so most of it lands as a slow roll-in once the view is near
 * top-down, which turns the outline upright as the crest locks.
 */
function crane(t: number, a: CameraPose, b: CameraPose): CameraPose {
  const k = move(CRANE[0], CRANE[1], t), ky = move(82.6, 84.75, t);
  if (k <= 0) return a;
  if (k >= 1 && ky >= 1) return b;
  const sub = (p: Vec3, q: Vec3): Vec3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const p0 = polar(sub(a.position, a.target)), p1 = polar(sub(b.position, b.target));
  const d = Math.exp(lerp(Math.log(p0.d), Math.log(p1.d), k)), pitch = lerp(p0.pitch, p1.pitch, k), yaw = p0.yaw + wrap(p1.yaw - p0.yaw) * ky;
  const target: Vec3 = [lerp(a.target[0], b.target[0], k), lerp(a.target[1], b.target[1], k), lerp(a.target[2], b.target[2], k)];
  const c = Math.cos(pitch) * d;
  return {position: [target[0] + c * Math.cos(yaw), target[1] + Math.sin(pitch) * d, target[2] + c * Math.sin(yaw)], target, fov: lerp(a.fov, b.fov, k), roll: lerp(a.roll, b.roll, k)};
}

const camera = ({t, world}: SceneProps): CameraPose => crane(t, followRig(world, RIGS.grandCauseway, t), TOP_POSE(t));

const Homecoming = (p: SceneProps) => {
  const {t, light, world} = p;
  const k = move(CRANE[0], CRANE[1], t), fade = 1 - ss(RELEASE[0], RELEASE[1], t), swell = 1 - ss(82.35, 83, t), reveal = ss(83.2, 84.5, t);
  // Fog that fits the low causeway view thins to almost nothing at the top, so the whole crest reads crisp.
  const density = lerp(.014, .0012, k), fog = {density, color: mixRGB(tone('ink'), scaleRGB(tone('amber'), .08), .5 * world.horizon.glow)};
  return <>
    <fogExp2 attach="fog" args={[0, density]} color={fog.color} density={density}/>
    <Backdrop light={light} glow={(.1 + .45 * world.horizon.glow) * fade} center={camera(p).position} tint={world.horizon.tint} shadow={world.shadow.sky}/>
    {/* The cooled route history lifts a little as the crane rises (more would also lift the wide wake bands and blur the outline). */}
    {/* As the crane tops out the route cells glow, so the outline reads as the crest before the lock relights it (f5080). */}
    <Plain t={t} light={light} world={world} residue={1 + .4 * k} fog={fog} swellGain={swell} dim={fade} outline={reveal}/>
    {/* Everything but Wick fades to ink on the release: one ember survives. The resting band dims under the reveal. */}
    <Walkers t={t} world={world} max={2048} light={light} fog={fog} swellGain={swell} dim={fade * (1 - .6 * reveal)}/>
    <GhostLantern world={world} light={light} dim={fade}/>
    <Answer world={world} light={light} dim={fade}/>
    <HeraldBeams world={world} dim={fade}/>
    <LoopRing world={world} dim={fade}/>
    <Wick world={world} light={light}/>
  </>;
};

export const homecoming: SceneDef = {Component: Homecoming, camera};
