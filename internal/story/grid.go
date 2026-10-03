// Package story derives a musical skeleton from the stored feature analysis:
// a sixteenth grid, cleaned notes, key and chords, self-similarity structure,
// recurring motifs and instrument roles. The algorithms live in algo-dsp's
// measure/music packages; this package feeds them the PixelParade features
// and parameters and writes the JSON, Markdown, PNG and MIDI outputs.
package story

import (
	"encoding/json"
	"math"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
	"github.com/cwbudde/algo-dsp/measure/music/harmony"
	"github.com/cwbudde/algo-dsp/measure/music/rhythm"
)

// Grid is the constant-tempo beat grid (sixteenth slots, 4/4 bars) with the
// story.json encoding. Sixteenth slots count from the first beat; bars count
// from the downbeat (bar 0 may be a pickup when the downbeat index is not a
// multiple of four).
type Grid struct{ rhythm.Grid }

// frameRate is the feature frame rate of features.json (frame i at i/frameRate).
const frameRate = float64(audioanalysis.SampleRate) / audioanalysis.Hop

func NewGrid(r audioanalysis.Rhythm, duration float64) (Grid, error) {
	g, err := rhythm.NewGrid(r.BPM, r.BeatOrigin, r.Downbeat, duration, rhythm.WithBeats(r.Beats))
	return Grid{g}, err
}

func (g Grid) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		BPM              float64   `json:"bpm"`
		OriginSeconds    float64   `json:"originSeconds"`
		BeatSeconds      float64   `json:"beatSeconds"`
		SixteenthSeconds float64   `json:"sixteenthSeconds"`
		BarSeconds       float64   `json:"barSeconds"`
		BeatsPerBar      int       `json:"beatsPerBar"`
		Downbeat         int       `json:"downbeatBeatIndex"`
		Duration         float64   `json:"durationSeconds"`
		Beats            []float64 `json:"beatsSeconds"`
		BarStarts        []float64 `json:"barStartsSeconds"`
	}{g.BPM(), g.Origin(), g.BeatSeconds(), g.SlotSeconds(), g.BarSeconds(), g.BeatsPerBar(), g.Downbeat(), g.Duration(), g.Beats(), g.BarStarts()})
}

// beatSpans and barSpans are [start, end) of every beat and bar of the grid.
func (g Grid) beatSpans() []harmony.Span {
	out := make([]harmony.Span, len(g.Beats()))
	for i := range out {
		out[i] = harmony.Span{Start: g.BeatStart(i), End: g.BeatStart(i + 1)}
	}
	return out
}

func (g Grid) barSpans() []harmony.Span {
	out := make([]harmony.Span, g.Bars())
	for b := range out {
		out[b] = harmony.Span{Start: g.BarStart(b), End: g.BarStart(b + 1)}
	}
	return out
}

// frames maps [start, end) seconds to feature frame indices clamped to n.
func frames(start, end float64, n int) (int, int) {
	lo := min(n, max(0, int(math.Ceil(start*frameRate))))
	return lo, min(n, max(lo, int(math.Ceil(end*frameRate))))
}

func r6(v float64) float64 { return math.Round(v*1e6) / 1e6 }
func r3(v float64) float64 { return math.Round(v*1e3) / 1e3 }
