// Plain constants shared by the Remotion root and the node scripts; keep this free of JSON and React imports.
export const VERSIONS = ['v1', 'v2', 'v3'] as const;
export type Version = typeof VERSIONS[number];
export const DEFAULT_VERSION: Version = 'v3';
export const compositionId = (v: Version) => `PixelParade-${v}`;
// validate asserts FRAMES === ceil(source duration * FPS).
export const FPS = 60, SIZE = 1080, FRAMES = 5168;
