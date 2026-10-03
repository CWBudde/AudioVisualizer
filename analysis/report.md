# PixelParade audio analysis

Source SHA-256: `20a7f80e5de0e2052071fcba6a838249437d60deb42991b42ed03f1cd955066d`. Duration: 86.120 s. Features are centered at `i × 0.01` seconds.

| Track | Rate | Duration | RMS dBFS | Peak dBFS | RMS relative to mix | Detected onsets |
|---|---:|---:|---:|---:|---:|---:|
| mix | 48000 | 86.120 s | -18.47 | -2.86 | +0.00 dB | 411 |
| drums | 44100 | 86.120 s | -23.62 | -2.92 | -5.15 dB | 233 |
| bass | 44100 | 86.120 s | -24.27 | -9.77 | -5.80 dB | 224 |
| other | 44100 | 86.120 s | -22.95 | -4.36 | -4.48 dB | 432 |
| vocals | 44100 | 86.120 s | -43.43 | -16.84 | -24.96 dB | 56 |

## Rhythm

Estimated tempo: **105.000 BPM**. Beat origin: **0.038 s**. Quarter-note period: 0.571429 s. Four-bar phrase under 4/4: 9.142857 s.

Refined explicit 105.0 BPM mix-analysis prior using multibeat spectral-novelty correlation 0.6218; phase fitted to low-band drum attacks.

Meter: 4/4; downbeat at beat index 0 from kick/bass attack accents. Median detected-onset distance to the nearest sixteenth-note subdivision: 8.00 ms. This metric measures grid fit, not detection accuracy or downbeat certainty.

| Alternative BPM | Correlation |
|---:|---:|
| 105.00 | 0.6218 |
| 70.00 | 0.4582 |
| 140.00 | 0.3676 |
| 84.00 | 0.3202 |
| 60.00 | 0.2660 |
| 168.00 | 0.2338 |

## Stem validation

Sum correlation with the mono reference: 0.99876979; strongest cross-correlation lag: 0.0000 ms; residual RMS: -44.69 dBFS; maximum duration difference: 0.0000 ms. Stems are float32 with rescaling disabled. Correlation is an alignment/reconstruction check, not a separation-quality score.

## Mix sections

Band percentages describe energy within 25 Hz–12 kHz after analysis resampling. Statistics exclude a 42.7 ms margin at each boundary to avoid overlapping adjacent sections. Onset counts include the full section.

| Section | Start–end | RMS dBFS | Centroid Hz | Low-band energy | Onsets |
|---|---:|---:|---:|---:|---:|
| assembly | 0.000–8.746 s | -23.38 | 3091 | 10.2% | 49 |
| first-pause | 8.746–9.168 s | -80.70 | 662 | 0.1% | 0 |
| first-parade | 9.168–18.050 s | -17.67 | 2547 | 56.2% | 44 |
| second-pause | 18.050–18.311 s | -78.52 | 1327 | 1.2% | 0 |
| interlocking-parade | 18.311–36.600 s | -17.76 | 2615 | 57.0% | 90 |
| open-breakdown | 36.600–44.400 s | -21.40 | 2912 | 7.6% | 40 |
| tunnel-return | 44.400–54.900 s | -17.47 | 2549 | 49.5% | 49 |
| suspended-breakdown | 54.900–64.000 s | -21.85 | 3135 | 14.7% | 44 |
| finale | 64.000–82.300 s | -17.02 | 2532 | 49.5% | 82 |
| settle | 82.300–86.120 s | -21.91 | 819 | 11.1% | 13 |

## Interpretation limits

The stem names are model outputs, not verified instrument identities. In particular, vocal-stem energy can contain synthesizer leakage. No lyrics, key, or precise genre are asserted. Section boundaries outside measured silence are authored from energy changes and retain approximate timing. The 105 BPM prior comes from preliminary mix analysis; broad alternatives remain available in the JSON. Resampling includes fractional-delay interpolation, so analysis samples are not archival copies.

Open [overview.html](overview.html) to audition the mix or individual stems, scrub the aligned envelopes/spectrogram, and inspect cues. [sections.csv](sections.csv) contains all stem/section measurements.
