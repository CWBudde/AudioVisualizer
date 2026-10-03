import {createContext, useContext} from 'react';
import type {World} from './types';

/** The static World of the current story; the Compositor provides it to every layer portal. */
export const WorldContext = createContext<World | null>(null);
export function useWorld(): World {
  const w = useContext(WorldContext);
  if (!w) throw new Error('useWorld outside WorldContext.Provider');
  return w;
}
