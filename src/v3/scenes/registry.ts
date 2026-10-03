import type {FC} from 'react';
import type {CameraPose, SceneProps} from '../engine/frame';
import {bloom} from './Bloom';
import {emberField} from './EmberField';
import {tunnel} from './Tunnel';
import {voidScene} from './Void';

/** A scene: what to draw (rendered into its own layer) and where its camera is, both pure functions of SceneProps. */
export type SceneDef = {Component: FC<SceneProps>; camera: (p: SceneProps) => CameraPose};
// Add a scene: scenes/<Name>.tsx exporting a SceneDef, one line here, then use its id in ../timeline.ts.
export const SCENES = {
  'void': voidScene,
  'ember-field': emberField,
  'tunnel': tunnel,
  'bloom': bloom,
} satisfies Record<string, SceneDef>;
export type SceneId = keyof typeof SCENES;
