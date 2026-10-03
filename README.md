# PixelParade

A music video for the instrumental track "PixelParade" (86 s, 105 BPM, G major), built with [Remotion](https://www.remotion.dev/) from Go audio analysis of the song and its separated stems. Every frame is a pure function of song time and the recorded features: there is no browser FFT and no accumulated animation state.

**Watch it running live in your browser: [see here](https://cwbudde.github.io/PixelParade/).**

## Versions

| Version | Composition | Source | What it is |
|---|---|---|---|
| **v3** (default) | `PixelParade-v3` | `src/v3/` | **WICK**, a narrative music video in React Three Fiber. A pixel flame crosses a sleeping plain of dark tiles; every note lights a tile, the lit tiles rise and follow, and in the last bars the route they walked turns out to spell the melody's own shape. |
| v2 | `PixelParade-v2` | `src/v2/` | Raw WebGL2 shader worlds with a melody ribbon, switched by per-cue shot presets. |
| v1 | `PixelParade-v1` | `src/v1/` | SVG/Canvas neon geometric parade. |

All versions render the full track at 1080×1080 and 60 fps (5168 frames). Shared analysis loading, audio controls and types live in `src/shared/`. Outputs and reports are kept per version in `out/<version>/` and `analysis/<version>/`.

## Quick start

```sh
bun install --frozen-lockfile
bun run studio            # Remotion Studio with all three compositions
bun run web               # the browser player (the same one deployed to GitHub Pages)
```

`PP_VERSION` (`v1`, `v2` or `v3`, default `v3`) selects the version for every validation and render step, for example `PP_VERSION=v1 bun run render:stills`.

| Command | What it does |
|---|---|
| `bun run validate` / `validate:all` | Checks the soundtrack hash, the exported controls, event timing and the version's own invariants (one version / all three). |
| `bun run render:stills [frames…]` | Renders the review stills (or just the given frames) to `out/<version>/stills/`, re-renders some frames out of order to prove the capture is deterministic, and fails on blank frames. |
| `bun run render:preview` | Renders four preview clips to `out/<version>/previews/`. |
| `bun run render` | Renders the master `out/<version>/PixelParade-<version>.mp4` in nine resumable sections, muxes the original WAV once and runs the Go verifier. |
| `bun run preflight` | Checks headless WebGL2 and React Three Fiber capture. |
| `bun run web:build` | Builds the browser player into `dist/web/`. |

The render scripts compile their orchestration with Bun and run the Remotion renderer under Node, using Remotion's managed headless browser with ANGLE for WebGL (set `PP_BROWSER` to override the binary). A fingerprint over the shared and version-specific sources, data and settings stops sections from different code being mixed; re-running `bun run render` reuses finished sections. Concurrent look-dev runs can isolate their bundle and stills with `PP_WORKSPACE=<name>`.

## Analysis pipeline (Go)

| Command | Output |
|---|---|
| `bun run analyze` | `cmd/analyze` measures the mix and the Demucs stems (`scripts/separate.py`): tempo and beat grid, onsets with kick/snare/hat labels, band energies, the melody of the `other` stem, sections and silences → `analysis/features.json`, `analysis/report.md`, the interactive `analysis/overview.html`. `cmd/controls` exports the compact `public/analysis/controls.json` that all versions read. |
| `bun run story` | `cmd/story` builds the musical skeleton for v3: bass line, cleaned melody, key (G major), chords per half bar, phrase structure from self-similarity, and recurring motifs (leitmotifs) with their transposed returns → `analysis/story.md`, `analysis/story-ssm-*.png`, `public/analysis/story.json`, and **`analysis/PixelParade.mid`** (lead, arpeggio, bass, chords, drums and motif marker lanes) to load next to the WAV in a DAW. |
| `bun run verify:render` | `cmd/verifyrender` checks the master's format and fast start, decodes it completely, and compares the encoded soundtrack with the original at the beginning, middle, end and tail. |

`PLAN.md` documents the source measurements and the v1 production.

## How v3 is made

The story was developed from the analysis rather than written first. The documents are in `docs/v3/`:

1. `music-reading.md`: the instrument cast, a bar map, recurrences, the key moments and how the music crosses each boundary.
2. `concepts/`: three competing treatments (WICK, Ember Bell, Upwelling).
3. `script.md`: the production script of the chosen treatment, which the code implements.

In code, `src/v3/timeline.ts` lists the scenes keyed to cues and bars. A compositor renders up to two scenes into their own HDR targets and blends them with a dissolve, burn, light-wash or iris transition, so there are no hard cuts. The crest glyph (the arpeggio motif) is drawn above every transition. The world in `src/v3/world/` is a pure function of song time: a route traced from the motif's contour, 25,600 tiles and 2,048 walkers. `PP_VERSION=v3 bun run validate` checks timeline coverage, route and walker continuity, tile events, camera sanity, determinism and the absence of wall-clock APIs.

## Browser player and GitHub Pages

`web/` contains a small Vite app that plays the three compositions live with `@remotion/player`, together with the original soundtrack. `.github/workflows/pages.yml` builds it on every push to `main` that touches the app or its data and deploys it to GitHub Pages. The repository's Pages source must be set to *GitHub Actions*. Playback runs in real time on the viewer's GPU, so v2 and v3 need WebGL2. Output can differ slightly from the deterministic offline render.
