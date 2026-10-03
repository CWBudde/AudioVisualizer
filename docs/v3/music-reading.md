# PixelParade — music reading for v3 story treatments

The measured musical foundation for the concept writers. Grid: 105 BPM, 4/4, first beat 0.038 s; bar *n* starts at `0.038 + n × 2.2857 s`. 38 bars, 86.12 s, G major. Frames are `round(t × 60)` at 60 fps (last frame 5167). Sources: `analysis/story.{md,json}`, `analysis/features.json` (100 Hz stem envelopes, typed drum onsets), `analysis/sections.csv`, the SSM images, and new ffmpeg spectrograms of the stems. *(proxy)* marks a reading taken from spectrograms or envelopes rather than by ear.

## 1. Character

A bright, mid-tempo chiptune strut in G major, cheerful but never frantic. One 8-bit pulse arpeggio runs through every bar at almost constant level, and the arrangement builds the "parade" around it, then strips it away. Loudness hardly moves (LRA 4.4 LU; section RMS spans only about 6 dB). The drama comes from **who is present**: when kick and bass play, the low band holds 50–57 % of the energy; without them it falls to 8–15 %.

The story shape is **arrive, march, wander, march, remember, march home**:

- a lone figure warms up;
- the band crashes in twice, each time after a held-breath silence;
- the middle opens into a dream on E-minor colours, the only minor passage;
- the band regroups;
- the opening is remembered almost verbatim;
- the same held breath launches a fuller replay of the first march;
- the piece settles onto a low, warm G.

The music signals its turns: each quiet section is announced one bar early, and each return arrives through a fill or a pickup.

## 2. Instrument cast

| Voice (stem) | Timbre / register | Rhythmic role | Present | Persona suggestion |
|---|---|---|---|---|
| **Arp synth, M1** (other) | Pulse/square pluck with harmonics up to about 9 kHz, the "pixel" colour. Short notes (120–150 ms). Range G3–G5 (median A4); peaks at D6 in B′ and F#6 in E. | 16th-note bar ostinato. M1 = G5 G4 B3 D5 G4 A4 B4 A4 B4 G4 G4 A4. | **All 38 bars**, −21 to −26 dBFS. Silent only under the fills at 8.1–9.2 and 63.2–64.0 s. | The protagonist, there before the parade and after it. |
| ↳ intro vs finale *(proxy)* | Intro: sparse, staccato, with audible rests (0.25, 4.85, 7.1, 7.7 s) and a low body. Finale: denser and more legato. Centroid falls from 2754 to 2212 Hz; mid band rises from 44 % to 60 %. | | | The same figure, grown up. |
| **Bass** (bass) | Saw-like synth bass with harmonics to about 800 Hz. G1–D2 (49–73 Hz). Legato with gated rests. | D pedal under every B phrase (G over D: "ready to go"). M2 C→D ostinato. M4 C–D→G cadence. | Bars 4–15, 20–23, 28–35. Faint in 16–19 and 36. Absent in 0–3, 24–27 and 37. | The ground, or the float that carries everyone. |
| **Kick** | Deep, pitched-down boom (tail to 50 Hz, about 150 ms). | Syncopated strut, not four-on-the-floor: 16ths 0, 7, 8, 10. | Bars 4–15, 19–23, 28–35. | Marching feet / heartbeat. |
| **Snare/clap** | Broadband noise with a tail. Long noisy build at 17.5–18.0 s. | Backbeat on 2 and 4; carries every fill. | With the kick, plus the fills in bars 3, 19 and 27, and distant soft snares at 55.3–56.6 s (−46 dB). | The drummer who calls everyone in. |
| **Hats** | Light, sparse, partly masked. | Off-16ths 2, 6, 9, 14. A double hat closes bar 35. | With the groove. | Sparks / confetti. |
| **Pad / held chords** (inside other) | Sustained tones. About 490 and 740 Hz held in bars 24–25. Low-mid in F, with a vibrato wobble on the last chord *(proxy)*. | Long notes over the arp. | Bars 18–19 (Am–B7–Em/G–Gmaj7), 24–25, 36–37. | Sky / memory: it appears only when the parade pauses. |
| **"Vocals"-stem texture** | No lyrics. A vox- or choir-like harmonic stack (about 370, 500 and 750 Hz) with a breathy 5–12 kHz top. Possibly synth leakage. | Stabs on beat 3 of the C→D bars (19.41, 24.03, 28.65 s). Swells before the breakdowns. | Swells at 30.5–31.6 s (bar 13), 33.7–36.4 s (bar 15) and 49.8–56.7 s (bars 22–24, loudest, −26.6 dB at 54.0). **Lone tone near G4 at 60.24–61.25 s.** Bursts at 72.8–73.3 and 79.8–81.7 s. | A distant voice or ghost that calls before each turn. |
| **Lead, M5** (other) | Arp colour, longer notes, fifths and octaves (G4–G5). In F the notes lengthen (278 ms) and drop to a median of D4. | Half-bar bugle figure G5 G4 D5 G5 D5 G4. | Bars 9, 11, 20, 27, 33, 34; transposed to C in bar 36. Longer notes in 17, 22, 35–37. | Herald / bugle call. |

