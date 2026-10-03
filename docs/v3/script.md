# WICK — production script (v3)

The single source of truth for implementing the WICK treatment (`docs/v3/concepts/procession.md`) on the v3 engine. Where this script and the treatment disagree, this script wins. Every number here is either measured (`public/analysis/story.json`, `public/analysis/controls.json`) or a design constant. Constants marked **[C]** may be tuned during look-dev; everything else is load-bearing for continuity between scenes.

## 0. Conventions

| Item | Convention |
|---|---|
| Time | Song seconds `t`. Frame `f = round(t × 60)`. Bar `n` starts at `0.038 + n × 2.285714 s`; beat = 0.571429 s; 16th = 0.142857 s. |
| bar.beat | Bar 0-based, beat 1-based with decimals: `9.4` = bar 9 beat 4; `7.4.52` = bar 7, beat 4.52. |
| World units | 1 unit = 1 tile. Ground is the XZ plane at `y = 0`; `+Y` up. |
| Crest coordinates | `(x, h)`: `x` across the crest (0–120), `h` up the crest (0–84). World: `X = x − 60`, `Z = 42 − h`. So the crest is centered on the world origin, its "up" is world `−Z` (north). |
| Frames along the route | `p` = position, `h` = unit heading, `r` = unit right = `(−h.z, 0, h.x)`, `Y = (0, 1, 0)`. |
| Ramp positions | `lightRamp(x)`: void 0, plum .143, purple .286, crimson .429, orange .571, amber .714, yellow .857, flare 1. |
| Smoothstep | `ss(a, b, x)` = `smoothstep` from `engine/easing.ts`. `eoc` = `easeOutCubic`, `eioc` = `easeInOutCubic`. |

---

## 1. Story spine

A single pixel flame, Wick, crosses a sleeping plain of dark tiles. Every note it plays lights the tile under its step. After the first held breath, the lit trail stands up and follows. The march doubles into two columns and cuts chevrons, until a crimson shadow rolls in and the floor burns away. Wick walks alone over nothing, under a frightened sky. The tiles come back as tunnel walls and the march resumes, darker. Then the opening returns: the plain is patterned with cooled trails and resting walkers. A far tile lights itself, the only light Wick did not give, and walks over to meet it. After the third breath, the whole plain rises, 2,000 strong. The line climbs a stair onto a causeway, and the ghost lantern comes down and joins. In the last bars the crane rises and shows that the route was Wick's own crest. (148 words)

**Emotional curve** (`LIGHT` follows it; see §2.8):

```
light 1.0 |                                                            ___-----_
          |                                                         _-'         '-_ (warm)
      0.5 |           ____----____                 _--_            /
          |      ___-'            '--__      ___--'    '--_       /
      0.2 | _ _ /                      '-___/              '-__ _/
      0.0 |'  ^ breath         ^ breath      drift      memory  ^ breath   home
          0      9.18         18.3        36.6   45.75   54.9   64.04       82.3  86.1
```

Beats: alone and curious (0–9), first joy (9–18), confident and doubled (18–30), unease (30–36.6), fear and solitude (36.6–45.75), defiant return (45.75–54.9), memory and tenderness (54.9–60.2), being answered (60.24), triumph (64–82), home and rest (82–86).

---

## 2. Global systems

All systems are **pure functions of `t`**, the static `World` (built once per `Story`) and per-instance constants. There is no simulation history. Nothing reads the wall clock.

### 2.1 Clock and held breaths

```ts
export const FREEZES: [number, number][] = [[8.74625, 9.1685], [18.049875, 18.310792], [63.615, 64.03]]; // f525–550, f1083–1098, f3817–3841 (63.615 so f3817 = 63.6167 s is held)
export const heldTime = (t: number) => { for (const [a, b] of FREEZES) if (t >= a && t < b) return a; return t; };
```

