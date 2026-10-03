import {DEFAULT_VERSION, VERSIONS} from '../src/versions';
import type {Version} from '../src/versions';

// PP_VERSION selects the visualizer for every step of a chained package script.
export function versionFromEnv(env = process.env.PP_VERSION): Version {
  const v = env || DEFAULT_VERSION;
  if (!(VERSIONS as readonly string[]).includes(v)) throw new Error(`PP_VERSION must be one of ${VERSIONS.join(', ')}`);
  return v as Version;
}
export const pathsFor = (v: Version) => ({
  out: `out/${v}`, master: `out/${v}/PixelParade-${v}.mp4`, previews: `out/${v}/previews`, stills: `out/${v}/stills`,
  segments: `out/${v}/segments`, analysis: `analysis/${v}`,
  manifest: `.cache/master-render-${v}.json`, masterBundle: `.cache/master-bundle-${v}`,
});