## 3. Bar map by phrase

E = energy: 1 solo arp · 2 arp + held or partial layers · 3 partial groove · 4 full groove · 5 full groove + extra layers.

| Bars | Time (s) | Phrase / cue | Chords | Active | E | Motifs | What happens |
|---|---|---|---|---|---|---|---|
| 0–2 | 0.04–6.90 | **A** assembly | Em7 (≈ G6) | arp | 1 | M1 ×3 | A lone staccato arpeggio with no low end. Expectant. |
| 3 | 6.90–9.18 | A | Em7 | arp → drum fill | 1→3 | — | The arp stops at about 8.1 s. Solo fill from 8.03 s (snares 8.18 and 8.30, kick 8.50). **Hard stop at 8.746, then 0.42 s silence.** |
| 4–6 | 9.18–16.04 | **B** first-parade | G/D | full | 4 | M1 ×3, M3 | The whole band hits the downbeat; the low band jumps from 10 % to 56 %. Bright, but sitting on a pedal. |
| 7 | 16.04–18.32 | B | Gmaj7 | full | 4 | **M4** | C–D→G cadence and a snare build. **Band cuts at 18.05, 0.26 s silence.** |
| 8–11 | 18.32–27.47 | **C** interlocking | C D \| Gmaj7 \| C D \| G | full + vox stabs | 4 | **M2** ×2, M5 ×3 | Two-bar call and response (checkerboard in the SSM). The "e" bars push C→D with a stab on beat 3; the "f" bars answer on G with the bugle. |
| 12 | 27.47–29.75 | **D** | G D | full | 4 | M2 (exact) | Seamless; the third M2. |
| 13 | 29.75–32.04 | D | **B7/D# → Em7** | full + vox swell | 4 | — | **Harmonic turn:** the bass walks D–D#–E (V/vi → vi). The first shadow. |
| 14 | 32.04–34.32 | D | Am7 | full | 4 | — | ii, heading for V. |
| 15 | 34.32–36.61 | D | Am7 D | D pedal, thinning drums, vox swell | 4→3 | **M6** | **Announcement:** the bass hammers D, no kick after beat 2, and no kick on the next downbeat. The drums are gone by about 36.25 s. |
| 16–17 | 36.61–41.18 | **E** open-breakdown | Em7/D Bm7 \| Bm7 Bm7/A | arp (gated), faint bass | 2 | (a′ ≈ intro) | The floor vanishes. The arp stutters (gaps at 36.8 and 37.1 s) and climbs to F#6. Intro-like figures over minor chords. |
| 18 | 41.18–43.47 | E | Am B7 | arp + held chords | 2 | — | Notes lengthen into a pad. B7 = V of Em: longing, unresolved. |
| 19 | 43.47–45.75 | E | Em/G Gmaj7 | drums, arp | 3 | — | Hat at 43.75, then the **snare at 44.03 (beat 2)** restarts the groove a bar before the bass. Em turns into G. |
| 20–23 | 45.75–54.90 | **D′** tunnel-return | C D7 \| B7 Gmaj7 \| Am7 \| D | full + vox + lead | 4→5 | M2 ×2 (bar 21 on B), M5, **M6** (bar 23) | The bass slides in at 45.5 and lands at 45.75. D's chord path is compressed into one phrase. Bar 22 is the densest bar before the finale. Bar 23 is the second **announcement**, with the loudest vox swell. |
| 24–26 | 54.90–61.75 | **A** suspended-breakdown | G/D → G | arp + held pad, soft snares | 2 | M7 | The opening returns, now on **G** (resolved, not Em). Held notes float above it. **Lone vox tone at 60.24 s.** |
| 27 | 61.75–64.04 | A | G | arp → same fill | 2→3 | M5 | **Callback of bar 3:** hat at 62.89, snares at 63.05/63.18/63.35, the arp stops at about 63.2. **Near-silence at 63.62–64.03.** |
| 28–30 | 64.04–70.90 | **B** finale | G/D | full | 5 | M1 ×3 (bar 30 exact) | The first parade, denser and more legato. The loudest section (−17.0 dBFS). |
| 31 | 70.90–73.18 | B | D G | full | 5 | **M4** | Cadence, then an **ascending arp run at 72.0–73.2** *(proxy)* and a vox burst. |
| 32–34 | 73.18–80.04 | **B′** finale | G/D | full | 5 | M5 ×2 | The march continues, lifted. Similarity to B is only 0.43: a variation. |
| 35 | 80.04–82.32 | B′ | Gmaj7 | full + lead + vox | 5 | **M4** (exact) | Last cadence. Double hat; kick and snare stop by about 82.0. |
| 36 | 82.32–84.61 | **F** settle | C D | held chords, faint low C, lead | 2 | M5 (→C) | Spectral collapse: centroid falls from 2.7 to 0.9 kHz at 82.35; the top band goes to zero. Low, long notes. |
| 37 | 84.61–86.12 | F | **G** | final chord | 1 | — | The G chord sounds at 84.62 and is held with a wobble. Release at 85.73; tail to −60 dB at 86.05. |