- **Motion** (walkers, embers, sparks, Wick's position and hop, crest flares) is evaluated at `τ = heldTime(t)`, so a freeze holds every pose. Freezes do not shift later time, because the music resumes in real time.
- **Light** (exposure, flashes, tile cooling) uses real `t`, so the frozen world can dim or brighten while it holds.
- **Freeze 1 (f525):** Wick and the crest shrink to one pixel over 4 frames: `wick.scale = 1 − .85·ss(8.746, 8.813, t)`, restored by the iris. The plain dims to 40 %.
- **Freeze 2 (f1083):** the anticipation hop holds at its apex (§2.5), along with the hat sparks.
- **Freeze 3 (f3817):** walkers hold, sitting up with heads at 0.6. Wick shrinks to one pixel as in freeze 1 (`ss(63.615, 63.682)`).

### 2.2 The route

**Geometry (a constant, independent of the story).** The route is the skyline outline of M1's 12 columns. Column heights are the scale degrees `DEG = [14, 7, 2, 11, 7, 8, 9, 8, 9, 7, 7, 8]`, with **U = 6 tiles per degree** and **W = 10 tiles per column**. The route starts at the crest base `(0, 0)`, climbs the left edge of column 0, and walks every column top left to right with vertical steps between them. It finishes by descending the right edge of column 11 to `(120, 3)`, not the base, so the total length is exactly **L = 441 tiles**.

Vertices (arc → world X, Z). Every segment is axis-aligned, and every vertex is an integer tile:

| arc | X, Z | heading after | | arc | X, Z | heading after |
|---:|---|---|---|---:|---|---|
| 0 | −60, 42 | N (−Z) | | 290 | −10, −6 | E |
| 84 | −60, −42 | E | | 300 | 0, −6 | N |
| 94 | −50, −42 | S | | 306 | 0, −12 | E |
| 136 | −50, 0 | E | | 316 | 10, −12 | S |
| 146 | −40, 0 | S | | 322 | 10, −6 | E |
| 176 | −40, 30 | E | | 332 | 20, −6 | N |
| 186 | −30, 30 | N | | 338 | 20, −12 | E |
| 240 | −30, −24 | E | | 348 | 30, −12 | S |
| 250 | −20, −24 | S | | 360 | 30, 0 | E |
| 274 | −20, 0 | E | | 370 | 40, 0 | E (column seam, no turn) |
| 284 | −10, 0 | N | | 380 | 50, 0 | N |
| | | | | 386 | 50, −6 | E |
| | | | | 396 | 60, −6 | S |
| | | | | 441 | 60, 39 | end |

For `s < 0`, the route extends south from the start along `+Z`. For `s > 441`, it extends south along the final tangent.

**Song time → arc (one tile per note).** Lead notes are `story.leadNotes` (443). `FINAL` is the index of the first note with `startSeconds ≥ 84.6`; that is 441, the final G at 84.615, f5077. Each note owns one tile:

```
noteArc(i) = min(i, FINAL) · L / FINAL                     // = i with the real story
wickArc(t): τ = heldTime(t); k = last note with start ≤ τ (−1 → arc 0)
            arc = noteArc(k−1) + eoc((τ − start_k) / 0.09) · (noteArc(k) − noteArc(k−1))
camArc(t)  = mean of wickArc(t − 0.1 j), j = 0..4          // smoothed for cameras
```

Wick advances about 5 tiles/s. It stops in arp gaps and freezes, because notes stop there. The note-on of note `i` lights route cell `i`, so "Wick lights the tile under each arp note" holds exactly.

**What each scene walks.** These are measured note counts, and the turn times are the times Wick reaches each corner.

| Scene | t | arc | Strokes walked | Turns (arc @ s / f) |
|---|---|---|---|---|
| sleeping-plain | 0–9.17 | 0 → 46 | Left wall of col 0, heading N | — |
| first-parade | 9.17–18.31 | 46 → 100 | Wall to top of col 0 → over → down col 0/1 step | 84 @ 14.605 / f876, 94 @ 16.645 / f999 |
| interlocking | 18.31–36.6 | 100 → 202 | Down to col 1 → col 2 → up col 3 | 136 @ 24.47 / f1468, 146 @ 25.91 / f1555, 176 @ 31.325 / f1880, 186 @ 33.59 / f2015 |
| drift | 36.6–45.75 | 202 → 244 | The long climb of col 3 | 240 @ 45.04 / f2702 |
| tunnel | 45.75–54.9 | 244 → 292 | Top of col 3, down to col 4, up to col 5 | 250 @ 46.64 / f2798, 274 @ 51.335 / f3080, 284 @ 53.16 / f3190, 290 @ 54.2 / f3252 |
| memory-plain | 54.9–64.04 | 292 → 328 | The col 5–7 stair meander | 300 @ 56.49 / f3389, 306 @ 58.035 / f3482, 316 @ 60.185 / f3611, 322 @ 61.79 / f3707 |
| grand-parade | 64.04–82.35 | 328 → 430 | Cols 7–11 and the final descent | 332 @ 64.615, 338 @ 65.92, 348 @ 67.34, 360 @ 69.19, 380 @ 72.76 / f4366, 386 @ 73.91, 396 @ 75.62 / f4537 |
| homecoming | 82.35–84.615 | 430 → 441 | The end of the col 11 descent | Lands at 441 = world (60, 0, 39) on f5077 |

The crest's outline is the whole route. The final top-down camera (§2.7 `top`) frames X ±68 and Z ±68, which contains the crest box X ±60, Z −42…42.

**Smoothed frame.** Formations and cameras must not snap at the 90° corners. `routeFrame(s)` box-averages `routePoint` over `[s − 8, s + 8]` (33 samples). Its heading is the normalized difference `routeSmooth(s + .5) − routeSmooth(s − .5)`. Build it once as a table at 0.25-arc resolution over `s ∈ [−240, 500]` and interpolate linearly. In-world Wick uses the **crisp** `routePoint`, so it turns like a pixel sprite; everything else uses the smoothed frame.

**Causeway.** `causewayY(s, t) = Σ_{j=0..6} 0.4 · [s ≥ 375 + j] · ss(T_j − .12, T_j, t) · (1 − ss(82.35, 84.0, t))`, where `T_j = noteStart[375 + j]`, the notes of the 72.0–73.2 run. Each step rises just before Wick steps on it. Walkers, Wick, tiles with `tileArc ≥ 375` and `|tileLateral| ≤ 5.5`, and the camera base all add it.

**Swell.** `swellY(p, t) = 0.35 · c.bass · exp(−|p − P_sw|² / 200)`, where `P_sw = routeFrame(wickArc − 10).p`. It applies to tiles and walkers in scenes with `swellGain = 1` (procession scenes and tunnel).

### 2.3 Wick

Wick is drawn **twice**: as an in-world body, rendered by every scene through `<Wick/>`, and as the screen-space crest on the motif layer, which survives every transition.

**In-world body (`world.wick`):**
- `p = routePoint(wickArc)`, crisp.
- `y = causewayY + noteHop + climb`, where `noteHop = .25 · sin(π · clamp((τ − start_k) / .12))`.
- Drift only: `climb = .15 · max(0, midi_k − 74)`, eased over 0.15 s and multiplied by `(1 − ss(45.0, 45.75, t))`. F#6 (midi 90) at 38.84 / f2330 lifts Wick 2.4 tiles.
- Body: a 0.4 × 0.8 × 0.4 emissive box in flare `#fff3c4`, plus a head halo sprite (radius 0.6) and a pool light on the tiles: `P_YELLOW · glow / (1 + d²/6) · .4`, added in the tile shader. It is not a three.js light.
- `glow = .45 + .55 · act`, where `act = 1` while a note sounds, else `exp(−(τ − lastEnd) / .15)`. Arp rests dim Wick.

**Crest glyph (motif layer).** The crest replaces the diamond/star glyph in `MotifLayer` and in the iris.
- **Crest coordinates.** `x ∈ [−.714, .714]` (12 columns, each 0.119 wide); `y ∈ [0, 1]`. Column k has height `DEG[k] / 14`. The aspect is 1.4286, the giant crest's 120 : 84.
- **Anchor.** `ANCHOR = (.18, .25)` lies in the solid block of columns 3–11 below `y = .5`, so its inradius is 0.25. A screen point `ndc` maps to crest coordinates as `q = (ndc − center) / scale + ANCHOR`.
- **Placement.** `center = head + (0, .012) + ANCHOR · scale`. Here `head` is the NDC projection of `wick.p + (0, wick.y + 1.0, 0)` through the active layer's camera; during a transition, mix the two projections by `ease(progress)`. The crest's base therefore sits just above Wick's head.
- **Scale (NDC half-units).** Default `.05`, which gives ≥ 3 px per column at 1080². It eases to `.08` at the finale (64.04–66.32). Freezes 1 and 3: `.004`, drawn as a single 1-px flare dot (`dot = 1`).
- **Column flare.** Each lead note belongs to the column under a playhead that sweeps the crest once per bar: `col = clamp(floor(12 · frac((start − .038) / 2.285714)), 0, 11)`.
  - Flare: `flare_k = max over notes in col k with start ≤ τ (look back 1.5 s) of (vel/127)^.7 · mix(stacc, leg, λ)`.
  - Staccato: `stacc = exp(−age / .09)`.
  - Legato: `leg = 1` while the note sounds, then `exp(−(age − dur) / .25)`.
  - M1-tagged notes ×1.0; other notes ×0.7.
- **Staccato vs legato.** `λ` comes from `LEGATO` keys (§2.8).
  - Column visibility: `base + flare_k`, with `base = .55 · λ`. In the intro (`λ = 0`), columns exist only while flared, so they "blink out in rests".
  - Column width: `mix(.5, .9, λ)` of the cell.
  - Color: `lightRamp(mix(1.0, .74, λ) + .12 · flare_k)`. Pale flare in the intro, an amber crown in the finale.
  - Column tops get a +40 % cap.
- **Glow.** `(.6 + 1.2 · light) · wick.glow`.
- **Embers around the crest.** 24, not 90, and only while `λ > .5`, giving a sparkle around the crown. Off from 82.35.
- **Rings.** `rings` come only from M4 and M5 occurrences, drawn crest-shaped at strength ×0.6.

### 2.4 Tiles (the plain)

**One instanced system.** A grid of 160 × 160 = 25,600 cells covers `X, Z ∈ [−80, 79]`. Each instance is a 0.92 × 0.92 quad at its cell center, so the 0.08 gaps read as ink lines.

**Static per-cell attributes** (built once):
- `cell` (ivec2) and `hash`.
- `tileArc`: arc of the nearest route point, crisp polyline, searched over all segments.
- `tileLateral`: signed distance to that point along `r`.
- `crest`: 1 if the cell lies inside the crest silhouette.

**Events.** Two static RGBA32F 160 × 160 data textures hold up to 8 events per cell. Each event is packed as `kind · 128 + time`; −1 means empty. Events are sorted ascending. The shader takes the **latest event with `time ≤ t`** and computes:

```
a = t − t0
x = a < 8 ? mix(x0, .286, ss(0, 8, a)) : mix(.286, .143, ss(8, 20, a))   // yellow→amber→crimson→purple over 8 s, then plum residue
I = s · (.10 + .30·exp(−a/6) + 2.2·exp(−a/.5)) · uResidue^(a > 8)        // flash, warm tail, permanent residue
emissive = lightRamp(x) · I
```

The first 0.1 s after `t0` adds `+1.5 · P_FLARE · exp(−a / .04)` as a contact spark.

| kind | x0 | s | Source events (all built in `buildWorld`) |
|---:|---|---|---|
| 1 contact | .857 | 1.0 | Route cell `i` at `noteStart[i]`, for `9.17 ≤ t`. |
| 2 contact-cold | .55 | .6 | Route cell `i` at `noteStart[i]` for notes before 9.17: the thin violet intro trail. |
| 3 wake | 1.0 | .8 | A walker's home cell (rounded) at its wake time (§2.5). |
| 4 stamp-amber | .714 | 1.0 | Chevrons (M2 #1–4), loop rings (M4), the homecoming lock. |
| 5 stamp-crimson | .429 | 1.0 | Chevron M2 #5 (48.04, on B7) and hammer hits (M6). |
| 6 blink | .714 | .6 | Fill flickers (§2.6) and distant snares in memory-plain. |
| 7 crest-fill | .714 | .55 | Homecoming crest interior. |
| 8 answer | 1.0 | 1.0 | The answer tile at 60.24. |

**Asleep look.** Color is `mix(void, ink, hash)`, and the emissive is the latest event's plus Wick's pool light. The fragment shader applies exp² fog manually through `uFogDensity` and `uFogColor`, because the plain uses custom shaders.

**Uniforms.** `uT`, `uLight`, `uResidue`, `uFloor` (0 hides the plain, so drift renders without it), `uDim` (freeze 1 dims to .4), `uWick` (pos, glow), `uShadow` (strength, frontArc), `uSwell` (center, amp), `uCause` (on/off), `uFogDensity`, `uFogColor`.

**Validation.** No cell may exceed 8 events (§7).

### 2.5 Walkers

**One instanced system** holds 2,048 walkers. A walker is two stacked 0.36³ cubes, a 1 × 2 px column: a **foot** in the cooled tile color (crimson→purple, emissive 0.15) and a **head** with emissive `head · lightRamp(.70 + .15·light) · 2.0`. The drift scene draws the same poses with `look="ember"`: head only, as a glyph sprite, with no foot.

**Cohorts and slots** (static, built once). `F1`, `F2` and `F3` are formations. `b` is the back distance in arc tiles behind Wick and `l` the lateral offset along `r`.

| Cohort | k | Home `(a, l_home)` | Wake `T_w` | F1 (first-parade) | F2 (interlocking, tunnel) | F3 (grand) |
|---|---|---|---|---|---|---|
| 0 trail | 0–45 | Route cell `45 − k`, l 0 | First kick ≥ 9.1685 → **9.17 (f550)** | Over `[9.1685, 11.467]`, `b` blends from `k + 1` (its own cell) to `1 + .6k`; l 0 | lane = k mod 2, row = ⌊k/2⌋; `b2 = 2 + row`, `l2 = ∓3` (even k left = −3) | lane `j = 1` or `7`, row `r = b2 − 2 + Δ`, so `b3 = b2 + Δ` |
| 1 guard | 46–199 | Its F2 slot at 18.31: `a = A(18.311) − b2`, `l = l2` | `min(18.315, first kick ≥ T_reach(a + 28.6))` | Stands at home, waiting | Rows 23–99, as above | As cohort 0 |
| 2 plain | 200–2047 | Its F3 slot at 64.04: `a = A(64.038) − b3`, `l = l3` | **64.038 (f3842)**: all rise at once | — | — | Remaining slots, row-major: rows 0–227 × lanes 0–8, skipping lanes 1 and 7 in rows 36–135; `b3 = 2 + r`, `l3 = j − 4` |

Notes on the table:
- `A(x)` is `wickArc` at time x.
- `Δ = A(64.038) − A(54.9)`, about 36, so walkers that lie down at 54.9 rise **exactly** in their F3 slot.
- `T_reach(x)` is the start time of note ⌈x⌉, the moment Wick's arc reaches x; for x ≤ 46 it returns 9.17. Guards therefore wake in a ripple as the F1 tail (about 28.6 tiles back) passes them.
- Counts: about 84 stand at 9.17 (the 46-walker trail plus 38 rear guards whose homes Wick passed before the breath); the rest of the 200 stand in a ripple until 18.315; 200 march from 18.31; 2,048 march from 64.04.

**Pose, `walkerPose(w, k, t) → {x, y, z, yaw, lie, stand, head, spark}`.** Evaluate at `τ = heldTime(t)` with `A = wickArc(τ)` and apply the rules in order:

1. **Not visible** (`stand = 0`): cohorts 0 and 1 while `τ < T_w`; cohort 2 while `τ < restLight_k`. `restLight_k` is distant snare `k mod 5` of `[55.33, 55.46, 55.905, 56.205, 56.605]`.
2. **Resting** (cohort 2 before 64.038; cohorts 0 and 1 in `[54.9, 64.038)`):
   - Position: `routeFrame(s).p + r · l`. For cohort 2, `s = a`. For cohorts 0 and 1, `s = A(54.9) − b2` and `l = l2` (they stop).
   - Lying down: `lie = ss(54.9, 55.5, τ)` for cohorts 0 and 1; cohort 2 lies at 1 from `restLight`.
   - Sit-up on the fill: `lie ← lie − .5 · ss(62.89, 63.19, τ)`.
   - Head: `.3` lying, `.6` sitting. Cohort 2's head flashes to 1.5 at `restLight`, then decays to .3 with `exp(−age/.4)`.
3. **Stand-up:**
   - `stand = ss(T_w, T_w + 4/60, τ)`, with the home tile flash as event kind 3.
   - At 64.038, `lie` goes `.5 → 0` over 4 frames.
   - The stand pop is hidden by bloom and by a `+1.5` head flash with `exp(−age / .2)`.
4. **March arc:**
   - `s = max(a, A − b(τ))`, laterally `l(τ)`.
   - `b` and `l` blend F1 → F2 over `[18.311, 20.609]` (cohort 0 only) using `ss`. From 64.038 on, F3 applies to all cohorts.
   - **M2 side-step:** in the interlocking scene, the left lane (`l2 = −3`) adds `−1.5 · sin(π · clamp((τ − T)/2.2857))` for `T ∈ {18.324, 22.895, 27.467}`. This is the "sideways, then forward" step.
   - **Stop at the collapse:** from 82.35, `s = A(82.35) − b3` and `lie = ss(82.35, 83.0, τ)`.
5. **Drift override** (cohorts 0 and 1, `τ ∈ [36.6, 48.038)`):
   - Float position `Pd`:
     - `s_d = (A(36.6) − b2) + .85 · (A − A(36.6))`
     - `l_d = l2 + 2.5 · (seed − .5) · ss(36.6, 38)`
     - `y_d = ss(36.6, 37.5) · (.5 + .6 sin(.7τ + 2π seed)) + 7 · (.6 + .4 seed) · ss(41.18, 43.2, τ)`. The walkers rise toward the sky at B7 and hang there.
   - Grid position `Pg`: wall side `sign(l2)`, `col = ⌊row/4⌋`, `wr = row mod 4`. `s_g = A(45.752) − 30 + 1.6·col`, `l_g = 5.6 · side`, `y_g = .6 + .9 · wr`.
   - Snap on the **44.03 snare (f2642)**: `P = mix(Pd, Pg, eoc((τ − 44.03) / .25))`.
   - Drop into F2: `P = mix(P, P_march(F2), ss(45.752 + .01·row, 45.752 + .01·row + 1.2, τ))`.
6. **Hops (y):**
   - Kick hop: `+.35 · hop(τ − δ_k − kick)` over the last 6 kicks, with `δ_k = .002 · b` and `hop(a) = a ∈ [0, .2] ? sin(π a / .2) : 0`. Kicks come from `analysis` onsets of kind `kick` (93, with the 16ths 0/7/8/10 pattern emerging from the data).
   - **Anticipation hop:** `.6 · sin(π/2 · ss(17.85, 18.05, τ))` before the freeze, held through it, then `· (1 − ss(18.311, 18.45, t))`.
   - Add `swellY + causewayY(s)`.
7. **Snare pulse (head):** `head += 1.5 · exp(−((τ − t_snare) · 45 − b)² / 8)` for the last 2 snares, a pulse that runs front to back.
8. **Hat sparks:** for each of the last 4 hats, walker k sparks if `hash01(k, hatIndex) < .12`. `spark = 1 − age/.35` for `age < .35`; the sprite rises `1.5 · age / .35` above the head.

**`yaw`** comes from `routeFrame(s).h`. `lie` rotates the body about `r` by `lie · π/2`; lying walkers show as a 2 × 1 bar with the head toward the route direction.

**Performance.**
- `posesAt(w, t): Float32Array(2048 × 8)` holds a single-entry cache keyed by `t`, so both layers in a transition share one evaluation.
- Components write `instanceMatrix` and an instanced head attribute in `useLayoutEffect`.
- Budget: ≤ 2 ms CPU per frame at 2,048 walkers; no allocations per frame. Pass `max` to cap drawn instances per scene (200 before 54.9, 2,048 after).

### 2.6 Recurring elements

All elements are reusable components in `src/v3/world/`. Per-frame state lives in `WorldFrame`; tile-based marks are events in §2.4.

| Element | Trigger times (s / f) | Specification |
|---|---|---|
| **Ghost lantern** (`<GhostLantern/>`, vox) | Always present. Stabs at 19.41 / f1165, 24.03 / f1442, 28.65 / f1719. Turn swells before each of the 24 corners. Tunnel mouth 53.0–54.0–57.3. Descent 72.8–73.3 / f4368–4398. Joins at 79.8–81.7 / f4788–4902. | Additive orb sprite, radius `1.2 → 3.0` in the tunnel mouth. **Position:** `cam.p + cam.h · D + Y · H − cam.r · 4`, with `D = 70` and `H = 5` by default. Tunnel: `D 70 → 18` and `H 5 → 2` over [53.0, 54.0], back to 70 / 5 over [54.0, 57.3]. Descent: `D → 28`, `H → 3`. Joining: lerp to `wick.p − wick.r · 2.5 + Y · 1.2` over [79.8, 81.7] (eioc), then held beside Wick. At 84.615 it lands at the route end `− r · 2.5`. **Glow:** `(.35 + 2.2 · c.vocal + 1.6 · Σ exp(−age_stab / .15) + 1.0 · turn) · (.6 + .4 light)`, where `turn = max_c ss(T_c − 1.2, T_c − .1, t) · (1 − ss(T_c, T_c + .4, t))`. **Color:** purple → amber with light. |
| **Answer light** (`<Answer/>`) | Lights at **60.24 / f3614**; walks 60.55–63.5; frozen 63.62–64.03; beside Wick from 64.04. | A walker with a 2× amber head and its own light; it is not one of the 2,048. Home `A0 = routeFrame(327).p + h·14 + r·10`, rounded, which is in front of and right of Wick, on the far side from the dolly camera. Its tile event kind 8 fires at 60.24 and it stands over 4 frames. Walk: lerp to `M = routeFrame(327).p + r · 1.5` using `eioc((τ − 60.55) / 2.95)`, with a kick-free hop every 0.29 s. From 64.038: blend to `wick.p + wick.r · 1.5` over [64.038, 64.6], then follow (causeway y included). |
| **Horizon band** (pads) | 41.18–45.75 (bars 18–19); 54.9–59.47 (bars 24–25); 82.32–86.12 (bars 36–37) | Backdrop horizon glow `envelope(t, start, end, .6, 1.0)`. **Tint** (new Backdrop prop): purple `.286` on non-G chords, amber `.714` while the chord root is G (pc 7). Crossfade over 0.3 s at chord changes: bar 19 turns amber at 44.609, bars 24–25 and 37 are amber. |
| **Shadow** (B7) | 1) Interlocking cloud 29.752 / f1785 → 36.6. 2) Drift sky 41.18 / f2471 → 45.75. 3) Tunnel pulse 48.038 / f2882, 0.6 s. | **Cloud:** `uShadow.strength = .65 · ss(29.752, 30.3)`, `frontArc = A(29.752) + 40 − 14 · (t − 29.752)`. Tiles with `tileArc > frontArc − 2` blend to ×0.35 and tint toward crimson / purple, so the front rolls back over the line. **Sky:** Backdrop `shadow` prop `.7 · ss(41.18, 42.3)` darkens the sky and tints the band crimson-purple until the amber at 44.609. **Pulse:** wall and floor emissive multiplied by `1 + 2 · exp(−(t − 48.038)/.25)`, tinted crimson. Never after 54.9. |
| **Chevrons** (M2) | 18.324 / f1099, 22.895 / f1374, 27.467 / f1648, 45.752 / f2745 (amber, kind 4); **48.038 / f2882 crimson** (kind 5) | A tile stamp. Anchor `P = routeFrame(A(T) + 6).p + r · l_c`, with `l_c = −3` (left column) for #1–3 and 0 for #4–5 in the tunnel. Arms: `P − h·j ∓ r·j` for j = 1..4, plus the apex P. The left arm lights at `T + .143 j` (C, beats 1–2); the apex and right arm light at `T + 1.143 + .143 j` (D, beats 3–4). |
| **Loop ring** (M4) | Starts 16.038 / f962, 70.895 / f4254, 80.038 / f4802; closes at `T_c = start + 1.0`: 17.038 / f1022, 71.895 / f4314, 81.038 / f4862 | Center `C = routeFrame(A(T_c)).p`; radius 4 / 7 / 10. Cells with `‖cell − C‖ ∈ [R − .5, R + .5]` light (kind 4) at `start + θ/2π`, where θ is measured from `−h` clockwise, so the ring closes behind the head: "the head meets its own trail". At `T_c` a `<LoopRing/>` annulus sprite flashes (width .3, y .05) with glow `3 · exp(−(t − T_c)/.5)`. The motif layer also shows a crest-shaped ring. |
| **Hammer** (M6) | Bar 15: 34.34, 34.84, 35.085, 35.625, 35.89, 36.08, 36.30, 36.45. Bar 23: 52.655, 52.985, 53.135, 53.68, 53.775, 54.02, 54.375, 54.715. These are the 8 bass D hits, read from `bassNotes`. | Band ahead: `tileArc ∈ [A(T0) + 6, A(T0) + 16]`, `|tileLateral| ≤ 4`. Each hit lights cells with `hash01(cell, hit) < .4` (kind 5). In the tunnel, the walls also flash on each hit (`world.hammer` = `exp(−age/.12)` of the latest hit). |
| **Herald beam** (M5) | 20.609 / f1237, 22.324 / f1339, 26.895 / f1614, 45.752 / f2745 from the right-column front walker (k = 1); 62.895 / f3774 and 77.181 / f4631 from the answer; 79.467 / f4768 from the F3 front walkers in lanes 0 and 8; 82.324 / f4939 from the ghost (amber, on C) | `<HeraldBeam/>`: a cylindrical-billboard additive quad, 0.14 wide. Height `12 · eoc((t − T)/.12)`; held for the occurrence (`endSeconds`), then fades over 0.4 s. Glow `1.8 · (.6 + .4 · Σ exp(−age/.1))` over M5-tagged lead notes. Yellow core, amber edge. |
| **Fill flicker** | 8.03, 8.18, 8.315, 8.465, 8.60 (f482–516); callback 62.89, 63.045, 63.175, 63.46 (f3773–3808) | For each hit, 7 cells chosen by hash in an 8–16-tile annulus around `wick.p` at that time, excluding route cells: kind 6 events. These are "the edge tiles flicker". |
| **Distant blinks** | Snares 55.33, 55.46, 55.905, 56.205, 56.605 | 9 cells per snare at distance 25–45 from Wick (kind 6), together with the resting-head groups of cohort 2. |
| **Lock and crest fill** | 84.615 / f5077 → 85.6 | Route cell `i` relights (kind 4) at `84.615 + (441 − i) · .0015`, a 0.66 s ripple running back from the landing point. Crest interior cells relight (kind 7) at `84.9 + .7 · (topDistance / 84)`, filling top-down. "The outlines lock." |

