# PixelParade — music visualizer production plan

Completed 2026-10-03. **Preparation, Remotion implementation, previews, full MP4 rendering, and final verification are complete.**

## 1. Deliverable and creative direction

Create a full-track **1080×1080, 60 fps MP4** using Remotion motion design. The chosen direction is a **neon geometric parade with no text**: luminous diamonds, squares, rings, and ribbons assemble, travel through depth, disperse during breakdowns, and return in a fuller finale. The source soundtrack stays at its original timing and gain.

The initial preparation milestone ended with copied audio, local stems, reproducible Go analysis, and this plan. The subsequent continuation implements the Remotion composition and renders the MP4.

### Completed artifacts

- Full master: [`out/PixelParade.mp4`](out/PixelParade.mp4), 1080×1080 at 60 fps, all 5168 frames, H.264 `yuv420p` / BT.709 and stereo AAC.
- Four representative clips in `out/previews/`; reviewed scene contact sheet: [`out/storyboard.jpg`](out/storyboard.jpg).
- Final export/audio/timestamp checks: [`analysis/render-validation.json`](analysis/render-validation.json), stream probe: [`analysis/render-probe.json`](analysis/render-probe.json), and resumable render provenance: [`analysis/render-production.json`](analysis/render-production.json).
- Original soundtrack: [`public/audio/PixelParade.wav`](public/audio/PixelParade.wav).
- Four float32 stereo stems: `analysis/stems/htdemucs/PixelParade/{drums,bass,other,vocals}.wav`.
- Full 100 Hz analysis and cue data: [`analysis/features.json`](analysis/features.json).
- Per-track/per-section measurements: [`analysis/sections.csv`](analysis/sections.csv).
- Readable measurement report: [`analysis/report.md`](analysis/report.md).
- Interactive timeline with mix/stem audition, seeking, band envelopes, and a spectrogram: [`analysis/overview.html`](analysis/overview.html).
- Standalone plot, visually inspected: [`analysis/overview.png`](analysis/overview.png).
- Separation provenance, checkpoint hashes, and dependency versions: [`analysis/separation.json`](analysis/separation.json).
- Source/stem FFprobe records and FFmpeg loudness measurements: `analysis/*-probe.json`, `analysis/*-loudness.json`, and [`analysis/mix-ebur128.txt`](analysis/mix-ebur128.txt).

The Go analyzer and separation scripts are implemented. Python is used for pretrained separation and plotting already computed features; signal analysis is written in Go.

## 2. What the audio establishes

### Source and rhythm

| Property | Measured value |
|---|---|
| Original file | `/home/cwbudde/Downloads/PixelParade.wav` |
| SHA-256 of original and project copy | `20a7f80e5de0e2052071fcba6a838249437d60deb42991b42ed03f1cd955066d` |
| Duration | 86.120 seconds |
| Container/audio | WAV, stereo, 48 kHz, 16-bit PCM |
| Whole-file stereo RMS | −18.47 dBFS |
| EBU R128 integrated loudness | −16.3 LUFS |
| EBU R128 loudness range | 4.4 LU |
| EBU R128 true peak | −2.9 dBFS |
| Refined drum-based tempo | 105.000 BPM |
| Fitted quarter-note grid origin | 0.038 seconds |
| Quarter-note interval | 0.571429 seconds |
| Sixteenth-note interval | 0.142857 seconds |
| Four-bar phrase under 4/4 | 9.142857 seconds |
| First near-silent gap | 8.746250–9.168500 seconds |
| Second near-silent gap | 18.049875–18.310792 seconds |

Tempo is supported by broad drum novelty comparisons: 105 BPM scores 0.6218, versus 70 BPM at 0.4582 and 140 BPM at 0.3676. The initial 105 BPM hypothesis came from mix analysis; the analyzer records that prior explicitly and reports alternatives. The median drum-onset distance from the fitted sixteenth-note grid is 8.00 ms. This measures grid fit, not independently verified onset accuracy.

Use the beat grid for continuous motion. Use actual detected events and measured gaps for impacts and pauses. The repeating arrangement supports a 4/4 interpretation, but a bar's exact downbeat index is unverified; authored section cues take precedence over inferred bar numbering.

The separate `loudnorm` measurements report −16.44 LUFS and 4.90 LU for the mix. Their analysis settings differ from the EBU R128 pass; use the EBU results above as the descriptive reference. Neither measurement pass changed the soundtrack.

### Stem assessment

