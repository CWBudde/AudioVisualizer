# PixelParade

A deterministic Remotion music visualizer, driven by locally separated stems and Go audio analysis. Every version renders the full track at 1080×1080 and 60 fps.

| Version | Composition | Source | Look |
|---|---|---|---|
| v1 | `PixelParade-v1` | `src/v1/` | SVG/Canvas neon geometric parade |
| v2 | `PixelParade-v2` | `src/v2/` | WebGL shader worlds with a melody ribbon, driven by per-cue shot presets |

Shared analysis loading, audio controls and types live in `src/shared/`. Outputs and reports are per version: `out/<version>/` and `analysis/<version>/`. The v1 master is [out/v1/PixelParade-v1.mp4](out/v1/PixelParade-v1.mp4); its export checks are in [analysis/v1/render-validation.json](analysis/v1/render-validation.json).

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

`PP_VERSION` (`v1` or `v2`, default `v2`) selects the version for every step, for example `PP_VERSION=v1 bun run render`. The render scripts compile their TypeScript orchestration with Bun and execute the Remotion renderer with Node. Outputs go into `out/<version>/`: `PixelParade-<version>.mp4`, four preview clips, and captured scene frames. `render:stills 540 1200` renders only the given frames for quick look-dev. The studio uses the original WAV and the exported compact controls; it does not require stem playback.

The master renders in nine resumable sections under `out/<version>/segments/`. A fingerprint over the shared and version-specific sources, data and settings prevents mixing sections from different code. Re-running `bun run render` verifies and reuses completed sections. Assembly copies the video streams and encodes the complete original WAV once. The render command then runs the Go output verifier automatically.

All renders use Remotion's managed headless browser (`ensureBrowser`) with ANGLE for WebGL. Set `PP_BROWSER` to a Chrome headless shell binary to override it. `bun run preflight` checks headless WebGL2 capture.

## Analysis and verification

`PLAN.md` records the source measurements, storyboard, controls, separation setup, and production decisions. `bun run analyze` reruns the Go analyzer and compact exporter; existing stems are required. The full inspection timeline is `analysis/overview.html`.

`bun run validate` verifies the soundtrack hash, schema, exact Go-exported controls and pause/event timing, plus version checks (v1: deterministic poses, safe geometry bounds, particle limits; v2: deterministic, finite shader uniforms). Actual frame capture hashes are recorded in `analysis/<version>/frame-determinism.json` by `render:stills`. `cmd/verifyrender` checks the master format and fast start, decodes the complete video, and compares the encoded soundtrack to the original at the beginning, middle, end, and tail.

In every version, each frame is a pure function of frame time and recorded features. There is no browser FFT or accumulated animation state. Only the original WAV is heard.