### 2.7 Camera rigs

`followRig(f, rig)` builds a `CameraPose` from the smoothed camera frame `cam = routeFrame(camArc)` and `yB = causewayY(camArc, t)`:

```
position = cam.p − cam.h·back + cam.r·side + Y·(up + yB)
target   = cam.p + cam.h·ahead + Y·(lift + yB − .5·pedal)     // pedal = c.bass when bassMidi % 12 == 2: "the plain tilts forward"
```

| Rig | back | side | up | ahead | lift | fov | Used by |
|---|---:|---:|---:|---:|---:|---:|---|
| `dolly` | 1.5 | −6.5 | 1.4 + .15 sin(.4t) | 3 | .5 | 40 | sleeping-plain, memory-plain (identical: the callback) |
| `paradeHigh` | 10 | −8 | 9 | 5 | 0 | 45 | first-parade after the rise |
| `topDiag` | 8 | −8 | 24 | 4 | 0 | 42 | interlocking |
| `topDiagLow` | 12 | −9 | 12 | 6 | .5 | 44 | interlocking under the shadow |
| `chase` | 7 | 0 | 1.8 | 10 | 1.2 | 62 | tunnel (roll `.04 sin(.5t) + .03 c.kick`) |
| `grandHigh` | 22 | −18 | 20 | 8 | 0 | 50 | grand-parade bars 28–31 |
| `grandCauseway` | 26 | −20 | 26 | 10 | 0 | 52 | grand-parade B′ |
| `top` (absolute) | position (0, 140, 14) → (0, 136, 13.6), target (0, 0, −2) | | | | | 52 | homecoming end |