| Stem | Rate / format | Duration | RMS | Relative to mix | Detected events |
|---|---|---:|---:|---:|---:|
| Drums | 44.1 kHz stereo float32 | 86.120 s | −23.62 dBFS | −5.15 dB | 233 |
| Bass | 44.1 kHz stereo float32 | 86.120 s | −24.27 dBFS | −5.80 dB | 224 |
| Other | 44.1 kHz stereo float32 | 86.120 s | −22.95 dBFS | −4.48 dB | 432 |
| Vocals | 44.1 kHz stereo float32 | 86.120 s | −43.43 dBFS | −24.96 dB | 56 |

- The aligned stem sum correlates with the mono reference at **0.99876979**. Best cross-correlation lag is **0.000 ms**, duration difference is **0.000 ms**, and residual RMS is **−44.69 dBFS**.
- Reconstruction checks establish timing and overall consistency, not perfect source isolation.
- The opening is mostly represented in the “other” stem. Drums and bass become substantially stronger around the first entrance.
- Drums nearly disappear in the 36.6–44.4 second breakdown; “other” becomes the main visual driver. Bass has short activity within the breakdown, so its motion should remain available at reduced strength.
- The vocal output has localized activity around the middle of the track and is very quiet overall. Treat it as possible harmonic/synth leakage; it gets no independent vocal character or lyric treatment.
- No key, lyrics, precise genre, or specific synthesizer identity is asserted. Perceptual audition remains available through the inspection page; the findings here are measured rather than a claimed listening review.

## 3. Final storyboard and choreography

These scene boundaries are the authored production cues already stored in the JSON. Gap edges are measured at −45 dBFS with a minimum 150 ms duration. Other boundaries are rounded energy-change cues; use their specified times for implementation.

| Scene | Time in seconds | Musical evidence | Motion design |
|---|---:|---|---|
| Assembly | 0–8.746250 | Light opening; mix low-band share about 10%; bass/drum pickup before the pause | Begin with 12 geometric tokens. Grow to 24, assemble into two offset orbits, and introduce depth with a slow forward drift. Add the pickup's impact rings without giving the opening the finale's density. |
| First pause | 8.746250–9.168500 | Measured near-silence | Contract existing tokens toward a central diamond, stop emission, and extinguish trails. Preserve a dim silhouette. |
| First parade | 9.168500–18.049875 | Strong low-frequency entrance; mix low-band share about 56% | Release the diamond outward into 48 tokens arranged in four traveling ranks. Introduce the central bass structure and drum-triggered expanding rings. |
| Second pause | 18.049875–18.310792 | Measured near-silence | Briefly arrest travel, compress the ranks, and rotate the formation's frame by 45 degrees on the return. |
| Interlocking parade | 18.310792–36.6 | Sustained bass-heavy passage; low-band share about 57% | Interlock two counter-rotating formations with three ribbons. Change from diagonal ranks to nested diamond orbits near 27.43 s using a formation morph. |
| Open breakdown | 36.6–44.4 | Low-band share falls to about 8%; drum RMS drops markedly | Reduce to 24 tokens, open negative space, loosen symmetry, and slow depth travel. Let the “other” envelope control orbital deformation. Preserve quiet bass/fill accents. |
| Tunnel return | 44.4–54.9 | Bass pickup followed by resumed energy; low-band share about 50% | Pull tokens into a perspective tunnel, then establish 48 tokens in layered rotating rings. Use the 45.7 s phrase accent as a strong formation lock. |
| Suspended breakdown | 54.9–64.0 | Bass/drum withdrawal and a quiet lead-in | Dissolve into 24 suspended fragments. Gradually reduce travel and bring fragments inward after 62.3 s; accent local fills rather than firing a constant beat pulse. |
| Finale | 64.0–82.3 | Abrupt full return; strongest sustained mix section | Reassemble into 80 tokens, combine traveling ranks and orbits, use five ribbons, and allow the fullest particle accents. Change formation near 73.14 s while preserving the central motif. |
| Settle | 82.3–86.12 | Centroid falls to about 819 Hz; 2–12 kHz energy collapses | Remove sparks and trails immediately with the spectral change. Settle to a small harmonic formation, then fade it to black over the final 1.2 seconds. Preserve the complete audio tail. |

### Palette and composition