## 4. Recurrence and motif map

| Material | Where (bar · s) | What changes on return | Callback |
|---|---|---|---|
| **Fill + breath → downbeat** | Bar 3: fill 8.03, silence **8.746–9.168**, hit 9.18. Bar 27: fill 62.89, near-silence **63.62–64.03**, hit 64.04. | Near-identical gesture and gap (0.42 vs 0.41 s). The second gap holds one faint −44 dB note, so the −45 dB silence detector missed it. | ★★★ strongest structural rhyme |
| **Intro arp (A)** | 0–3 · 0.04 → **24–27 · 54.90** (SSM 0.61). Partial echo at 16–17 · 36.61 (a′). | Em7 becomes G (question becomes answer). Held pad on top, no bass, distant snares, new vox tone. At bars 16–17 it is chopped and set over minor chords. | ★★★ the "memory" rhyme |
| **First parade (B)** | 4–7 · 9.18 → **28–31 · 64.04** (0.66) → B′ 32–35 · 73.18 (0.43) | Denser, more legato arp with more mid-range. Same bass and drums. B′ adds lead and vox and climbs. Played twice in a row. | ★★★ |
| **M1** | 0, 1, 2, 4, 5, 6 · 0.04–13.75; 28, 29, 30 · 64.04–68.61 | Never transposed. Detected only in the "home" phrases A and B. | ★★★ (merges with A/B) |
| **M2 bass C→D** | 8 · 18.32, 10 · 22.90, 12 · 27.47, 20 · 45.75, 21 · 48.04 | Always on the C–D bars, with a vox stab on beat 3 in 8, 10 and 12. In bar 21 it slips to B under B7: the darker version. | ★★ "we're moving" |
| **M4 cadence C–D→G** | 7 · 16.04, 31 · 70.90, 35 · 80.04 | First → a stop; second → the climb; third → the end of the parade. | ★★ "end of a lap" |
| **M5 bugle** | 9 · 20.61/22.32, 11 · 26.90, 20 · 45.75, 27 · 62.90, 33 · 77.18, 34 · 79.47, 36 · 82.32 (on C) | Weak fifth/octave signal; it sits inside the pre-finale fill. The last statement moves onto the settle's C. | ★ subtle |
| **M6 announcement bar** | **15 · 34.32**, **23 · 52.61** (bar 32 · 73.18 is only a weak note match) | Confirmed by function *(proxy)*, not by melody. Both bars share a hammered D pedal (8 D hits), the kick thinning out with no kick on the next downbeat, a vox swell (−35 / −27 dB), and drums gone before the barline. Bar 32 follows the run and starts B′: probably a tracker coincidence. | ★★★ "something is about to change" |
| **D chord path** | 12–15 · 27.47 → 20–23 · 45.75 (0.57) | Compressed; the passing D# of bar 13 becomes a root-position **B7 on the downbeat** at 48.04. Lead and vox added. | ★★ |
| **B7 → Em shadow** | 13 · 29.75, 18 · 41.18, 21 · 48.04 | The only minor colour. It belongs to the middle and never appears in the finale. | ★★ emotional centre |

**Rhymes to build on:** (1) the fill and breath into the parade at 9.18 and 64.04 s; (2) A at 0 s against A at 54.9 s; (3) B at 9.18 s against B at 64.04 s; (4) the announcement bars 15 and 23.

## 5. Key moments