The `drift` orbit is absolute:
- `a = a0 + .12 (t − 36.6)`, where `a0 = atan2` of `(−cam.h − cam.r)` at 36.6, so the orbit starts on the interlocking side.
- `position = cam.p + (12 cos a, 4 + 1.5 sin(.21t), 12 sin a)`, `target = cam.p + Y · 1.5`.
- fov 50, roll `.05 sin(.3t)`.

Never point a camera straight down: the compositor uses `up = +Y`. `blendPose(a, b, x)` lerps position, target, fov and roll.

### 2.8 Light, legato, palette, flashes

**`LIGHT`** (sorted; replaces the placeholder in `src/v3/timeline.ts`):

```ts
export const LIGHT: [TimeRef, number][] = [
  [{s: 0}, .08], [{s: 8.03}, .08], [{s: 8.6}, .12], [{cue: 'first-pause'}, .06], [{cue: 'first-parade'}, .06], [{s: 9.7}, .35],
  [{cue: 'second-pause'}, .38], [{cue: 'interlocking-parade'}, .4], [{bar: 9}, .5], [{bar: 13}, .5], [{s: 31.2}, .4],
  [{s: 34.85}, .4], [{cue: 'open-breakdown'}, .26], [{bar: 18}, .2], [{s: 44.03}, .22], [{bar: 20}, .45], [{bar: 21}, .55],
  [{bar: 23}, .55], [{s: 54.2}, .6], [{cue: 'suspended-breakdown'}, .45], [{s: 57.3}, .3], [{s: 63.62}, .28], [{bar: 28}, .3],
  [{s: 64.6}, .75], [{bar: 32}, .85], [{bar: 35}, .95], [{s: 82.04}, .95], [{s: 82.35}, .72], [{s: 85.73}, .7], [{s: 86.12}, .35],
];
/** Crest staccato (0) → legato (1). Same interpolation as LIGHT. */
export const LEGATO: [TimeRef, number][] = [
  [{s: 0}, 0], [{cue: 'first-parade'}, 0], [{bar: 5}, .25], [{cue: 'interlocking-parade'}, .4], [{cue: 'open-breakdown'}, .4],
  [{s: 37.2}, .1], [{bar: 20}, .1], [{s: 46.3}, .45], [{cue: 'suspended-breakdown'}, .45], [{s: 57.3}, .3], [{bar: 28}, .3],
  [{bar: 29}, 1], [{s: 86.12}, 1],
];
/** Global warm flashes added in the composite (post.flash): [time, attack s, decay s, strength, ramp x]. */
export const FLASHES: [number, number, number, number, number][] = [[9.18, .02, .3, .3, .857], [64.038, .04, .5, .7, .714]];
```

**Exposure.** Change `post.exposure` to `(.1 + .9·ease(t/1.2)) · (1 − .82·ease((t − 85.73)/.32))`. The film ends on an ink glow with Wick's ember still readable; it no longer fades over the last 1.5 s.

**Palette per section.** No other hues. `flare` and `yellow` are reserved for Wick, contact sparks and finale heads.

| Section | Ground and asleep tiles | Trails / stamps | Heads / Wick | Sky / horizon / ghost |
|---|---|---|---|---|
| sleeping-plain | void / ink | Contact-cold: orange → purple, thin | Wick flare, crest pale flare | No band. Ghost plum, faint. |
| first-parade | void / ink, swell lit | Yellow → purple; ring amber | Heads yellow; foot crimson | Ghost purple → amber. |
| interlocking | void / ink | Chevrons amber; shadow multiplies ×.35 → crimson / purple; hammer crimson | Heads amber; beams yellow / amber | Ghost amber, blinks on stabs. |
| drift | No floor; void | — | Embers: heads crimson → orange; Wick flare | Band purple, amber at 44.609; sky shadow crimson-purple. |
| tunnel | Floor at 0.6; walls ink with an orange edge rim | Chevron amber, then **crimson** (48.04); hammer red / amber | Heads amber | Ghost amber, fills the mouth at 54.0. |
| memory-plain | Ink with plum / purple residue (`uResidue` 1.4) | Distant blinks amber | Resting heads orange .3; answer amber; Wick flare | Band amber. |
| grand-parade | Void / ink, swell; causeway tiles orange | Yellow / amber, rings amber | Heads yellow; crown amber; answer amber | Ghost flare, then joins. |
| homecoming | Ink; crest fill amber | Lock amber | Heads amber .6; Wick flare is the one bright point | Band amber; no sparkle (hats, embers off from 82.35). |

---

## 3. Scenes

Six components, plus the shared world elements and the crest motif layer.

| Scene id | Component (file) | Variant props | Walk (arc) | Rig |
|---|---|---|---|---|
| `sleeping-plain` | `PlainSolo` (`scenes/PlainSolo.tsx`) | `memory: false` | 0–46 | `dolly` |
| `first-parade` | `Procession` (`scenes/Procession.tsx`) | `grand: false` | 46–100 | `dolly → paradeHigh` |
| `interlocking` | `Interlocking` (`scenes/Interlocking.tsx`) | — | 100–202 | `topDiag → topDiagLow` |
| `drift` | `Drift` (`scenes/Drift.tsx`) | — | 202–244 | orbit |
| `tunnel` | `Tunnel` (`scenes/Tunnel.tsx`, replaces the placeholder) | — | 244–292 | `chase` |
| `memory-plain` | `PlainSolo` | `memory: true` | 292–328 | `dolly` |
| `grand-parade` | `Procession` | `grand: true` | 328–430 | `dolly → grandHigh → grandCauseway` |
| `homecoming` | `Homecoming` (`scenes/Homecoming.tsx`) | — | 430–441 | `grandCauseway → top` |

Each file exports one `SceneDef` per id (`sleepingPlain`, `memoryPlain`, `firstParade`, `grandParade`, `interlocking`, `drift`, `tunnel`, `homecoming`). The variant is a wrapper: `Component: p => <PlainSolo {...p} memory/>`. The placeholders `void`, `ember-field` and `bloom` are removed from the registry, and their files deleted.

**`TIMELINE`** (replaces the placeholder in `src/v3/timeline.ts`):