- Background: near-black navy `#060814` with a restrained radial gradient.
- Main colors: electric cyan `#36E5FF`, hot pink `#FF3DA8`, violet `#8658FF`.
- Accent: acid yellow `#E9FF70`, reserved for strong drum accents and finale highlights.
- Keep the central formation inside a 108 px inset; peripheral trails may leave the canvas.
- Central motif: one diamond/ring structure around `(540, 540)`, supported by orbiting squares and diamonds. Shape identities persist through transitions.
- Use outlined luminous geometry with occasional solid cores, two bounded glow layers, and a subtle deterministic background texture. No titles, labels, logos, captions, UI, or spectrum axes appear in the video.

### Audio-to-motion controls

Read the JSON's 100 Hz arrays with linear interpolation at `t = frame / 60`. Clamp array access at the beginning and end. All artistic mappings use these offline features; there is no per-frame browser FFT.

| Control | Source | Mapping |
|---|---|---|
| Central scale | `bass.bandControls[0]` | Base scale multiplied by `1 + 0.16 × bass`; double the modulation ceiling only for the finale. |
| Impact strength | `drums.onsets` | `strength × exp(−age / 0.12)` for event ages 0–0.6 s; take the maximum active response. |
| Impact rings | Drum event times | Start at radius 32 px, expand toward 352 px over 0.5 s, and fade out. Limit to four simultaneous rings. |
| Ribbon thickness | Bass energy | 3–14 px, scaled by the scene's energy ceiling. |
| Harmonic deformation | `other.bandControls[2]` | Add up to 18 px of smooth orbit/ribbon deformation, with sinusoidal musical-phase motion. |
| Color balance | `other.centroidHz` | Map a clamped 1500–4500 Hz range between violet and cyan/pink; smooth over 150 ms. |
| Sparks | Drum high/air activity | Spawn up to 12 seeded particles per qualified drum event; lifetime 0.45 s, maximum 240 active particles. |
| Lateral spread | `mix.stereoWidth` | Smooth over 150 ms and map the measured 0–0.12 range to a bounded ±8% change in spread. |
| Scene energy | Mix energy and cue | Set density/glow/travel ceilings from the cue; preserve the breakdown reduction even when normalized harmonic controls are high. |
| Continuous travel | Fitted musical phase | `beatPosition = (t − 0.038) / (60 / 105)`; use fractional phase for movement, not automatic impacts on absent drums. |

Normalization is per track using the 95th percentile of active samples, with a −80 dBFS gate, 10 ms attack, and 120 ms band/150 ms energy release. Because stems normalize independently, their controls indicate within-stem activity, not relative loudness. Scene ceilings enforce musical contrast.

Use beat-duration morphs for ordinary scene changes: 0.571429 s with cubic ease-in/out. The measured short pauses use their actual durations. At 64 s, complete a fast 0.142857 s outward release. Avoid repeated full-frame brightness flashes; make accents through geometry, color, and depth.

## 4. Implemented analysis pipeline and reproducibility

### Commands

Run from the project root. Prefix shell commands with `rtk` per the user's RTK instructions.

```sh
# The local environment and stems are already present.
rtk proxy .venv/bin/python scripts/separate.py
rtk proxy sh scripts/go.sh run ./cmd/analyze
rtk proxy env MPLCONFIGDIR="$PWD/.cache/matplotlib" .venv/bin/python scripts/plot_analysis.py
rtk proxy sh scripts/go.sh test ./...
rtk proxy sh scripts/go.sh vet ./...
```

`scripts/go.sh` keeps Go build/module caches in `.cache/`. Go dependencies are locked in `go.mod`/`go.sum`; sibling modules use local replacements. The shared module cache was copied into the project cache to work around direct Go network restrictions. Python's virtual environment installs separation dependencies locally and reuses the existing CPU PyTorch runtime through `--system-site-packages`; this avoids another large torch download. Exact critical Python versions are recorded in `scripts/requirements-stems.txt` and the separation manifest.

For reconstruction on another machine:

```sh
rtk proxy python3 -m venv --system-site-packages .venv
rtk proxy env PIP_CACHE_DIR="$PWD/.cache/pip" .venv/bin/python -m pip install -r scripts/requirements-stems.txt
rtk mkdir -p .cache/models
rtk cp .venv/lib/python3.12/site-packages/demucs/remote/htdemucs.yaml .cache/models/htdemucs.yaml
rtk proxy curl -fL https://dl.fbaipublicfiles.com/demucs/hybrid_transformer/955717e8-8726e21a.th -o .cache/models/955717e8-8726e21a.th
rtk proxy .venv/bin/python scripts/separate.py
```

