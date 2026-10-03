// Public API of the shared world (docs/v3/script.md §6.1). Element components live in ./<Name>.tsx and are imported directly.
export type {Frame3, Occ, Rig, WalkerLook, WalkerTable, World, WorldFrame} from './types';
export {DEG, L, U, W, causewayY, routeFrame, routePoint} from './route';
export {FREEZES, heldTime, wickArc} from './clock';
export {buildWorld} from './build';
export {WICK_H, WICK_W, worldAt} from './frame';
export {posesAt} from './poses';
export {RIGS, TOP_POSE, blendPose, followRig} from './rigs';
export {WorldContext, useWorld} from './context';
// Extras beyond §6.1 (helpers the scenes may use).
export type {RigName} from './rigs';
export {VERTICES, routeCrisp} from './route';
export {camArc, isFrozen} from './clock';
export {POSE, WALKERS} from './poses';
export {move} from './rigs';
// WP1 additions: a single walker's pose, the walker story's key times, non-allocating route frame, causeway step heights,
// the tile event report (for validation) and its kinds/cell helpers.
export {walkerPose, WT, REST_LIGHT} from './poses';
export {routeFrameInto, causewaySteps} from './route';
export {tileReport, EVENT, cellOf, TILES} from './tiles';
export type {TileReport, TileSource} from './tiles';