```ts
export const TIMELINE: Entry[] = [
  {scene: 'sleeping-plain', from: {s: 0}},
  // Out of the first held breath, the world opens through Wick's crest on the downbeat.
  {scene: 'first-parade', from: {cue: 'first-parade'}, in: {kind: 'iris', length: {s: .45}, anchor: 'start'}},
  // One blink across the second breath: a re-angle onto two columns.
  {scene: 'interlocking', from: {cue: 'interlocking-parade'}, in: {kind: 'dissolve', length: {s: .26}}},
  // The drop-out taper: the floor burns away from the head of the line as the kick thins.
  {scene: 'drift', from: {cue: 'open-breakdown'}, in: {kind: 'burn', length: {s: 1.75}}},
  // Two-stage re-entry: embers gridded on the 44.03 snare in drift, then the bass slide brings the walls.
  {scene: 'tunnel', from: {bar: 20}, in: {kind: 'dissolve', length: {s: .35}}},
  // Crossfade while the pad bridges and the noise band falls.
  {scene: 'memory-plain', from: {cue: 'suspended-breakdown'}, in: {kind: 'dissolve', length: {s: 2.4}, anchor: 'start'}},
  // The mirror of 9.18 with a bigger release (plus the FLASHES wash at 64.038).
  {scene: 'grand-parade', from: {bar: 28}, in: {kind: 'iris', length: {s: .35}, anchor: 'start'}},
  // The early C chord floods amber; the spectral collapse lands at 82.35.
  {scene: 'homecoming', from: {s: 82.35}, in: {kind: 'wash', length: {s: .31}}},
];
```

The engine rules hold:
- No two adjacent ids are the same.
- Every transition lasts ≥ 4 frames.
- No transition window overlaps another.
- All three breaths are in-scene freezes. f525–550 lies inside `sleeping-plain`. f3817–3841 lies inside `memory-plain`. f1083–1098 is the 0.26 s dissolve window, and both layers are frozen there because motion uses `heldTime`.
- There are no entries at 27.47 (the harmonic turn is an in-scene state at 29.75) or at 73.18 (the stair climb continues).

---

## 4. Shot lists

Camera column: rig names refer to §2.7. "Elements" names the triggers from §2.6 and the systems they drive.

### 4.1 `sleeping-plain` (0 → 9.62, entry 1)

| t (s) | f | bar.beat | Musical event | What we see | Camera | Elements |
|---:|---:|---|---|---|---|---|
| 0.02 | 1 | 0.0 (pickup) | First arp note G5 | Darkness. Wick at route start (−60, 0, 42); cell 0 sparks. Crest is a pale dot of column 0. | `dolly` | Contact-cold events start; exposure ramps over 1.2 s. |
| 0.25 | 15 | 0.1.37 | First arp rest | Wick dims to .45; crest columns blink out. | `dolly` | `wick.glow`; λ = 0. |
| 0.04 / 2.324 / 4.609 | 2 / 139 / 277 | 0.1, 1.1, 2.1 | M1 ×3 | Crest playhead sweeps; a thin trail cools orange → purple behind Wick. | `dolly`; dolly travels north with Wick | Column flares. |
| 4.85 | 291 | 2.1.42 | Rest | Wick dims, hop stops. | | |
| 7.1 / 7.7 | 426 / 462 | 3.1.36 / 3.2.41 | Rests | Two dimmings. | | |
| 8.03–8.60 | 482–516 | 3.3 → 3.4 | Solo fill: hat, snares 8.18 / 8.315, kick 8.465, snare 8.6 | Edge tiles flicker in an 8–16-tile ring around Wick, one burst per hit. | Small push: `up −= .2·ss(8.03, 8.6)` | Fill flicker events (kind 6). |
| 8.17 | 490 | 3.3.25 | Arp stops | Wick stands still at arc 46. | | |
| **8.746** | **525** | 3.4.24 | **Hard stop: breath 1** | Freeze. Wick and the crest collapse to one pixel over 4 frames; the plain dims to 40 %. | Held (`heldTime`) | `wick.scale`, crest `dot`, `uDim .4`. |
| 9.1685 | 550 | 3.4.98 | Kick 9.17 | (Outgoing layer under the iris) the trail stands. | Held | Cohort 0 wake. |

### 4.2 `first-parade` (9.17 → 18.31, entry 2)

| t (s) | f | bar.beat | Musical event | What we see | Camera | Elements |
|---:|---:|---|---|---|---|---|
| 9.1685–9.6185 | 550–577 | 3.4.98–4.1.77 | Kick 9.17, **downbeat 9.181** | The iris opens through Wick's crest. Inside it, the 46-tile trail **stands** (flare flashes) and the crest regrows. | `dolly`, beginning the rise | Iris; FLASH (9.18); cohort 0 stands. |
| 9.181–11.467 | 551–688 | 4.1 → 5.1 | Full band; bass from 9.34 | The trail compresses into single file (b from k+1 to 1+.6k); the swell lifts the plain under the line. | Rise `dolly → paradeHigh` (eioc over [9.1685, 11.467]); pedal tilt on D | F1; swell; kick hops; snare pulses. |
| 11.467–14.6 | 688–876 | 5.1 → 6.2.49 | M1 bars 5–6, snare backbeat | 3/4 high tracking. Guards (cohort 1) wake in a ripple at the tail and stand beside the trail. Hat sparks. | `paradeHigh` | Cohort 1 wakes; hat sparks. |
| 13.6–14.6 | 816–876 | 5.4.73 → 6.2.49 | (Turn swell) | The ghost lantern swells on the horizon. | | Ghost `turn`. |
| 14.605 | 876 | 6.2.49 | Corner 84 | Wick turns east along the top of column 0; the line bends behind it. | Smoothed heading swings 90° over about 3 s | Route corner. |
| **16.038** | **962** | 7.1 | **M4 #1** (C–D→G) | A ring of tiles (R = 4) sweeps around the head... | | Loop ring tile sweep. |
| 16.645 | 999 | 7.2.06 | Corner 94 | ...as Wick turns south. | | |
| **17.038** | **1022** | 7.2.75 | G lands (kick 17.04) | The ring closes behind the head and flashes. | | `<LoopRing/>` flash; crest ring. |
| 17.5–18.0 | 1050–1080 | 7.3.56 → 7.4.4 | Snare build | Pulses race down the line faster and faster. | | Snare pulse. |
| 17.85–18.05 | 1071–1083 | 7.4.17 → 7.4.52 | Build peak, band cut | All walkers leap: the anticipation hop. | | Anticipation hop. |
| **18.05** | **1083** | 7.4.52 | **Breath 2** | Freeze mid-hop with embers (sparks) hanging; under it, the dissolve to interlocking. | Held | `heldTime`. |

### 4.3 `interlocking` (18.31 → 36.6, entry 3; shadow state from 29.75)

| t (s) | f | bar.beat | Musical event | What we see | Camera | Elements |
|---:|---:|---|---|---|---|---|
| 18.05–18.311 | 1083–1099 | 7.4.52–8.1 | Gap | The dissolve re-angles to top-down: about 200 lights frozen mid-air in two rows. | `topDiag` | Dissolve 0.26 s. |
| **18.315** | **1099** | 8.1 | Downbeat kick | They land; everyone marches. The trail walkers slot into the two lanes over bar 8. | `topDiag` | F1 → F2 over [18.311, 20.609]. |
| 18.324 | 1099 | 8.1 | **M2 #1** (C → D) | The left column side-steps, then steps forward; an amber chevron stamps beside it. | | Chevron #1; M2 side-step. |
| 19.41 | 1165 | 8.2.90 | Vox stab | The ghost blinks. | | Ghost stab. |
| **20.609** | **1237** | 9.1 | **M5 #1** | The right column's lead walker raises a herald beam. | | Beam (k = 1). |
| 22.324 | 1339 | 9.4 | M5 #2 | Beam. | | Beam. |
| 22.895 | 1374 | 10.1 | M2 #2 | Chevron, side-step. | | Chevron #2. |
| 24.03 | 1442 | 10.2.99 | Stab | Ghost blink. | | |
| 24.47 / 25.91 | 1468 / 1555 | 10.3.76 / 11.2.28 | Corners 136, 146 | The columns wheel east, then south. | Heading follows | |
| 26.895 | 1614 | 11.4 | M5 #3 | Beam. | | |
| 27.467 | 1648 | 12.1 | M2 #3 (exact), seamless boundary | Chevron #3; nothing else changes. | | |
| 28.65 | 1719 | 12.3.07 | Stab | Ghost blink. | | |
| **29.752** | **1785** | 13.1 | **B7/D# → Em** | A crimson-purple shadow front appears 40 tiles ahead and rolls back over the line; tiles under it drop to ×0.35. | `topDiag → topDiagLow` (eioc over [29.752, 34.324]) | Shadow (cloud). |
| 30.5–31.6 | 1830–1896 | 13.2.31 → 13.4.2 | Vox swell | The ghost brightens. | | `c.vocal`. |
| 31.325 / 33.59 | 1880 / 2015 | 13.3.75 / 14.3.72 | Corners 176, 186 | Turns east, then north. | | |
| 33.7–36.4 | 2022–2184 | 14.3.91 → 15.4.63 | Vox swell | Ghost swells. | | |
| **34.324** | **2059** | 15.1 | **M6 #1** | Tiles ahead hammer 8 crimson flashes (34.34 … 36.45). | | Hammer events. |
| 34.85–36.6 | 2091–2196 | 15.1.92 → 16.1 | Kick thins; drums gone 36.25 | The burn eats the floor from the head of the line backward. | | Burn transition. |

### 4.4 `drift` (36.6 → 45.75, entry 4)

