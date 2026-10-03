import {useWorld} from './context';
import type {WalkerLook, WorldFrame} from './types';

/** look 'ember' draws heads only as glyph sprites (drift); max caps drawn instances (200 before 54.9, 2048 after). */
export type WalkersProps = {t: number; world: WorldFrame; look?: WalkerLook; max?: number; light: number};

/**
 * STUB (Phase 0): draws nothing (posesAt is a stub with every walker at stand 0).
 * WP1 replaces it with one instanced system fed by posesAt(useWorld(), t) in useLayoutEffect (§2.5).
 */
export const Walkers = (_: WalkersProps) => {
  useWorld();
  return null;
};
