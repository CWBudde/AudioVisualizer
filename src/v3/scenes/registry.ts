import type {FC} from 'react';
import type {CameraPose, SceneProps} from '../engine/frame';
import {drift} from './Drift';
import {homecoming} from './Homecoming';
import {interlocking} from './Interlocking';
import {memoryPlain, sleepingPlain} from './PlainSolo';
import {firstParade, grandParade} from './Procession';
import {tunnel} from './Tunnel';

/** A scene: what to draw (rendered into its own layer) and where its camera is, both pure functions of SceneProps. */
export type SceneDef = {Component: FC<SceneProps>; camera: (p: SceneProps) => CameraPose};
// Add a scene: scenes/<Name>.tsx exporting a SceneDef, one line here, then use its id in ../timeline.ts.
export const SCENES = {
  'sleeping-plain': sleepingPlain,
  'first-parade': firstParade,
  'interlocking': interlocking,
  'drift': drift,
  'tunnel': tunnel,
  'memory-plain': memoryPlain,
  'grand-parade': grandParade,
  'homecoming': homecoming,
} satisfies Record<string, SceneDef>;
export type SceneId = keyof typeof SCENES;