| t (s) | f | bar.beat | Musical event | What we see | Camera | Elements |
|---:|---:|---|---|---|---|---|
| 36.6 | 2196 | 16.1 | Open breakdown | No floor. Walkers have become embers (head sprites) that lift off and drift behind Wick, who walks on over nothing. | Orbit, radius 12 | `look="ember"`; drift override. |
| 36.8 / 37.1 | 2208 / 2226 | 16.1.33 / 16.1.86 | Arp stutter gaps | Wick blinks; crest columns gone (λ .1). | | `wick.glow`. |
| **38.84** | **2330** | 16.4.90 | **F#6** | Wick climbs 2.4 tiles into the air on the peak note. | | `wick.y` climb. |
| 40.315–40.71 | 2419–2443 | 17.3.48 | Lead notes | The crest flickers its long notes. | | |
| **41.181** | **2471** | 18.1 | **Am → B7**, held chords | Embers rise about 7 tiles toward the sky and hang. The sky goes crimson-purple and the horizon band appears, violet. | Orbit continues | Shadow (sky); band (purple). |
| 43.467 | 2608 | 19.1 | Em/G | | | |
| 43.745 | 2625 | 19.1.49 | Hat | The first spark. | | |
| **44.03** | **2642** | 19.1.99 | **Snare: drums re-enter** | The embers snap into two vertical grids flanking the route ahead: the future tunnel walls. | | Grid snap (eoc .25 s). |
| 44.47–44.885 | 2668–2693 | 19.2.8–19.3.5 | Kicks | The grids pulse. | | Head hop glow. |
| 44.609 | 2677 | 19.3 | Gmaj7 | The band turns amber; the sky shadow lifts. | | Band tint. |
| 45.04 | 2702 | 19.3.75 | Corner 240 | Wick turns east. | | |
| 45.40–45.75 | 2724–2745 | 19.4.39 → 20.1 | Bass slide 45.5 | Dissolve to the tunnel. | | Dissolve 0.35 s. |

### 4.5 `tunnel` (45.75 → 54.9, entry 5)

| t (s) | f | bar.beat | Musical event | What we see | Camera | Elements |
|---:|---:|---|---|---|---|---|
| 45.5–46.32 | 2730–2779 | 19.4.56 → 20.2 | Bass slide, landing at 45.752 | Walls extrude from the floor at lateral ±6: 4 tiles high, front first, over one beat. The gridded embers drop into F2 behind Wick. | `chase` | Walls `ss(45.5 + .002·(arc − A), 46.32)`; drift → F2 drop. |
| **45.752** | **2745** | 20.1 | M2 #4 + M5 #4 | An amber chevron on the floor between the walls; the lead beam rises. | | Chevron #4; beam. |
| 46.64 | 2798 | 20.2.55 | Corner 250 | The corridor bends south. | Smoothed | |
| **48.038** | **2882** | 21.1 | **B7 + M2 #5** | A **crimson chevron**; a crimson pulse runs through walls and floor. | | Chevron #5 (kind 5); shadow pulse. |
| **50.324** | **3019** | 22.1 | Densest bar | Walls flicker with every footfall (wall emissive `+1.2 · c.kick`). | Roll `+.03 c.kick` | Wall kick flicker (bar 22 only). |
| 51.335 | 3080 | 22.2.77 | Corner 274 | Turn east. | | |
| **52.609** | **3157** | 23.1 | **M6 #2** | Walls and floor hammer on the 8 D hits (52.655 … 54.715). | | Hammer (walls and floor). |
| 53.16 | 3190 | 23.1.96 | Corner 284 | Turn north. | | |
| 53.0–54.0 | 3180–3240 | 23.1.7 → 23.3.43 | Vox swell, **peak 54.0** | The ghost lantern comes down into the tunnel's mouth and fills it (radius 3). | | Ghost tunnel path. |
| 54.0–55.5 | 3240–3330 | 23.3.43 → 24.2 | Taper | The walls part (lateral ±6 → ±14) and sink. | | Walls `part = ss(54.0, 55.5)`. |
| 54.2 | 3252 | 23.3.78 | Corner 290 | Turn east. | | |
| 54.9 | 3294 | 24.1 | Dissolve start | Walkers stop and lie down (54.9–55.5). | | Rest rule. |

### 4.6 `memory-plain` (54.9 → 64.39, entry 6)

| t (s) | f | bar.beat | Musical event | What we see | Camera | Elements |
|---:|---:|---|---|---|---|---|
| 54.9–57.3 | 3294–3438 | 24.1 → 25.1.21 | Pad bridges, noise band falls | Dissolve in: the opening shot again, but the plain carries plum and purple residue trails, and lying walkers sit behind Wick. | `dolly` (identical rig to 0 s) | `uResidue 1.4`; band amber. |
| 55.33–56.605 | 3320–3396 | 24.1.76 → 24.3.99 | Distant soft snares | Far tiles blink; five groups of resting heads light up ahead along the route (cohort 2 appears). | | Distant blinks; `restLight`. |
| 56.49 / 58.035 | 3389 / 3482 | 24.3.8 / 25.2.5 | Corners 300, 306 | Wick takes the small stair steps among the resting lights. | | |
| 60.185 | 3611 | 26.2.26 | Corner 316 | Wick turns south. The ghost swells... | | Ghost turn swell. |
| **60.24** | **3614** | 26.2.35 | **Lone vox tone** | ...and a far tile (front-right) **lights itself**: a flare spark, and an amber figure stands. | Unchanged; it lands about 14° right of center | Answer: event kind 8, stand. |
| 60.55–63.5 | 3633–3810 | 26.2.9 → 27.4.06 | | The answer walks toward Wick. | | Answer walk. |
| 61.79 | 3707 | 27.1.06 | Corner 322 | Turn east. | | |
| **62.89** | **3773** | 27.3 | **Fill callback** (hat; snares 63.045 / 63.175 / 63.46) | Walkers sit up (lie 1 → .5); edge tiles flicker as at f482. | | Sit-up; fill flicker. |
| 62.895 | 3774 | 27.3 | M5 #5 | The answer raises a herald beam. | | Beam (answer). |
| **63.62** | **3817** | 27.4.27 | **Breath 3** | Freeze: dark full of poised walkers (heads .6). The answer stands beside Wick; Wick shrinks to one pixel. | Held | Freeze 3. |
| 64.038–64.388 | 3842–3863 | 28.1 → 28.1.61 | **Finale drop** | Outgoing layer under the iris. | Held | |

### 4.7 `grand-parade` (64.04 → 82.35, entry 7)

| t (s) | f | bar.beat | Musical event | What we see | Camera | Elements |
|---:|---:|---|---|---|---|---|
| **64.038** | **3842** | 28.1 | Downbeat | The iris opens through the crest (0.35 s), then an amber flash (0.5 s). **All 2,048 walkers rise at once**, already in a 9-lane band 229 tiles long; 1,848 home tiles flash. The crest regrows as a full crown. | `dolly` | Iris; FLASH; cohort 2 wake; λ → 1. |
| 64.038–66.324 | 3842–3979 | 28.1 → 29.1 | M1 bars 28–30 | The rise, a wider version of first-parade's. | `dolly → grandHigh` (eioc) | F3; swell; hops; snare pulses; sparks. |
| 64.615 … 69.19 | 3877 … 4151 | 28.2 → 30.2 | Corners 332, 338, 348, 360 | The band snakes through the column 7–9 steps. | `grandHigh` | |
| **70.895** | **4254** | 31.1 | **M4 #2** | Ring R = 7 sweeps... | | Loop ring. |
| 71.895 | 4314 | 31.2.75 | G (kick 71.905) | ...and closes with a flash. | | |
| **72.0–73.18** | **4320–4391** | 31.2.93 → 32.1 | **Ascending run** | Seven route tiles lift into a stair (0.4 each, just before each step); the line climbs onto a causeway 2.8 high and carries on, raised. | `grandHigh → grandCauseway` over [72.0, 73.6] | `causewayY`. |
| 72.76 | 4366 | 31.4.26 | Corner 380 | Turn north on the stair. | | |
| 72.8–73.3 | 4368–4398 | 31.4.33 → 32.1.2 | Vox burst | The ghost lantern descends from the horizon to D 28, H 3. | | Ghost descent. |
| 73.181 | 4391 | 32.1 | B′ (no transition) | Raised march, light .85. | `grandCauseway` | |
| 73.91 / 75.62 | 4435 / 4537 | 32.2.28 / 33.1.27 | Corners 386, 396 | Turn east, then onto the final descent south. | | |
| 77.181 | 4631 | 33.4 | M5 #6 (exact) | The answer raises a beam. | | Beam (answer). |
| 79.467 | 4768 | 34.4 | M5 #7 | Two beams from the front walkers of lanes 0 and 8. | | Beams. |
| **79.8–81.7** | **4788–4902** | 34.4.58 → 35.3.91 | Vox burst | The ghost lantern comes down and joins the line at Wick's left: three lights lead. | | Ghost joins. |
| **80.038** | **4802** | 35.1 | **M4 #3** (exact) | The last ring (R = 10) sweeps and closes at 81.038 / f4862. | | Loop ring. |
| 81.75 | 4905 | 35.4 | Double hat | Last sparks. | | |
| 82.04–82.35 | 4922–4941 | 35.4.5 → 36.1.05 | Early C chord | Amber wash. | | Wash transition. |

### 4.8 `homecoming` (82.04 → 86.12, entry 8)

| t (s) | f | bar.beat | Musical event | What we see | Camera | Elements |
|---:|---:|---|---|---|---|---|
| **82.35** | **4941** | 36.1.05 | **Spectral collapse** | Sparkle off: no sparks, crest embers or hops. Walkers stop and lie down (82.35–83.0) with amber heads at .6. The causeway lowers (82.35–84.0). | Crane `grandCauseway → top`, eioc over [82.35, 84.9] | Stop rule; light .72. |
| 82.324 | 4939 | 36.1 | M5 #8 on C | The ghost raises an amber beam. | | Beam (ghost). |
| 82.32 → | 4939 → | 36.1 → | Pad (C D) | Amber horizon band. | | Band. |
| 83.467 | 5008 | 36.3 | D | Wick, the answer and the ghost walk the last tiles of the descent. | Crane passes about 60° | |
| **84.615** | **5077** | 37.1 | **Final G** | Wick lands on route end (60, 39). Its crest drops onto it (offset → 0). Every route tile relights in a ripple from the landing point backward: **the outline locks**, and it is the crest. | `top` reached at 84.9 | Lock events; crest offset `ss(84.615, 84.9)`. |
| 84.9–85.6 | 5094–5136 | 37.1.5 → 37.2.7 | Held chord, wobble | The crest interior fills amber from the top down. Small crest, giant crest. | `top`, push-in 140 → 136 | Crest-fill events. |
| **85.725** | **5144** | 37.2.95 | Release | Fade to an ink glow; Wick's ember survives. | | Exposure end ramp. |
| 86.05–86.12 | 5163–5167 | 37.3.5 | Tail, end | Ink, one ember. | | |