Checkpoint SHA-256: `8726e21a993978c7ba086d3872e7608d7d5bfca646ca4aca459ffda844faa8b4`. The model loader validates its filename checksum; the separation manifest also records the full hash and configuration hash. Inference used Demucs 4.1.0, `htdemucs`, CPU, four CPU threads, seed 42, one shift, float32 output, and `--clip-mode none`. It completed in 126.7 seconds. No individual stem was rescaled or clipped; FFmpeg's measured stem peaks are below full scale.

### Processing details

- WAV decoding uses `../wav`, with buffered reads and correct relative-seek handling.
- Resampling uses `algo-dsp`'s best-quality polyphase FIR, tail flushing, and fractional group-delay compensation. Target rate is 24 kHz for every track.
- STFT: periodic Hann, 2048 samples, 240-sample hops, centered windows with zero padding at track edges. Feature sample `i` is at exactly `i × 0.01` seconds.
- Stereo spectral power is averaged across channels, preserving energy in anti-phase material.
- Bands: 25–140, 140–400, 400–2000, 2000–6000, and 6000–12000 Hz. Centroid comes from `algo-dsp`; FFT plans come from `algo-fft`.
- RMS/peak use a centered 20 ms window. Positive log-spectral flux and adaptive novelty detect candidates; causal 5 ms energy rises refine event times. A 75 ms exclusion interval prevents duplicate events.
- The spectrogram is frame-major with 64 logarithmic bins, in dBFS. Low-frequency FFT resolution is 11.71875 Hz; empty logarithmic display bins are expected.
- Section statistics exclude a 42.7 ms edge margin so neighboring kicks do not contaminate short quiet intervals. Onset counts include the whole section.
- `-mix-only` is an explicit preliminary-analysis option; the default requires all four stems and validates their duration and alignment.

### Interfaces for the Remotion consumer

Mirror the Go JSON contract into TypeScript as `TrackAnalysis`, `AudioControls`, `Rhythm`, `SectionCue`, and `TrackSource`. Preserve units from the JSON: seconds, Hz, linear amplitudes, dBFS, and normalized 0–1 controls.

The public playback control should be one pure function, `getAudioControls(analysis, timeSeconds)`, returning bass, harmonic energy, high-frequency energy, stereo spread, drum impact, musical phase, and the active cue. Add pure formation/particle functions receiving frame/time, controls, cue, and the fixed seed 42.

The full analysis JSON is about 24 MB because it includes five spectrograms. Before bundling Remotion, derive a compact `public/analysis/controls.json` in Go: retain source hashes/duration, rhythm, cues, control arrays, centroids/width, and required events; omit diagnostic spectrograms and redundant raw arrays. Derivation must not change timing or normalization. Missing/mismatched source hashes or unsupported schema versions must fail rendering rather than silently substituting animation.

### Recorded sibling revisions

| Module | Revision |
|---|---|
| algo-dsp | `a535a2b60ff1251aff0a7de18f978471f107055f` |
| algo-fft | `fb129b5593c2fe4030a433f28516b966f178bc2f` |
| algo-vecmath | `fe23ecf5372d057c3811509c287a3e82337399a9` |
| algo-approx | `8c522aad56f46ff1a92b77c99e0277299728000c` |
| wav | `9636fd1c728aa3eaf9463b025d967650c1372bd9` |

Go runtime: 1.26.1. The four algorithm repositories are clean. `wav` has existing changes in `.golangci.toml` and `cmd/wavtagger/main.go`; these are outside the imported decoder package and were left untouched. The runtime provenance records that dirty state.

## 5. Implemented Remotion build and render

The source is in `src/`: pure controls and choreography, SVG background/formations/ribbons/impact rings/core, Canvas sparks, and the registered `PixelParadeSquare` composition. `cmd/controls` exports the compact 3.0 MB public timeline without changing measured values. Bun dependencies are pinned and locked in `bun.lock`; orchestration scripts are compiled by Bun and executed with Node.

The Linux browser preflight passed with Remotion's Chrome Headless Shell 149.0.7790.0 downloaded from its official distribution. The previous native Chrome sandbox failure is resolved for this renderer. Rendering uses two workers, H.264 CRF 18 with the `fast` x264 preset, explicit BT.709 limited range, stereo AAC at 320 kbps, and a lossless fast-start remux. The `fast` preset reduces software encoding cost on the busy host. Initial previews use full-range YUV; the master explicitly corrects that to `yuv420p` with BT.709.