| # | Time (s) | Frame | Moment |
|---|---:|---:|---|
| 1 | 0.02 | 1 | First arp note; the lone figure. |
| 2 | 8.03 → 8.746–9.168 | 482 → 525–550 | Solo fill, then the **first breath**. |
| 3 | 9.18 | 551 | **Parade drop** (bass in at 9.33). |
| 4 | 18.050–18.311 | 1083–1099 | **Second breath**, after the M4 cadence at 16.04 (f 962). |
| 5 | 29.75 | 1785 | **B7/D# → Em**, the first shadow. |
| 6 | 34.32 | 2059 | Announcement bar 15. |
| 7 | 36.61 | 2197 | **Open breakdown** (drums gone at 36.25 / f 2175). |
| 8 | 41.18 | 2471 | Am → B7: held chords, the longing peak. |
| 9 | 44.03 | 2642 | **Drum re-entry** (snare). |
| 10 | 45.75 | 2745 | **Bass returns** (D′). B7 downbeat at 48.04 (f 2882). |
| 11 | 52.61 | 3157 | Announcement bar 23 (vox peak at 54.0 / f 3240). |
| 12 | 54.90 | 3294 | **The intro returns, on G.** |
| 13 | 60.24 | 3614 | Lone vox tone, the most "human" moment. |
| 14 | 62.89 → 63.62–64.03 | 3773 → 3817–3842 | Fill callback, then the **third breath**. |
| 15 | 64.04 | 3842 | **Finale drop.** |
| 16 | 72.0–73.18 | 4320–4391 | Ascending run into B′. |
| 17 | 82.04 / 82.35 | 4922 / 4941 | **Settle:** C chord attack, then spectral collapse. |
| 18 | 84.62 | 5077 | **Final G chord** (the last onset). Release at 85.73 (f 5144); tail to 86.05 (f 5163); end at 86.12 (f 5167). |

## 6. Transitions

| Boundary | How the music moves | Length | Visual hint |
|---|---|---|---|
| A → B (9.18) | The arp stops, a solo drum fill plays, then a **hard stop**, **silence**, and a full-band downbeat. | Fill 0.72 s + gap 0.42 s | Held breath → burst. |
| B → C (18.32) | Cadence, snare build, a band-wide **cut on 16th 14**, silence, then a downbeat with a beat-3 stab. | Build 0.5 s + gap 0.26 s | Short freeze → re-angle. |
| C → D (27.47) | **Seamless**; the harmony turns two bars later (29.75). | 0 | Put the change at 29.75, not at the barline. |
| D → E (36.61) | **Drop-out taper:** in the announcement bar the kick thins from 34.9 and the vox swells. The drums are gone by 36.25 with no downbeat kick; the bass ends at 36.65. The arp carries over and starts to stutter. | About 2.3 s taper | The ground falls away; one survivor. |
| E → D′ (45.75) | **Two-stage re-entry:** drums at 44.03, then a bass slide at 45.5 that lands at 45.75. | 1.72 s between stages | Rhythm first, then mass. |
| D′ → A (54.90) | **Crossfade-like:** the announcement taper and the peak vox swell lead in. The bass leaves at about 55.0 while held pad notes bridge the barline, and the high noise band falls over 55.5–57.3 *(proxy)*. | About 2.3 s taper + 2–3 s overlap | Dissolve or drift. |
| A → B (64.04) | **Mirror of 9.18:** the arp stops, the bar-3 fill plays, a near-silent gap, then the downbeat. | Fill 0.7 s + gap 0.41 s | The same held breath, bigger release. |
| B → B′ (73.18) | **Riser-like** arp climb after the cadence. No stop. | About 1.2 s | Lift / level-up in motion. |
| B′ → F (82.32) | The drums end at about 82.0. The chord attack comes **early at 82.04**, then an **instant spectral collapse** at 82.35. | About 0.3 s | Sparkle off; a warm, low, slow world. |
| F → end | C–D → G at 84.62, held; release at 85.73. | 1.5 s hold + 0.3 s tail | Final pose, fade on the release. |

## 7. Honest uncertainties

- **No listening was done.** Timbres come from spectrograms and envelopes. Instruments are separation-model stems; the "vocals" stem may be a vox pad, leakage, or both.
- **Notes are unreliable.** The monophonic tracker on a polyphonic arp makes octave errors. Similarities of 0.5–0.6 are near the floor (M5, M7, M6 at bar 32). M6 is confirmed only as a functional pattern in bars 15 and 23.
- **Chord names are template fits.** Em7 vs G6 in the intro is undecidable, and "G/D" may simply be G over a pedal. The bar-13 D# rests on one bass event plus chroma. The bar-3 "F" and bar-36 "C" bass notes sit at the noise floor.
- **Readings from my own envelopes and spectrograms.** The third breath (63.62–64.03, below −40 dBFS except one −44 dB note), the ascending run (72–73.2) and the falling noise band (55.5–57.3) come from these and are not in the analysis JSON.
- **Hats are under-detected,** so the patterns are reliable for kick and snare only. The grid assumes a constant tempo (8 ms median onset fit). The energy scale (1–5) is my judgement from stem presence and RMS.