---

## 5. Transitions

All transitions are resolved by `windowOf`. "Center" is `transition.center`: the crest anchor at Wick's projected head, mixed across the two layer cameras.

| # | Boundary | Kind | Length | Anchor | Window (s / f) | Center | Rationale |
|---:|---|---|---|---|---|---|---|
| 1 | sleeping-plain → first-parade | iris (crest SDF) | 0.45 s | start, `{cue: 'first-parade'}` = 9.1685 | 9.1685–9.6185 / 550–577 | Crest anchor at Wick (a 1-px dot at the start) | The breath's exit: the parade bursts out of the protagonist's shape on the 9.17 kick / 9.181 downbeat. |
| 2 | first-parade → interlocking | dissolve | 0.26 s | end, `{cue: 'interlocking-parade'}` = 18.3108 | 18.0508–18.3108 / 1083–1099 | — | One blink across the second breath; both layers frozen (`heldTime`); a re-angle. |
| 3 | interlocking → drift | burn (radial bias) | 1.75 s | end, `{cue: 'open-breakdown'}` = 36.6 | 34.85–36.6 / 2091–2196 | Wick (front origin) | The drop-out taper. The kick thins from 34.9 and the floor burns away from the head of the line backward before the drums vanish (36.25). |
| 4 | drift → tunnel | dissolve | 0.35 s | end, `{bar: 20}` = 45.752 | 45.402–45.752 / 2724–2745 | — | Stage 2 of the two-stage re-entry (stage 1 is the 44.03 grid snap in-scene). It lands with the bass. |
| 5 | tunnel → memory-plain | dissolve | 2.4 s | start, `{cue: 'suspended-breakdown'}` = 54.9 | 54.9–57.3 / 3294–3438 | — | Crossfade while the pad bridges the barline and the noise band falls; walls sink inside it. |
| 6 | memory-plain → grand-parade | iris (crest SDF) + `FLASHES` wash | 0.35 s (+ 0.5 s flash decay) | start, `{bar: 28}` = 64.038 | 64.038–64.388 / 3842–3863 | Crest anchor at Wick (a 1-px dot) | Mirror of #1, with a bigger release. |
| 7 | grand-parade → homecoming | wash | 0.31 s | end, `{s: 82.35}` | 82.04–82.35 / 4922–4941 | — | The early C chord floods amber; the collapse arrives fully at f4941. |
| — | 27.47 | none | | | | | Seamless music; the turn is an in-scene state at 29.75. |
| — | 73.18 | none | | | | | The riser climbs without stopping: stair plus camera move. |
| — | end | exposure | 0.32 s | | 85.73–86.05 | | Fades to ink. One ember survives. |

**Shader changes** (WP5):
- **Iris:** `d = crestSdf((vUv − uCenter) · 2 / s + ANCHOR) · s / 2`, with `s = 12 · p²`. 12 = (screen diagonal 2.83) / (inradius 0.25), rounded up. The rim stays orange → amber.
- **Burn front metric:** `m = .55 · nClamped + .45 · clamp(length(vUv − uCenter) / .9, 0, 1)`, which replaces `n`.

---

## 6. Work packages

### 6.0 Dependency plan

**Phase 0** (WP5 lead, small, first) lands the contracts so everyone compiles:
- `src/v3/world/types.ts` with the interfaces below.
- Stub implementations in `src/v3/world/index.ts`. These return a static Wick at the route start and empty walkers; `routePoint` is real.
- `WorldContext`.
- `world` threaded through `FrameState` and `SceneProps`.
- One stub `SceneDef` per scene file, the registry, and the `TIMELINE` / `LIGHT` / `LEGATO` / `FLASHES` constants.

After Phase 0, **WP1–WP5 run in parallel**. Each owns its files exclusively. WP2–WP4 develop against the stubs and need WP1's real systems only for final look-dev.

### 6.1 Shared interfaces (exact; owned by WP1, created in Phase 0)

```ts
// src/v3/world/types.ts
import type {Vec3} from '../engine/frame';

export type Frame3 = {p: Vec3; h: Vec3; r: Vec3};
export type Occ = {start: number; end: number};
export type WalkerTable = {
  count: number;                                   // 2048
  cohort: Uint8Array;                              // 0 trail, 1 guard, 2 plain
  homeArc: Float32Array; homeLat: Float32Array; wake: Float32Array; restLight: Float32Array;
  b1a: Float32Array; b1b: Float32Array;            // F1 back distance at 9.1685 and at 11.467 (cohort 0)
  b2: Float32Array; l2: Float32Array; row2: Uint16Array;
  b3: Float32Array; l3: Float32Array;
  seed: Float32Array;                              // hash01 per walker
};
/** Static, built once per Story by buildWorld (memoized in a WeakMap). Never part of FrameState. */
export type World = {
  L: number; final: number;
  noteStart: Float64Array; noteEnd: Float64Array; noteVel: Float32Array; noteMidi: Uint8Array;
  noteCol: Uint8Array; noteMotif: Uint8Array;      // motif: 0 none, 1 M1, 5 M5
  noteArc: Float32Array;
  kicks: Float64Array; snares: Float64Array; hats: Float64Array;
  corners: {arc: number; time: number; p: Vec3}[];
  m2: Occ[]; m4: Occ[]; m5: Occ[]; m6: {start: number; hits: number[]}[];
  walkers: WalkerTable;
  tiles: {size: 160; events: [Float32Array, Float32Array]; arc: Float32Array; lateral: Float32Array; crest: Uint8Array};
  answerHome: Vec3; answerMeet: Vec3;
  aRest: number; aRise: number;                    // A(54.9), A(64.038); Δ = aRise − aRest
};
/** Per-frame world state: numbers only (validation walks it with assertFinite). */
export type WorldFrame = {
  held: number; frozen: number;                    // heldTime(t); 1 inside a freeze
  arc: number; camArc: number;
  wick: Frame3 & {y: number; scale: number; glow: number; dot: number};
  cam: Frame3 & {y: number};                       // routeFrame(camArc), y = causewayY
  pedal: number;
  swell: {center: Vec3; amp: number};
  kicks: number[]; snares: number[]; hats: number[]; // last 6 / 2 / 4 onset times ≤ held (−1e3 when none)
  ghost: {p: Vec3; glow: number; radius: number};
  answer: {p: Vec3; glow: number; visible: number; stand: number};
  shadow: {strength: number; frontArc: number; sky: number; pulse: number};
  horizon: {glow: number; tint: number};
  hammer: number;                                  // exp(−age/.12) of the latest M6 hit inside an M6 bar
  ring: {center: Vec3; radius: number; flash: number};
  beams: {p: Vec3; height: number; glow: number}[]; // 0–2 active
  sparkle: number;                                 // 1, then 0 from 82.35 (hats, embers, hops off)
};
export type WalkerLook = 'walker' | 'ember';
export type Rig = {back: number; side: number; up: number; ahead: number; lift: number; fov: number; roll?: number};
```

```ts
// src/v3/world/index.ts (public API)
export const L = 441, DEG = [14, 7, 2, 11, 7, 8, 9, 8, 9, 7, 7, 8], U = 6, W = 10;
export const FREEZES: [number, number][]; export function heldTime(t: number): number;
export function routePoint(s: number): Vec3;                 // crisp, y = 0
export function routeFrame(s: number): Frame3;               // smoothed table (±8)
export function causewayY(w: World, s: number, t: number): number;
export function buildWorld(a: Analysis, story: Story): World; // memoized per story
export function wickArc(w: World, t: number): number;
export function worldAt(w: World, a: Analysis, t: number): WorldFrame;
export function posesAt(w: World, t: number): Float32Array;  // 2048 × [x, y, z, yaw, lie, stand, head, spark]
export function followRig(f: WorldFrame, rig: Rig, t: number): CameraPose;
export function blendPose(a: CameraPose, b: CameraPose, x: number): CameraPose;
export const RIGS: Record<'dolly' | 'paradeHigh' | 'topDiag' | 'topDiagLow' | 'chase' | 'grandHigh' | 'grandCauseway', Rig>;
export const TOP_POSE: (t: number) => CameraPose;
export const WorldContext: React.Context<World | null>; export function useWorld(): World;
```

**Element components** (`src/v3/world/*.tsx`). Each takes `SceneProps` fields plus the props below.

```ts
<Plain t light world={WorldFrame} floor={0..1} residue={1} fog={{density, color}} swellGain={0|1} dim={0..1}/>
<Walkers t world={WorldFrame} look="walker"|"ember" max={200|2048} light/>
<Wick world={WorldFrame} light/>          <GhostLantern world={WorldFrame} light/>
<Answer world={WorldFrame} light/>        <HeraldBeams world={WorldFrame}/>        <LoopRing world={WorldFrame}/>
<Backdrop light glow horizon center?={Vec3} tint?={number} shadow?={number}/>   // extended in place
```

