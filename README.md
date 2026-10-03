# PixelParade

A deterministic Remotion music visualizer, driven by locally separated stems and Go audio analysis. Every version renders the full track at 1080×1080 and 60 fps.

| Version | Composition | Source | Look |
|---|---|---|---|
| v1 | `PixelParade-v1` | `src/v1/` | SVG/Canvas neon geometric parade |
| v2 | `PixelParade-v2` | `src/v2/` | WebGL shader worlds with a melody ribbon, driven by per-cue shot presets |
| v3 | `PixelParade-v3` | `src/v3/` | **WICK**, a narrative music video in React Three Fiber: a pixel flame lights a sleeping plain, and the tiles rise and follow it |

Shared analysis loading, audio controls and types live in `src/shared/`. Outputs and reports are per version: `out/<version>/` and `analysis/<version>/`. The current master is v3, [out/v3/PixelParade-v3.mp4](out/v3/PixelParade-v3.mp4); its export and A/V sync checks are in [analysis/v3/render-validation.json](analysis/v3/render-validation.json). The v1 checks are in [analysis/v1/render-validation.json](analysis/v1/render-validation.json).

## v3: WICK

The story is built on a deeper analysis of the song. `bun run story` (`cmd/story`) estimates the key, chords, phrase structure and recurring motifs (leitmotifs), and writes `analysis/story.md`, the self-similarity images and `analysis/PixelParade.mid` (lead, arp, bass, chords, drums and motif marker lanes) for listening alongside the WAV in a DAW. The compact `public/analysis/story.json` drives v3. The creative documents are in `docs/v3/`: the musical reading, three concept treatments, and the production script that the scenes implement.

v3 renders a timeline of scenes (`src/v3/timeline.ts`) through a compositor that blends two scenes with dissolve, burn, light-wash or iris transitions. A persistent crest glyph (the arp motif) stays above every transition. The world (route, tiles, 2048 walkers) is a pure function of song time in `src/v3/world/`.

## Run

```sh
rtk proxy bun install --frozen-lockfile
rtk proxy bun run studio
rtk proxy bun run validate
rtk proxy bun run validate:all
rtk proxy bun run render:stills
rtk proxy bun run render:preview
rtk proxy bun run render
rtk proxy sh scripts/go.sh run ./cmd/verifyrender
```

`PP_VERSION` (`v1`, `v2` or `v3`, default `v3`) selects the version for every step, for example `PP_VERSION=v1 bun run render`. The render scripts compile their TypeScript orchestration with Bun and execute the Remotion renderer with Node. Outputs go into `out/<version>/`: `PixelParade-<version>.mp4`, four preview clips, and captured scene frames. `render:stills 540 1200` renders only the given frames for quick look-dev. The studio uses the original WAV and the exported compact controls; it does not require stem playback.

The master renders in nine resumable sections under `out/<version>/segments/`. A fingerprint over the shared and version-specific sources, data and settings prevents mixing sections from different code. Re-running `bun run render` verifies and reuses completed sections. Assembly copies the video streams and encodes the complete original WAV once. The render command then runs the Go output verifier automatically.

All renders use Remotion's managed headless browser (`ensureBrowser`) with ANGLE for WebGL. Set `PP_BROWSER` to a Chrome headless shell binary to override it. `bun run preflight` checks headless WebGL2 capture.

## Analysis and verification

`PLAN.md` records the source measurements, storyboard, controls, separation setup, and production decisions. `bun run analyze` reruns the Go analyzer and compact exporter; existing stems are required. The full inspection timeline is `analysis/overview.html`.

`bun run validate` verifies the soundtrack hash, schema, exact Go-exported controls and pause/event timing, plus version checks (v1: deterministic poses, safe geometry bounds, particle limits; v2: deterministic, finite shader uniforms; v3: timeline coverage, route and walker continuity, tile events, camera sanity, determinism and no wall-clock APIs). Actual frame capture hashes are recorded in `analysis/<version>/frame-determinism.json` by `render:stills`. `cmd/verifyrender` checks the master format and fast start, decodes the complete video, and compares the encoded soundtrack to the original at the beginning, middle, end, and tail.

In every version, each frame is a pure function of frame time and recorded features. There is no browser FFT or accumulated animation state. Only the original WAV is heard.