Twenty scene frames were captured at full resolution and reviewed in `out/storyboard.jpg`. Three actual captured PNGs matched SHA-256 hashes when re-rendered in a different order; see `analysis/frame-determinism.json`. All 233 drum events respond by the first frame after their timestamps (maximum delay 16.67 ms); both measured pauses suppress impacts and sparks. Geometry bounds, particle limits, schema/source identity, exact exported controls, and pure seek behavior pass `scripts/validate.ts` and are recorded in `analysis/visual-validation.json`.

The four full-resolution previews are in `out/previews/`: `01-opening.mp4`, `02-breakdown-return.mp4`, `03-finale-entrance.mp4`, and `04-ending.mp4`. Their dimensions, frame counts, frame rates, and audio formats pass `scripts/inspect-previews.ts`; the probe records are in `analysis/preview-validation.json`. Encoded opening, breakdown, finale, and ending frames were visually inspected. One interrupted preview job was resumed; all four clips completed successfully.

Long render jobs were externally terminated in this environment, including a single master job at about 59%. Production now uses `scripts/render-master.ts`: nine 600-frame sections (the last has 368 frames), each saved and format-checked separately. A fingerprint covers source code, soundtrack, controls, locked dependencies, and render settings; a resumed job reuses only matching completed sections. Assembly copies video streams without another encode and encodes the complete original WAV to AAC once. Final verification checks all 5168 frames and waveform alignment across the joined file.

Production commands:

```sh
rtk proxy bun run typecheck
rtk proxy bun run validate
rtk proxy bun run render:stills
rtk proxy bun run render:preview
rtk proxy bun run render
rtk proxy sh scripts/go.sh run ./cmd/verifyrender
```

`cmd/verifyrender` checks the master stream format, 5168 frames, fast-start MP4 boxes, complete decode, audio duration, and beginning/middle/end/tail waveform correlation, gain, and lag against the original WAV. It writes `analysis/render-probe.json` and `analysis/render-validation.json`.

The completed master passed every export check. All 5168 decoded frame timestamps agree with `frame / 60` within 0.000334 ms, including section joins. Beginning, middle, end, and tail audio comparisons each detect **0.000 ms lag**, with correlations **0.999842–0.999982**. Whole-file RMS differs by **−0.014851 dB** after AAC encoding. Decoded AAC lasts 86.122667 seconds, including 2.667 ms of codec padding; the original's complete 86.120-second tail is present. Waveform comparisons use the Go loader's aligned 24 kHz channel data; whole-file RMS is measured before resampling. Verification uses a temporary PCM16 decode to avoid the sibling WAV decoder's unsupported extensible-float header; this does not change the deliverable. A known-delay/gain test validates the verification clock independently of retained 48 kHz source metadata. Full decode, final BT.709 frame inspection, and the intentional black final frame all pass.

### Runtime and architecture

- Pin `remotion`, `@remotion/cli`, `@remotion/renderer`, and `@remotion/media` to **4.0.532**, the version queried from the npm registry during preparation. Use React/React DOM 19.2.0 and TypeScript 5.9.3 with Bun and a committed lockfile.
- Register one composition, `PixelParadeSquare`, with width/height 1080, fps 60, and `durationInFrames = ceil(86.12 × 60) = 5168`.
- Use SVG/CSS for major geometry and a bounded Canvas layer for sparks. Simulate depth through deterministic perspective projection; no WebGL dependency is required.
- Split scene responsibilities into a background, formation renderer, ribbons, impact rings, and sparks. Reuse persistent token identities across cue morphs.
- Evaluate every pose directly from frame number and event history. Do not accumulate animation state, depend on wall-clock time, or use unseeded randomness.
- Simulate trails from a small fixed set of earlier poses. Load the compact analysis once and resolve all assets before frame capture.
- Play the unchanged 48 kHz source with `Audio` from `@remotion/media`. Stems remain diagnostic/control inputs only.

### Required scripts and previews

Provide `studio`, `analyze`, `render:preview`, and `render` scripts. The analysis command should invoke the existing Go wrapper and derive compact controls. Production rendering should run type checking and source/analysis validation first.

Render representative clips before the full master:

1. 0–12 s: opening, first pause, and first entrance.
2. 34–47 s: breakdown and tunnel return.
3. 60–68 s: contraction and the 64-second finale entrance.
4. 80–86.12 s: spectral collapse and ending.