**Engine contract changes** (WP5):
- `SceneProps.world: WorldFrame`; `FrameState.world: WorldFrame`.
- `MotifState` gains `columns: number[]` (12), `legato: number`, `width: number`, `dot: number`, `offset: number` (the crest's height above the head, which → 0 at 84.615–84.9).
- `PostState` gains `flash: number` and `flashTone: number`.
- `v3Frame` signature unchanged; it calls `buildWorld(a, story)` and `worldAt` internally.
- `Compositor` gains a `world: World` prop and wraps every portal in `WorldContext.Provider`.

### 6.2 Packages

| WP | Scope | Owns (exclusive) | Depends on |
|---|---|---|---|
| **WP1 — world systems** | Route, clock, `buildWorld` (notes, drums, motifs, walker table, tile events, crest cells, answer home), `worldAt`, `walkerPose` / `posesAt`, rigs, and all shared elements (§2.2–2.7). | `src/v3/world/**` (types, index, route.ts, clock.ts, build.ts, tiles.ts, walkers.ts, frame.ts, rigs.ts, context.ts, Plain.tsx, Walkers.tsx, Wick.tsx, GhostLantern.tsx, Answer.tsx, HeraldBeams.tsx, LoopRing.tsx); `src/v3/elements/Backdrop.tsx` (add `center`, `tint`, `shadow`) | Phase 0 |
| **WP2 — solo plains + home** | `PlainSolo` (sleeping-plain and memory-plain) and `Homecoming`: crane, causeway lowering, lock and fill presentation, end glow. | `src/v3/scenes/PlainSolo.tsx`, `src/v3/scenes/Homecoming.tsx` | WP1 interfaces |
| **WP3 — marches** | `Procession` (first-parade and grand-parade: rises, causeway camera, three lights leading) and `Interlocking` (two columns, side-steps, shadow state, hammer, burn-friendly floor). | `src/v3/scenes/Procession.tsx`, `src/v3/scenes/Interlocking.tsx` | WP1 interfaces |
| **WP4 — breakdown + return** | `Drift` (floorless orbit, ember look, sky shadow, band, grid) and `Tunnel` (instanced walls along `routeFrame` for arc 200–312 × 2 sides × 4 rows = 904 boxes; extrude, kick flicker in bar 22, hammer, part / sink, crimson pulse, ghost mouth). | `src/v3/scenes/Drift.tsx`, `src/v3/scenes/Tunnel.tsx` | WP1 interfaces |
| **WP5 — engine and wiring** | Phase 0 contracts. `TIMELINE`, `LIGHT`, `LEGATO`, `FLASHES`. Crest glyph: `render/shaders/crest.glsl.ts` (`crestSdf`, `ANCHOR`, `DEG`), `MotifLayer.tsx` rewrite. Iris and radial burn in `transition.glsl.ts`; flash in `post.glsl.ts`. `frame.ts` (world, crest state, projection of Wick to NDC, exposure end, flash). `Compositor` provider. `PixelParade.tsx`. Registry (remove `void`, `ember-field`, `bloom`). Validation (§7). The v3 stills list in `scripts/render.ts`. | `src/v3/timeline.ts`, `src/v3/engine/*`, `src/v3/elements/MotifLayer.tsx`, `src/v3/render/**`, `src/v3/PixelParade.tsx`, `src/v3/scenes/registry.ts`, deleting `scenes/{Void,EmberField,Bloom}.tsx`, `scripts/validate/v3.ts`, `scripts/render.ts` (v3 branch only) | WP1 interfaces |

**Rules for every package:**
- No `useFrame` outside the Compositor; no `Math.random`, `Date` or `performance.now`.
- Instance data goes into `useMemo`; per-frame uniforms are set in `useLayoutEffect`.
- Seeded hashes only (`hash01`, `rngFor` at mount).
- Scenes must not import other scenes.
- Shared visuals live only in `src/v3/world/`. If a scene needs a change there, file a request with WP1 instead of forking the element.

**Performance budget** (per layer, 1080², MSAA 4; two layers during transitions):
- ≤ 140 k triangles. Plain about 51 k; walkers 2,048 × 26 ≈ 53 k; walls about 11 k; sprites negligible.
- ≤ 16 draw calls.
- World CPU ≤ 3 ms per frame (`posesAt` is shared through its cache).
- No textures uploaded per frame, apart from at most 2,048 × 8 float instance attributes.
- Tile event textures are static.

---

## 7. Acceptance checks

### 7.1 Automated (WP5 adds to `scripts/validate/v3.ts`)

1. **Route:**
   - `routePoint(0) = (−60, 0, 42)`, `routePoint(441) = (60, 0, 39)`.
   - Vertices exactly as in §2.2; every segment axis-aligned.
   - `routeFrame` heading has unit length everywhere in [−240, 500].
2. **Wick:**
   - `wickArc` is non-decreasing over all frames and constant over f525–550, f1083–1098 and f3817–3841.
   - `wickArc(84.7) = 441`.
   - Arc at the scene boundaries within ±1 of §2.2 (46, 100, 202, 244, 292, 328, 430).
3. **Walkers:**
   - For every 17th walker, every frame: the pose is finite.
   - The position step between consecutive frames is ≤ 2.0 tiles, except at a walker's own stand frame. This catches teleports at every formation and drift blend.
   - Poses are identical across each freeze window.
   - `posesAt` gives the same result when seeks are made in reverse order.
4. **Counts:**
   - Visible walkers (`stand > 0`) equal the number with `T_w ≤ τ` (cohorts 0 and 1) or `restLight ≤ τ` (cohort 2).
   - That gives ≥ 46 at f600 (the trail plus about 38 rear guards whose homes Wick passed before 9.17), exactly 200 at f1110 and f2800, 2,048 lying (`lie > .9`) at f3500, and 2,048 standing (`lie < .1`) at f3900.
5. **Tiles:**
   - No cell has more than 8 events.
   - Every route cell `i ≤ 441` has a contact event at `noteStart[i]`.
   - Exactly 5 chevrons, 3 rings, 16 hammer hits and 1 answer event.
6. **Timeline:**
   - The resolved windows match §5 within 1 frame.
   - Ids are exactly the 8 scene ids in §3.
   - The existing checks still pass: no adjacent repeats, transitions ≥ 4 frames, no overlap.
7. **FrameState:**
   - `assertFinite`, now including `world` and the new motif and post fields.
   - Every layer camera has `|position − target| > 1` and is not vertical (`|dir.y| < .995`).
8. **Determinism:** the forbidden-token scan covers `src/v3/world/**`, and the existing repeat-still hashes (f3900, f180, f2400) match.

### 7.2 Stills and what must be visible

Render with `bun run render:stills <frames…>`. **Brightness floor:** the existing check (`YAVG ≥ 2` for every still between 10 and 80 s) must pass. The design target is `YAVG ≥ 5` in drift and freeze 3. **No hard cuts:** every transition midpoint still shows both scenes blended, with no black layer.

| Scene | Frames | Must be visible |
|---|---|---|
| sleeping-plain | 30, 300, 500, 540 | Wick with a halo; ≥ 2 trail tiles cooling behind it; a pale crest dot or column above it; fill-flicker tiles at f500; a single pixel and dimmed plain at f540. |
| first-parade (iris) | 563 | A crest-shaped opening centered on Wick, with an orange rim. |
| first-parade | 700, 900, 1022, 1090 | f700: a single file of standing walkers with glowing heads, camera mid-rise. f900: 3/4 high view with about 46 walkers and guards standing beside the trail. f1022: the closed amber ring flash around the head. f1090: walkers in the air (frozen hop) under a dissolve with the top-down view. |
| interlocking | 1120, 1150, 1237, 1800, 2075 | Two columns (≥ 150 heads in frame). f1150: a chevron arm lit left of the left column. f1237: a vertical herald beam from the right column's front. f1800: a shadow front with darkened tiles ahead and lit tiles behind. f2075: crimson hammer flashes ahead of the line. |
| burn | 2143 | The burn front radiating from Wick: floor gone near Wick, remaining at the frame edges. |
| drift | 2250, 2330, 2500, 2660 | No floor. Ember heads behind Wick. f2330: Wick clearly raised. f2500: embers high, violet horizon band, crimson-purple sky. f2660: embers in two flat grids. |
| tunnel | 2734, 2790, 2890, 3050, 3180, 3240 | f2734: dissolve midpoint. f2790: walls ≥ 3 tiles high on both sides, walkers marching. f2890: a crimson chevron on the floor. f3050: wall flicker. f3180: wall hammer flash. f3240: the ghost orb filling the corridor's far end. |
| memory-plain | 3366, 3450, 3620, 3780, 3830 | f3366: dissolve, with walls sinking. f3450: the same framing as f300 plus purple residue, lying walkers and an amber band. f3620: the answer's flare at front-right. f3780: walkers sitting up. f3830: frozen, many dim heads, the answer beside the one-pixel Wick. |
| grand-parade | 3853, 3900, 4000, 4314, 4350, 4420, 4800, 4900 | f3853: crest iris. f3900: ≥ 1,500 standing walkers (dolly mid-rise), a full amber crown. f4314: a ring flash. f4350: a visible stair. f4420: a raised causeway. f4800: the ghost low near the line. f4900: three lights at the head. |
| homecoming | 4930, 4960, 5040, 5080, 5120, 5160 | f4930: wash midpoint. f4960: no sparks, lying walkers. f5040: crane about 60°. f5080: top-down; the **whole route outline readable as the 12-column crest**, Wick at its lower-right end. f5120: crest interior filled amber, with the small crest sitting on Wick. f5160: ink with one ember (`YAVG < 4`, Wick pixel above background). |

### 7.3 Look-dev review (human)

1. The crest is legible at 1080² in f300, f3900 and f5120, with ≥ 3 px per column.
2. The callbacks read: f300 against f3450 (same framing), f700 against f3900 (same rise), and f540 against f3830 (same pixel).
3. Nothing but Wick, contact sparks and finale heads reaches flare or yellow.
4. The 18.05 freeze reads as "held", not "dropped frames": sparks visibly suspended.
