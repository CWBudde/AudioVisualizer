// Public API of the shared world (docs/v3/script.md §6.1). Element components live in ./<Name>.tsx and are imported directly.
export type {Frame3, Occ, Rig, WalkerLook, WalkerTable, World, WorldFrame} from './types';
export {DEG, L, U, W, causewayY, routeFrame, routePoint} from './route';
export {FREEZES, heldTime, wickArc} from './clock';
export {buildWorld} from './build';
export {worldAt} from './frame';
export {posesAt} from './poses';
export {RIGS, TOP_POSE, blendPose, followRig} from './rigs';
export {WorldContext, useWorld} from './context';
// Extras beyond §6.1 (helpers the scenes may use).
export type {RigName} from './rigs';
export {VERTICES, routeCrisp} from './route';
export {camArc, isFrozen} from './clock';
export {POSE, WALKERS} from './poses';
export {move} from './rigs';