Review formation legibility, continuity, actual transient synchronization, and the contrast between breakdowns and the finale. Check frames at 0, 8.75, 9.17, 18.05, 18.31, 36.6, 44.4, 54.9, 64.0, 73.14, 82.3, and the final frame.

### Master export

Output: `out/PixelParade.mp4`. Use H.264, `yuv420p`, BT.709 limited range, CRF 18 with the `fast` x264 preset, AAC stereo at 320 kbps, two render workers, and MP4 fast start. Export all 5168 frames; the video ends about 13 ms after the WAV. Do not trim, retime, normalize, or fade the audio. The visual tail follows the source's natural ending.

Once scripts exist, the equivalent render command is:

```sh
rtk proxy bunx remotion render src/index.ts PixelParadeSquare out/PixelParade.mp4 --codec=h264 --pixel-format=yuv420p --color-space=bt709 --x264-preset=fast --crf=18 --audio-codec=aac --audio-bitrate=320k --concurrency=2
```

Ensure fast start through the supported renderer configuration or a final lossless `ffmpeg -c copy -movflags +faststart` remux.

### Known environment constraints

Direct Python/Go/npm DNS access is restricted in this execution environment, while curl and package installation successfully reached their respective sources. The official model was downloaded with curl and loaded through a local model repository. An npm metadata query failed; curl retrieved the registry metadata successfully.

Native Chrome screenshot attempts failed during preparation with sandbox socket/shutdown restrictions. The Remotion continuation resolved video rendering by using its official Chrome Headless Shell with the Node renderer; the minimal composition preflight and subsequent production captures passed. The diagnostic HTML's JavaScript syntax and independent PNG were checked during preparation; interactive playback on that inspection page remains unaudited.

## 6. Verification and acceptance

### Completed preparation checks

- [x] Source copied and verified against its SHA-256.
- [x] Four local float32 stems generated with recorded model/settings/dependencies.
- [x] All source/stem durations and sample formats inspected with FFprobe.
- [x] No stem exceeds full scale according to FFmpeg true-peak measurements.
- [x] Stem reconstruction, delay, and duration checks pass.
- [x] Go tests pass: known PCM WAV decoding and buffered seeking; 44.1/48 kHz resampling lengths, impulse timing, and anti-aliasing; anti-phase stereo preservation and frequency assignment; finite silence/no triggers; isolated transient timing within a 60 fps frame; and known-tempo recovery.
- [x] `go vet ./...` passes. Generated data checks confirm source identity, all five 8612-frame timelines, finite/bounded controls, ordered events, and no onsets inside measured gaps. Drum-grid median errors are 9.43 ms at 0–20 s, 9.43 ms at 30–50 s, and 4.43 ms at 64–82 s, with no accumulating drift evident.
- [x] Full Go analysis generated, with real-track drum grid fit and tempo alternatives recorded.
- [x] Machine-readable features, section CSV, readable report, interactive diagnostic HTML, and standalone plot generated.
- [x] Diagnostic HTML script parses; static plot visually inspected.
- [x] This `PLAN.md` records findings, design, commands, interfaces, and the next milestone.

### Acceptance for the next milestone

- [x] Minimal browser/render preflight succeeds before expensive scene work.
- [x] TypeScript checks and compact-control schema/source validation pass.
- [x] Repeated and out-of-order renders of selected frames are identical.
- [x] Representative clips align impacts with validated events within one 60 fps frame; measured pauses suppress emission and impulses.
- [x] Opening, two breakdowns, returns, finale, and ending have visibly distinct choreography.
- [x] No text appears; central geometry stays legible and the finale earns its higher density.
- [x] Full master contains the complete soundtrack at original timing/gain and no unexplained blank frames or missing assets.
- [x] FFprobe verifies 1080×1080, 60 fps, 5168 frames, H.264, `yuv420p`, and stereo AAC.
- [x] Final review checks sync at beginning/middle/end, transition continuity, clipping at canvas edges, neon compression quality, and the last frame.

## References

- [Demucs source and separation documentation](https://github.com/adefossez/demucs).
- [Demucs 4.1.0 package](https://pypi.org/project/demucs/4.1.0/).
- [Remotion audio documentation](https://www.remotion.dev/docs/audio/visualization).
- [Remotion rendering options](https://www.remotion.dev/docs/cli/render).
- [Remotion registry metadata](https://registry.npmjs.org/remotion/4.0.532).
