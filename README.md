# PixelParade

A deterministic Remotion music visualizer, driven by locally separated stems and Go audio analysis. The master is a full-track, text-free neon geometric parade at 1080×1080 and 60 fps.

Completed master: [out/PixelParade.mp4](out/PixelParade.mp4). Export checks confirm 5168 frames, continuous frame timestamps, complete decoding, stereo AAC, fast start, and zero detected audio lag in all comparison windows. Measurements are recorded in [analysis/render-validation.json](analysis/render-validation.json).

## Run

```sh
rtk proxy bun install --frozen-lockfile
rtk proxy bun run studio
rtk proxy bun run validate
rtk proxy bun run render:stills
rtk proxy bun run render:preview
rtk proxy bun run render
rtk proxy sh scripts/go.sh run ./cmd/verifyrender
```

The render scripts compile their TypeScript orchestration with Bun and execute the Remotion renderer with Node. Outputs go into `out/`: `PixelParade.mp4`, four preview clips, and captured scene frames. The studio uses the original WAV and the exported compact controls; it does not require stem playback.

The master renders in nine resumable sections under `out/segments/`. A source/settings fingerprint prevents mixing sections from different versions. Re-running `bun run render` verifies and reuses completed sections. Assembly copies the video streams and encodes the complete original WAV once. The render command then runs the Go output verifier automatically.

The local renderer uses `.cache/browser/chrome-headless-shell-linux64/chrome-headless-shell`. To recreate that browser installation:

```sh
rtk mkdir -p .cache/browser
rtk proxy curl -fL 'https://remotion.media/chromium-headless-shell-linux-x64-149.0.7790.0.zip?clear' -o .cache/chrome-headless-shell.zip
rtk proxy unzip -q .cache/chrome-headless-shell.zip -d .cache/browser
rtk proxy bun run preflight
```

## Analysis and verification

`PLAN.md` records the source measurements, storyboard, controls, separation setup, and production decisions. `bun run analyze` reruns the Go analyzer and compact exporter; existing stems are required. The full inspection timeline is `analysis/overview.html`.

`bun run validate` verifies the soundtrack hash, schema, exact Go-exported controls, deterministic seek behavior, safe geometry bounds, particle limits, and pause/event timing. Actual frame capture hashes are recorded in `analysis/frame-determinism.json` by `render:stills`. `cmd/verifyrender` checks the master format and fast start, decodes the complete video, and compares the encoded soundtrack to the original at the beginning, middle, end, and tail.

Major geometry is SVG with a bounded glow pass; sparks are drawn on Canvas. Every position depends on frame time, recorded features, and seed 42. There is no browser FFT or accumulated animation state. Only the original WAV is heard.
